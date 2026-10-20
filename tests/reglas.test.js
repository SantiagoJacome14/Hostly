// Pruebas de las reglas de seguridad y de los flujos principales contra el
// emulador de Firestore. Correr con: npm run test:reglas (requiere Java).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

// firestore.js usa la base de datos del usuario que esté "conectado" en la prueba
vi.mock("../src/firebase/config", () => ({
  get db() {
    return globalThis.__dbPrueba;
  },
}));
const svc = await import("../src/firebase/firestore.js");

let env;
const H1 = "hotel-uno";
const H2 = "hotel-dos";

const perfiles = {
  dueno:  { rol: "admin", hotelId: H1 },
  recep:  { rol: "recepcionista", hotelId: H1 },
  aseo:   { rol: "servicio", hotelId: H1 },
  conta:  { rol: "contador", hotelId: H1 },
  vigi:   { rol: "vigilante", hotelId: H1 },
  inactivo: { rol: "admin", hotelId: H1, activo: false },
  otro:   { rol: "admin", hotelId: H2 },
};

const como = (uid) => env.authenticatedContext(uid, { email: `${uid}@prueba.co` }).firestore();
const usar = (uid) => {
  globalThis.__dbPrueba = como(uid);
  svc.setHotelActual(perfiles[uid]?.hotelId || null);
  return { email: `${uid}@prueba.co`, rol: perfiles[uid]?.rol };
};

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-hostly",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "hoteles", H1), { nombre: "Hotel Uno", ownerUid: "dueno", plan: "prueba" });
    await setDoc(doc(db, "hoteles", H2), { nombre: "Hotel Dos", ownerUid: "otro", plan: "prueba" });
    for (const [uid, p] of Object.entries(perfiles)) {
      await setDoc(doc(db, "usuarios", uid), { nombre: uid, email: `${uid}@prueba.co`, activo: true, ...p });
    }
    await setDoc(doc(db, "hoteles", H1, "habitaciones", "hab-101"), { numero: "101", tipo: "Doble", piso: 1, precio: 200000, estado: "disponible", activa: true });
    await setDoc(doc(db, "hoteles", H1, "ingresos", "i1"), { monto: 1000 });
  });
});

describe("registro de hotel", () => {
  it("un usuario nuevo registra su hotel y queda como admin", async () => {
    const db = como("nuevo");
    const b = writeBatch(db);
    b.set(doc(db, "hoteles", "h-nuevo"), { nombre: "Nuevo", ownerUid: "nuevo", plan: "prueba" });
    b.set(doc(db, "usuarios", "nuevo"), { nombre: "N", email: "n@n.co", rol: "admin", hotelId: "h-nuevo", activo: true });
    await assertSucceeds(b.commit());
  });

  it("no se puede entrar como admin a un hotel ajeno", async () => {
    const db = como("intruso");
    await assertFails(setDoc(doc(db, "usuarios", "intruso"), { nombre: "X", email: "x@x.co", rol: "admin", hotelId: H1, activo: true }));
  });

  it("no se puede registrar un hotel con plan pagado", async () => {
    await assertFails(setDoc(doc(como("nuevo"), "hoteles", "h3"), { nombre: "X", ownerUid: "nuevo", plan: "pro" }));
  });
});

describe("aislamiento y roles", () => {
  it("un hotel no ve los datos de otro", async () => {
    await assertFails(getDoc(doc(como("otro"), "hoteles", H1, "habitaciones", "hab-101")));
    await assertFails(getDoc(doc(como("otro"), "hoteles", H1)));
  });

  it("un usuario sin sesión no ve nada", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "hoteles", H1, "habitaciones", "hab-101")));
  });

  it("un empleado no puede darse rol de admin", async () => {
    await assertFails(updateDoc(doc(como("recep"), "usuarios", "recep"), { rol: "admin" }));
  });

  it("el admin crea empleados de su hotel, pero no de otro", async () => {
    const db = como("dueno");
    await assertSucceeds(setDoc(doc(db, "usuarios", "nuevo-emp"), { nombre: "E", email: "e@e.co", rol: "recepcionista", hotelId: H1, activo: true }));
    await assertFails(setDoc(doc(db, "usuarios", "emp-ajeno"), { nombre: "E", email: "e@e.co", rol: "recepcionista", hotelId: H2, activo: true }));
  });

  it("el admin lista solo los empleados de su hotel", async () => {
    await assertSucceeds(getDocs(query(collection(como("dueno"), "usuarios"), where("hotelId", "==", H1))));
    await assertFails(getDocs(query(collection(como("dueno"), "usuarios"), where("hotelId", "==", H2))));
  });

  it("el admin no puede desactivarse a sí mismo ni cambiar su plan", async () => {
    await assertFails(updateDoc(doc(como("dueno"), "usuarios", "dueno"), { activo: false }));
    await assertFails(updateDoc(doc(como("dueno"), "hoteles", H1), { plan: "pro" }));
    await assertSucceeds(updateDoc(doc(como("dueno"), "hoteles", H1), { rnt: "12345" }));
  });

  it("una cuenta desactivada ya no entra", async () => {
    await assertFails(getDoc(doc(como("inactivo"), "hoteles", H1, "habitaciones", "hab-101")));
  });

  it("limpieza cambia el estado de la habitación, pero no el precio", async () => {
    const ref = doc(como("aseo"), "hoteles", H1, "habitaciones", "hab-101");
    await assertSucceeds(updateDoc(ref, { estado: "limpieza" }));
    await assertFails(updateDoc(ref, { precio: 1 }));
  });

  it("recepción registra ingresos pero no ve las finanzas", async () => {
    const db = como("recep");
    await assertSucceeds(setDoc(doc(db, "hoteles", H1, "ingresos", "i2"), { monto: 5 }));
    await assertFails(getDoc(doc(db, "hoteles", H1, "ingresos", "i1")));
    await assertSucceeds(getDoc(doc(como("conta"), "hoteles", H1, "ingresos", "i1")));
  });

  it("nadie puede borrar movimientos financieros", async () => {
    await assertFails(deleteDoc(doc(como("dueno"), "hoteles", H1, "ingresos", "i1")));
    await assertFails(deleteDoc(doc(como("conta"), "hoteles", H1, "ingresos", "i1")));
  });

  it("el vigilante no ve reservas de clientes ni finanzas", async () => {
    await assertFails(getDoc(doc(como("vigi"), "hoteles", H1, "ingresos", "i1")));
    await assertFails(getDoc(doc(como("vigi"), "hoteles", H1, "clientes", "x")));
  });
});

describe("reservas sin sobreventa", () => {
  const base = { nombre: "Ana Pérez", documento: "1.098.765", telefono: "300", email: "", huespedes: 2, precioNoche: 200000 };

  it("varias reservas futuras para la misma habitación, sin cruces", async () => {
    const u = usar("recep");
    await svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-01", checkout: "2026-12-04", total: 600000 }, u);
    // Entra el mismo día que el anterior sale: permitido
    await svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-04", checkout: "2026-12-06", total: 400000 }, u);
    await svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-20", checkout: "2026-12-22", total: 400000 }, u);

    await expect(
      svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-03", checkout: "2026-12-05", total: 1 }, u)
    ).rejects.toMatchObject({ message: "OCUPADA", noche: "2026-12-03" });
  });

  it("el cliente no se duplica y queda con su documento como id", async () => {
    const u = usar("recep");
    await svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-01", checkout: "2026-12-02" }, u);
    await svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-05", checkout: "2026-12-06" }, u);
    const clientes = await getDocs(collection(globalThis.__dbPrueba, "hoteles", H1, "clientes"));
    expect(clientes.docs.map((d) => d.id)).toEqual(["1098765"]);
  });

  it("cancelar libera las noches", async () => {
    const u = usar("recep");
    const r = await svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-10", checkout: "2026-12-12" }, u);
    const snap = await getDoc(r);
    await svc.cancelarReserva({ id: r.id, ...snap.data() }, u);
    await expect(
      svc.crearReserva({ ...base, habitacion: "101", checkin: "2026-12-11", checkout: "2026-12-12" }, u)
    ).resolves.toBeTruthy();
  });

  it("check-in y check-out guardan todo junto", async () => {
    const u = usar("recep");
    const hoy = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const ci = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1));
    const co = iso(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 3));
    const r = await svc.crearReserva({ ...base, habitacion: "101", checkin: ci, checkout: co }, u);
    const res = { id: r.id, ...(await getDoc(r)).data() };
    const hab = { id: "hab-101", numero: "101", tipo: "Doble", precio: 200000 };

    await svc.hacerCheckin(res, hab, u);
    await svc.hacerCheckout({ ...res, checkinPor: u.email }, hab, { monto: "800000", metodo: "Nequi", estadoHab: "limpieza" }, u);

    const db = globalThis.__dbPrueba;
    expect((await getDoc(r)).data().estado).toBe("checkout");
    expect((await getDoc(doc(db, "hoteles", H1, "habitaciones", "hab-101"))).data().estado).toBe("limpieza");
    expect((await getDocs(collection(db, "hoteles", H1, "historial_estancias"))).size).toBe(1);
    // Sale antes: la habitación queda libre desde hoy
    await expect(
      svc.crearReserva({ ...base, habitacion: "101", checkin: iso(hoy), checkout: co }, u)
    ).resolves.toBeTruthy();
    // El ingreso quedó registrado (lo verifica el contador)
    const ingresos = await getDocs(collection(como("conta"), "hoteles", H1, "ingresos"));
    expect(ingresos.docs.some((d) => d.data().monto === 800000 && d.data().metodo === "Nequi")).toBe(true);
  });
});

describe("comprobantes", () => {
  it("los consecutivos no se repiten", async () => {
    const u = usar("conta");
    const datos = { tipo: "ingreso", tercero: "X", concepto: "Y", monto: 10, registradoPor: u.email };
    const [a, b] = await Promise.all([
      svc.crearComprobante(datos, "202610"),
      svc.crearComprobante(datos, "202610"),
    ]);
    expect([a, b].sort()).toEqual(["HST-ING-202610-0001", "HST-ING-202610-0002"]);
  });

  it("un comprobante se puede anular pero no editar", async () => {
    const u = usar("conta");
    await svc.crearComprobante({ tipo: "egreso", monto: 5 }, "202610");
    const [c] = (await getDocs(collection(globalThis.__dbPrueba, "hoteles", H1, "comprobantes"))).docs;
    await assertFails(updateDoc(c.ref, { monto: 999 }));
    await assertSucceeds(svc.anularComprobante(c.id, "Error de digitación", u));
  });
});
