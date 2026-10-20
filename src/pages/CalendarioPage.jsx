// ==========================================
// HOSTLY — Calendario de habitaciones (rack)
// Filas: habitaciones · Columnas: noches
// ==========================================
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { useReservas } from "../hooks/useReservas.jsx";
import { hoyISO, sumarDias, reservaEnNoche } from "../utils/disponibilidad";
import { formatCOP } from "../utils/dateMoney";

const DIAS_VISTA = 14;

const COLOR_RESERVA = {
  confirmada: { bg: "rgba(52,152,219,0.22)", border: "rgba(52,152,219,0.5)", txt: "#8CC8F0" },
  pendiente:  { bg: "rgba(243,156,18,0.2)",  border: "rgba(243,156,18,0.5)", txt: "#F5C26B" },
  checkin:    { bg: "rgba(231,76,60,0.22)",  border: "rgba(231,76,60,0.5)",  txt: "#F19A90" },
};

const ESTADO_FISICO = {
  limpieza: { color: "var(--amber)", label: "En limpieza" },
  mantenimiento: { color: "var(--muted)", label: "Mantenimiento" },
  ocupada: { color: "var(--red)", label: "Ocupada" },
};

const fmtDia = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  return {
    semana: f.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", ""),
    dia: d,
    mes: f.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""),
    finde: f.getDay() === 0 || f.getDay() === 6,
  };
};

export default function CalendarioPage() {
  const navigate = useNavigate();
  const { habitaciones, loading } = useHabitaciones();
  const { reservas } = useReservas();
  const hoy = hoyISO();
  const [inicio, setInicio] = useState(hoy);
  const [detalle, setDetalle] = useState(null);

  const dias = useMemo(
    () => Array.from({ length: DIAS_VISTA }, (_, i) => sumarDias(inicio, i)),
    [inicio]
  );

  const ocupacionDia = (noche) => {
    if (!habitaciones.length) return 0;
    const n = habitaciones.filter((h) => reservaEnNoche(reservas, h.numero, noche)).length;
    return Math.round((n / habitaciones.length) * 100);
  };

  const clickCelda = (hab, noche, res) => {
    if (res) {
      setDetalle(res);
    } else if (noche >= hoy) {
      navigate(`/reservas?nueva=1&hab=${encodeURIComponent(hab.numero)}&ci=${noche}&co=${sumarDias(noche, 1)}`);
    }
  };

  return (
    <>
      {detalle && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDetalle(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">{detalle.nombre}</div>
              <button className="modal-close" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <div className="modal-body">
              {[
                ["Habitación", detalle.habitacion],
                ["Llegada", detalle.checkin],
                ["Salida", detalle.checkout],
                ["Noches", detalle.noches],
                ["Huéspedes", detalle.huespedes],
                ["Documento", detalle.documento || "—"],
                ["Teléfono", detalle.telefono || "—"],
                ["Total", formatCOP(detalle.total)],
                ["Estado", detalle.estado === "checkin" ? "En estancia" : detalle.estado],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                  <span style={{ color: "var(--muted)" }}>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setDetalle(null)}>Cerrar</button>
              {detalle.estado === "checkin" ? (
                <button className="btn btn-gold btn-sm" onClick={() => navigate("/checkout")}>Ir a check-out</button>
              ) : (
                <button className="btn btn-gold btn-sm" onClick={() => navigate("/checkin")}>Ir a check-in</button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Calendario de habitaciones</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-outline btn-sm" onClick={() => setInicio(sumarDias(inicio, -7))}>← Semana</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setInicio(hoy)}>Hoy</button>
            <button className="btn btn-outline btn-sm" onClick={() => setInicio(sumarDias(inicio, 7))}>Semana →</button>
            <input
              type="date"
              className="form-input"
              style={{ width: 150, padding: "5px 10px", fontSize: 12 }}
              value={inicio}
              onChange={(e) => e.target.value && setInicio(e.target.value)}
            />
          </div>
        </div>

        <div style={{ padding: "10px 20px 0", display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "var(--muted)" }}>
          {[["confirmada", "Reservada"], ["pendiente", "Pendiente"], ["checkin", "En estancia"]].map(([k, l]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR_RESERVA[k].bg, border: `1px solid ${COLOR_RESERVA[k].border}` }} />{l}
            </span>
          ))}
          <span>Clic en una casilla libre para reservar.</span>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Cargando...</div>
        ) : habitaciones.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            No hay habitaciones. El administrador las crea en Configuración.
          </div>
        ) : (
          <div style={{ overflowX: "auto", padding: "12px 20px 20px" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 0, fontSize: 11, minWidth: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...st.habCol, ...st.th }}>Hab.</th>
                  {dias.map((d) => {
                    const f = fmtDia(d);
                    return (
                      <th key={d} style={{ ...st.th, ...st.dayCol, color: d === hoy ? "var(--gold)" : f.finde ? "var(--text)" : "var(--muted)" }}>
                        <div style={{ textTransform: "capitalize" }}>{f.semana}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{f.dia}</div>
                        <div style={{ fontSize: 9 }}>{f.mes}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {habitaciones.map((h) => (
                  <tr key={h.id}>
                    <td style={st.habCol}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="room-tag">{h.numero}</span>
                        {ESTADO_FISICO[h.estadoFisico] && (
                          <span title={ESTADO_FISICO[h.estadoFisico].label} style={{ width: 7, height: 7, borderRadius: "50%", background: ESTADO_FISICO[h.estadoFisico].color }} />
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>{h.tipo}</div>
                    </td>
                    {dias.map((d, i) => {
                      const res = reservaEnNoche(reservas, h.numero, d);
                      const inicioBloque = res && (res.checkin === d || i === 0);
                      const c = res ? COLOR_RESERVA[res.estado] : null;
                      const pasado = d < hoy;
                      return (
                        <td
                          key={d}
                          onClick={() => clickCelda(h, d, res)}
                          title={res ? `${res.nombre} · ${res.checkin} → ${res.checkout}` : pasado ? "" : "Reservar"}
                          style={{
                            ...st.cell,
                            background: c ? c.bg : d === hoy ? "rgba(212,168,67,0.04)" : "transparent",
                            borderTop: c ? `1px solid ${c.border}` : st.cell.borderTop,
                            borderBottom: c ? `1px solid ${c.border}` : st.cell.borderBottom,
                            borderLeft: inicioBloque ? `2px solid ${c.border}` : st.cell.borderLeft,
                            cursor: res || !pasado ? "pointer" : "default",
                            opacity: pasado && !res ? 0.4 : 1,
                          }}
                        >
                          {inicioBloque && (
                            <span style={{ color: c.txt, fontWeight: 600, whiteSpace: "nowrap" }}>
                              {res.nombre?.split(" ")[0]}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ ...st.habCol, color: "var(--muted)", fontSize: 10 }}>Ocupación</td>
                  {dias.map((d) => (
                    <td key={d} style={{ textAlign: "center", fontSize: 10, color: "var(--muted)", paddingTop: 8 }}>
                      {ocupacionDia(d)}%
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

const st = {
  th: { padding: "6px 4px", fontWeight: 500, textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  habCol: {
    position: "sticky", left: 0, zIndex: 1, background: "var(--bg3)",
    padding: "6px 10px 6px 0", minWidth: 90, textAlign: "left",
  },
  dayCol: { minWidth: 58 },
  cell: {
    height: 38, minWidth: 58, padding: "0 6px", overflow: "hidden",
    borderTop: "1px solid rgba(255,255,255,0.03)",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    borderLeft: "1px solid rgba(255,255,255,0.03)",
  },
};
