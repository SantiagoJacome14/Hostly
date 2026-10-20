// ─────────────────────────────────────────────────────────
//  src/utils/disponibilidad.js
//  Disponibilidad de habitaciones por fechas.
//  Las fechas de reserva son strings "YYYY-MM-DD" (checkin incluido, checkout excluido).
// ─────────────────────────────────────────────────────────

/** Estados de reserva que ocupan la habitación en el calendario. */
export const ESTADOS_ACTIVOS = ["pendiente", "confirmada", "checkin"];

export const esActiva = (r) => ESTADOS_ACTIVOS.includes(r?.estado);

/** "YYYY-MM-DD" de una fecha en hora local. */
export const isoLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const hoyISO = () => isoLocal(new Date());

/** Suma días a un "YYYY-MM-DD" y devuelve otro "YYYY-MM-DD". */
export const sumarDias = (iso, dias) => {
  const [y, m, d] = iso.split("-").map(Number);
  return isoLocal(new Date(y, m - 1, d + dias));
};

/** Número de noches entre dos fechas "YYYY-MM-DD". */
export const contarNoches = (checkin, checkout) => {
  if (!checkin || !checkout) return 0;
  const [y1, m1, d1] = checkin.split("-").map(Number);
  const [y2, m2, d2] = checkout.split("-").map(Number);
  const diff = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1);
  return Math.max(0, Math.round(diff / 86400000));
};

/** Lista de noches ocupadas: del checkin (incluido) al checkout (excluido). */
export const nochesDeEstancia = (checkin, checkout) => {
  const n = contarNoches(checkin, checkout);
  return Array.from({ length: n }, (_, i) => sumarDias(checkin, i));
};

/** true si los rangos [aIn, aOut) y [bIn, bOut) se cruzan. */
export const seCruzan = (aIn, aOut, bIn, bOut) => aIn < bOut && bIn < aOut;

/** Reservas activas de una habitación que se cruzan con el rango dado. */
export const conflictos = (reservas, habitacion, checkin, checkout, excluirId = null) =>
  (reservas || []).filter(
    (r) =>
      r.id !== excluirId &&
      r.habitacion === habitacion &&
      esActiva(r) &&
      seCruzan(checkin, checkout, r.checkin, r.checkout)
  );

/** Habitaciones activas sin reservas que se crucen con el rango. */
export const habitacionesLibres = (habitaciones, reservas, checkin, checkout) => {
  if (!checkin || !checkout || checkout <= checkin) return [];
  return (habitaciones || []).filter(
    (h) => h.activa !== false && conflictos(reservas, h.numero, checkin, checkout).length === 0
  );
};

/** Reserva activa que ocupa la habitación en una noche concreta (o null). */
export const reservaEnNoche = (reservas, habitacion, noche) =>
  (reservas || []).find(
    (r) => r.habitacion === habitacion && esActiva(r) && r.checkin <= noche && noche < r.checkout
  ) || null;

/**
 * Estado que se muestra en el mapa de habitaciones.
 * El estado guardado es el físico (disponible, ocupada, limpieza, mantenimiento);
 * si la habitación está libre pero alguien llega hoy, se muestra como "reservada".
 */
export const estadoVisual = (hab, reservas, hoy = hoyISO()) => {
  if (hab.estado !== "disponible") return hab.estado;
  const llegaHoy = (reservas || []).some(
    (r) =>
      r.habitacion === hab.numero &&
      (r.estado === "confirmada" || r.estado === "pendiente") &&
      r.checkin <= hoy && hoy < r.checkout
  );
  return llegaHoy ? "reservada" : "disponible";
};
