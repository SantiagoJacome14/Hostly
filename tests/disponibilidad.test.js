import { describe, expect, it } from "vitest";
import {
  contarNoches,
  nochesDeEstancia,
  sumarDias,
  seCruzan,
  conflictos,
  habitacionesLibres,
  reservaEnNoche,
  estadoVisual,
} from "../src/utils/disponibilidad";

const habs = [
  { numero: "101", estado: "disponible" },
  { numero: "102", estado: "disponible" },
  { numero: "103", estado: "disponible", activa: false },
];

const reservas = [
  { id: "a", habitacion: "101", checkin: "2026-11-10", checkout: "2026-11-13", estado: "confirmada" },
  { id: "b", habitacion: "101", checkin: "2026-11-20", checkout: "2026-11-22", estado: "checkin" },
  { id: "c", habitacion: "102", checkin: "2026-11-10", checkout: "2026-11-12", estado: "cancelada" },
];

describe("fechas", () => {
  it("cuenta noches sin depender de la hora ni del horario de verano", () => {
    expect(contarNoches("2026-11-10", "2026-11-13")).toBe(3);
    expect(contarNoches("2026-12-31", "2027-01-02")).toBe(2);
    expect(contarNoches("2026-11-13", "2026-11-10")).toBe(0);
    expect(contarNoches("", "2026-11-10")).toBe(0);
  });

  it("lista las noches ocupadas (el día de salida no cuenta)", () => {
    expect(nochesDeEstancia("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
  });

  it("suma días cruzando meses y años", () => {
    expect(sumarDias("2026-02-27", 2)).toBe("2026-03-01");
    expect(sumarDias("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("disponibilidad", () => {
  it("dos estancias se cruzan solo si comparten al menos una noche", () => {
    expect(seCruzan("2026-11-10", "2026-11-13", "2026-11-12", "2026-11-15")).toBe(true);
    // Uno sale el 13 y otro entra el 13: no hay cruce
    expect(seCruzan("2026-11-10", "2026-11-13", "2026-11-13", "2026-11-15")).toBe(false);
  });

  it("detecta conflictos ignorando canceladas y la propia reserva", () => {
    expect(conflictos(reservas, "101", "2026-11-12", "2026-11-14").map((r) => r.id)).toEqual(["a"]);
    expect(conflictos(reservas, "101", "2026-11-12", "2026-11-14", "a")).toEqual([]);
    expect(conflictos(reservas, "102", "2026-11-10", "2026-11-12")).toEqual([]);
  });

  it("permite varias reservas futuras en la misma habitación", () => {
    const libres = habitacionesLibres(habs, reservas, "2026-11-14", "2026-11-18").map((h) => h.numero);
    expect(libres).toEqual(["101", "102"]);
  });

  it("no ofrece habitaciones ocupadas, inactivas ni fechas inválidas", () => {
    expect(habitacionesLibres(habs, reservas, "2026-11-11", "2026-11-12").map((h) => h.numero)).toEqual(["102"]);
    expect(habitacionesLibres(habs, reservas, "2026-11-12", "2026-11-11")).toEqual([]);
  });

  it("encuentra la reserva de una noche", () => {
    expect(reservaEnNoche(reservas, "101", "2026-11-12")?.id).toBe("a");
    expect(reservaEnNoche(reservas, "101", "2026-11-13")).toBeNull();
  });

  it("muestra 'reservada' solo si alguien llega a una habitación libre", () => {
    expect(estadoVisual(habs[0], reservas, "2026-11-10")).toBe("reservada");
    expect(estadoVisual(habs[0], reservas, "2026-11-15")).toBe("disponible");
    expect(estadoVisual({ ...habs[0], estado: "limpieza" }, reservas, "2026-11-10")).toBe("limpieza");
  });
});
