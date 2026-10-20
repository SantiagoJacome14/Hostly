// ==========================================
// HOSTLY — Servicios de Firestore (tiempo real)
// Todos los datos viven bajo hoteles/{hotelId}/… para que cada hotel
// vea solo lo suyo. El hotel actual lo fija AuthContext al iniciar sesión.
// ==========================================

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit,
  increment,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "./config";
import { nochesDeEstancia, hoyISO, sumarDias } from "../utils/disponibilidad";

// ─── HOTEL ACTUAL ──────────────────────────────────────
let hotelActual = null;

export const setHotelActual = (id) => {
  hotelActual = id || null;
};

const hotelId = () => {
  if (!hotelActual) throw new Error("No hay un hotel activo en la sesión");
  return hotelActual;
};

const col = (nombre) => collection(db, "hoteles", hotelId(), nombre);
const ref = (nombre, id) => doc(db, "hoteles", hotelId(), nombre, id);
const nuevoRef = (nombre) => doc(col(nombre));

/** Crea un documento con id automático y devuelve su referencia. */
const crear = async (nombre, datos) => {
  const r = nuevoRef(nombre);
  await setDoc(r, datos);
  return r;
};

const escuchar = (q, callback) =>
  onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error("Firestore:", err.code, err.message)
  );

/** Timestamp de hace N días, para no descargar colecciones completas. */
const haceDias = (dias) => Timestamp.fromDate(new Date(Date.now() - dias * 86400000));

/** Id del documento de ocupación de una habitación en una noche. */
const ocupacionId = (habitacion, noche) => `${habitacion}_${noche}`;

/** Id estable del cliente a partir de su documento (evita duplicados). */
export const clienteId = (documento) =>
  String(documento || "").toUpperCase().replace(/[^0-9A-Z]/g, "");

const quien = (usuario) => usuario?.email || "sistema";

// ─── HOTEL ─────────────────────────────────────────────
export const actualizarHotel = (datos) =>
  updateDoc(doc(db, "hoteles", hotelId()), { ...datos, actualizadoEn: serverTimestamp() });

// ─── RESERVAS ──────────────────────────────────────────
// Reservas que salen desde hace 180 días en adelante (las anteriores están en Historial)
export const suscribirReservas = (callback, dias = 180) =>
  escuchar(
    query(col("reservas"), where("checkout", ">=", sumarDias(hoyISO(), -dias)), orderBy("checkout", "desc")),
    callback
  );

/**
 * Crea una reserva bloqueando cada noche de la habitación.
 * Si otra reserva ya tomó alguna de esas noches (aunque la hayan creado
 * en otro computador al mismo tiempo), falla con error "OCUPADA".
 */
export const crearReserva = async (datos, usuario) => {
  const noches = nochesDeEstancia(datos.checkin, datos.checkout);
  if (!noches.length) throw new Error("FECHAS");

  const reservaRef = nuevoRef("reservas");
  const ocupRefs = noches.map((n) => ref("ocupacion", ocupacionId(datos.habitacion, n)));
  const idCliente = clienteId(datos.documento);
  const clienteRef = idCliente ? ref("clientes", idCliente) : null;

  await runTransaction(db, async (tx) => {
    const snaps = await Promise.all(ocupRefs.map((r) => tx.get(r)));
    const tomada = snaps.find((s) => s.exists());
    if (tomada) {
      const err = new Error("OCUPADA");
      err.noche = tomada.data().fecha;
      throw err;
    }
    const clienteSnap = clienteRef ? await tx.get(clienteRef) : null;

    tx.set(reservaRef, {
      ...datos,
      clienteId: idCliente || null,
      noches: noches.length,
      estado: "confirmada",
      creadoPor: quien(usuario),
      creadaEn: serverTimestamp(),
    });
    noches.forEach((noche, i) =>
      tx.set(ocupRefs[i], { reservaId: reservaRef.id, habitacion: datos.habitacion, fecha: noche })
    );
    if (clienteRef) {
      tx.set(
        clienteRef,
        {
          nombre: datos.nombre,
          documento: datos.documento,
          email: datos.email || "",
          telefono: datos.telefono || "",
          habitacion: datos.habitacion,
          ultimaReserva: reservaRef.id,
          actualizadoEn: serverTimestamp(),
          ...(clienteSnap?.exists() ? {} : { creadoEn: serverTimestamp(), visitas: 0 }),
        },
        { merge: true }
      );
    }
  });
  return reservaRef;
};

/** Libera las noches de una reserva desde `desde` (incluida) hasta su checkout. */
const liberarNoches = (batch, reserva, desde = null) => {
  nochesDeEstancia(reserva.checkin, reserva.checkout)
    .filter((n) => !desde || n >= desde)
    .forEach((n) => batch.delete(ref("ocupacion", ocupacionId(reserva.habitacion, n))));
};

export const cancelarReserva = async (reserva, usuario) => {
  const batch = writeBatch(db);
  batch.update(ref("reservas", reserva.id), {
    estado: "cancelada",
    canceladaEn: new Date().toISOString(),
    canceladaPor: quien(usuario),
  });
  liberarNoches(batch, reserva);
  await batch.commit();
};

export const hacerCheckin = async (reserva, habitacion, usuario) => {
  const batch = writeBatch(db);
  batch.update(ref("reservas", reserva.id), {
    estado: "checkin",
    checkinPor: quien(usuario),
    checkinEn: serverTimestamp(),
  });
  if (habitacion) {
    batch.update(ref("habitaciones", habitacion.id), { estado: "ocupada", huesped: reserva.nombre });
  }
  await batch.commit();
};

/**
 * Check-out en una sola operación: reserva, habitación, historial, ingreso,
 * visitas del cliente y liberación de las noches que no se usaron.
 * O se guarda todo, o no se guarda nada.
 */
export const hacerCheckout = async (reserva, habitacion, pago, usuario) => {
  const batch = writeBatch(db);
  const montoFinal = Number(pago.monto) || 0;
  const noches = reserva.noches || nochesDeEstancia(reserva.checkin, reserva.checkout).length;

  batch.update(ref("reservas", reserva.id), {
    estado: "checkout",
    checkoutPor: quien(usuario),
    checkoutEn: serverTimestamp(),
    metodoPago: pago.metodo,
    montoPagado: montoFinal,
    observacionCheckout: pago.observacion || "",
  });

  if (habitacion) {
    batch.update(ref("habitaciones", habitacion.id), { estado: pago.estadoHab, huesped: null });
  }

  batch.set(nuevoRef("historial_estancias"), {
    reservaId: reserva.id,
    nombre: reserva.nombre,
    documento: reserva.documento || "",
    email: reserva.email || "",
    habitacion: reserva.habitacion,
    tipoHabitacion: habitacion?.tipo || "",
    piso: habitacion?.piso || null,
    precioNoche: reserva.precioNoche || habitacion?.precio || 0,
    fechaCheckin: reserva.checkin,
    fechaCheckout: reserva.checkout,
    noches,
    total: montoFinal,
    metodoPago: pago.metodo,
    valorPagado: montoFinal,
    checkinPor: reserva.checkinPor || "—",
    checkoutPor: quien(usuario),
    observaciones: pago.observacion || "",
    estadoFinalHabitacion: pago.estadoHab,
    creadoEn: serverTimestamp(),
  });

  if (montoFinal > 0) {
    batch.set(nuevoRef("ingresos"), {
      descripcion: `Check-out ${reserva.nombre} — Hab. ${reserva.habitacion}`,
      habitacion: reserva.habitacion,
      monto: montoFinal,
      metodo: pago.metodo,
      reservaId: reserva.id,
      registradoPor: quien(usuario),
      fecha: serverTimestamp(),
    });
  }

  if (reserva.clienteId) {
    batch.set(ref("clientes", reserva.clienteId), { visitas: increment(1) }, { merge: true });
  }

  // Si sale antes de lo previsto, las noches siguientes quedan libres
  liberarNoches(batch, reserva, hoyISO());
  await batch.commit();
};

// ─── HABITACIONES ──────────────────────────────────────
export const suscribirHabitaciones = (callback) =>
  escuchar(query(col("habitaciones"), orderBy("numero")), callback);

export const actualizarHabitacion = (id, datos) => updateDoc(ref("habitaciones", id), datos);

const habitacionId = (numero) => `hab-${String(numero).trim()}`;

/** Crea una o varias habitaciones; no sobrescribe números que ya existan. */
export const crearHabitaciones = async (lista) => {
  const refs = lista.map((h) => ref("habitaciones", habitacionId(h.numero)));
  const existentes = await Promise.all(refs.map((r) => getDoc(r)));
  const repetidas = lista.filter((_, i) => existentes[i].exists()).map((h) => h.numero);
  if (repetidas.length) {
    const err = new Error("REPETIDAS");
    err.numeros = repetidas;
    throw err;
  }
  const batch = writeBatch(db);
  lista.forEach((h, i) =>
    batch.set(refs[i], {
      numero: String(h.numero).trim(),
      tipo: h.tipo,
      piso: Number(h.piso) || 1,
      precio: Number(h.precio) || 0,
      capacidad: Number(h.capacidad) || 2,
      estado: "disponible",
      activa: true,
      creadoEn: serverTimestamp(),
    })
  );
  await batch.commit();
};

// ─── CLIENTES ──────────────────────────────────────────
export const suscribirClientes = (callback) =>
  escuchar(query(col("clientes"), orderBy("nombre")), callback);

/** Crea o actualiza el cliente usando su documento como identificador. */
export const crearCliente = async (datos) => {
  const id = clienteId(datos.documento);
  const destino = id ? ref("clientes", id) : nuevoRef("clientes");
  const existe = id ? (await getDoc(destino)).exists() : false;
  await setDoc(
    destino,
    {
      ...datos,
      actualizadoEn: serverTimestamp(),
      ...(existe ? {} : { creadoEn: serverTimestamp(), visitas: 0 }),
    },
    { merge: true }
  );
  return destino;
};

export const actualizarCliente = (id, datos) => updateDoc(ref("clientes", id), datos);

// ─── ACCESOS (Vigilante) ───────────────────────────────
export const registrarAcceso = (datos) => crear("accesos", { ...datos, hora: serverTimestamp() });

export const suscribirAccesos = (callback, dias = 60) =>
  escuchar(query(col("accesos"), where("hora", ">=", haceDias(dias)), orderBy("hora", "desc")), callback);

// ─── MOVIMIENTOS CON FECHA (ingresos, egresos, pagos) ──
// Por defecto se descargan los últimos 400 días: suficiente para el mes,
// el año y comparar con el año anterior, sin leer toda la historia.
const crearConFecha = (nombre, datos) => crear(nombre, { ...datos, fecha: serverTimestamp() });

const suscribirConFecha = (nombre, callback, dias = 400) =>
  escuchar(query(col(nombre), where("fecha", ">=", haceDias(dias)), orderBy("fecha", "desc")), callback);

export const suscribirIngresos = (callback, dias) => suscribirConFecha("ingresos", callback, dias);
export const registrarIngreso = (datos) => crearConFecha("ingresos", datos);

export const suscribirEgresos = (callback, dias) => suscribirConFecha("egresos", callback, dias);
export const registrarEgreso = (datos) => crearConFecha("egresos", datos);

export const suscribirPagosEmpleados = (callback, dias) => suscribirConFecha("pagos_empleados", callback, dias);
export const registrarPagoEmpleado = (datos) => crearConFecha("pagos_empleados", datos);

// ─── HISTORIAL DE ESTANCIAS ────────────────────────────
export const suscribirHistorial = (callback, max = 2000) =>
  escuchar(query(col("historial_estancias"), orderBy("creadoEn", "desc"), limit(max)), callback);

// ─── AUDITORÍA ─────────────────────────────────────────
const agregarAuditoria = (batch, datos, usuario) =>
  batch.set(nuevoRef("auditoria"), {
    ...datos,
    usuarioEmail: quien(usuario),
    usuarioRol: usuario?.rol || "—",
    fecha: serverTimestamp(),
  });

export const registrarAuditoria = (datos) => crear("auditoria", { ...datos, fecha: serverTimestamp() });

export const suscribirAuditoria = (callback, maxItems = 200) =>
  escuchar(query(col("auditoria"), orderBy("fecha", "desc"), limit(maxItems)), callback);

/** Edita un movimiento y deja el registro de auditoría en la misma operación. */
const actualizarConAuditoria = async (nombre, id, datosNuevos, datosAnteriores, usuario, descripcion) => {
  const batch = writeBatch(db);
  batch.update(ref(nombre, id), {
    ...datosNuevos,
    actualizadoPor: quien(usuario),
    actualizadoEn: serverTimestamp(),
  });
  agregarAuditoria(
    batch,
    { entidad: nombre, entidadId: id, accion: "actualizar", antes: datosAnteriores, despues: datosNuevos, descripcion },
    usuario
  );
  await batch.commit();
};

export const actualizarIngresoConAuditoria = (id, nuevos, anteriores, usuario) =>
  actualizarConAuditoria("ingresos", id, nuevos, anteriores, usuario, `Ingreso editado — ${nuevos.descripcion || id}`);

export const actualizarEgresoConAuditoria = (id, nuevos, anteriores, usuario) =>
  actualizarConAuditoria("egresos", id, nuevos, anteriores, usuario, `Egreso editado — ${nuevos.concepto || id}`);

export const actualizarPagoEmpleadoConAuditoria = (id, nuevos, anteriores, usuario) =>
  actualizarConAuditoria("pagos_empleados", id, nuevos, anteriores, usuario, `Pago editado — ${nuevos.nombreEmpleado || id}`);

// ─── COMPROBANTES INTERNOS ─────────────────────────────
const PREFIJOS = { ingreso: "ING", egreso: "EGR", pago_empleado: "PAG" };

/**
 * Crea un comprobante con consecutivo HST-ING-YYYYMM-0001.
 * El número sale de un contador dentro de una transacción, así que
 * dos usuarios al mismo tiempo nunca reciben el mismo.
 */
export const crearComprobante = async (datos, yyyymm) => {
  const prefijo = PREFIJOS[datos.tipo] || "PAG";
  const contadorRef = ref("contadores", `comprobante-${prefijo}-${yyyymm}`);
  const compRef = nuevoRef("comprobantes");

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(contadorRef);
    const siguiente = (snap.exists() ? snap.data().ultimo : 0) + 1;
    const consecutivo = `HST-${prefijo}-${yyyymm}-${String(siguiente).padStart(4, "0")}`;
    tx.set(contadorRef, { ultimo: siguiente });
    tx.set(compRef, { ...datos, consecutivo, estado: "confirmado", creadoEn: serverTimestamp() });
    return consecutivo;
  });
};

export const suscribirComprobantes = (callback) =>
  escuchar(query(col("comprobantes"), orderBy("creadoEn", "desc")), callback);

export const anularComprobante = async (id, motivo, usuario) => {
  const batch = writeBatch(db);
  batch.update(ref("comprobantes", id), {
    estado: "anulado",
    motivoAnulacion: motivo,
    anuladoPor: quien(usuario),
    anuladoEn: serverTimestamp(),
  });
  agregarAuditoria(
    batch,
    {
      entidad: "comprobantes",
      entidadId: id,
      accion: "eliminar-logico",
      antes: { estado: "confirmado" },
      despues: { estado: "anulado", motivo },
      descripcion: `Comprobante anulado — ${motivo}`,
    },
    usuario
  );
  await batch.commit();
};

// ─── CAJAS DIARIAS ─────────────────────────────────────
export const crearCajaDiaria = (datos) => crear("cajas_diarias", { ...datos, creadoEn: serverTimestamp() });

export const actualizarCajaDiaria = (id, datos) =>
  updateDoc(ref("cajas_diarias", id), { ...datos, actualizadoEn: serverTimestamp() });

export const suscribirCajasDiarias = (callback) =>
  escuchar(query(col("cajas_diarias"), orderBy("creadoEn", "desc"), limit(200)), callback);

// ─── NOVEDADES ─────────────────────────────────────────
export const registrarNovedad = (datos) =>
  crear("novedades", { ...datos, estado: "abierta", fecha: serverTimestamp() });

export const actualizarNovedad = (id, datos) => updateDoc(ref("novedades", id), datos);

export const suscribirNovedades = (callback) =>
  escuchar(query(col("novedades"), orderBy("fecha", "desc"), limit(200)), callback);

// ─── EMPLEADOS DEL HOTEL ───────────────────────────────
export const suscribirEmpleados = (callback) =>
  escuchar(
    query(collection(db, "usuarios"), where("hotelId", "==", hotelId()), orderBy("creadoEn", "desc")),
    callback
  );
