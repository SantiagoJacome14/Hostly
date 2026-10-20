// Hook para suscribirse a habitaciones en tiempo real.
// `estado` es el que se muestra (incluye "reservada" si alguien llega hoy);
// `estadoFisico` es el guardado en la base de datos.
import { useEffect, useMemo, useState } from "react";
import { suscribirHabitaciones } from "../firebase/firestore";
import { useReservas } from "./useReservas.jsx";
import { estadoVisual } from "../utils/disponibilidad";

export const useHabitaciones = ({ incluirInactivas = false } = {}) => {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { reservas } = useReservas();

  useEffect(() => {
    const unsub = suscribirHabitaciones((data) => {
      setDatos(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const habitaciones = useMemo(
    () =>
      datos
        .filter((h) => incluirInactivas || h.activa !== false)
        .map((h) => ({ ...h, estadoFisico: h.estado, estado: estadoVisual(h, reservas) }))
        .sort((a, b) => String(a.numero).localeCompare(String(b.numero), "es", { numeric: true })),
    [datos, reservas, incluirInactivas]
  );

  return { habitaciones, loading };
};
