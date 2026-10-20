import { useState } from "react";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { useReservas } from "../hooks/useReservas.jsx";
import { actualizarHabitacion } from "../firebase/firestore";
import { useToast } from "../hooks/useToast.jsx";
import { esActiva, hoyISO } from "../utils/disponibilidad";

// "reservada" no se guarda: se muestra cuando alguien llega hoy a una habitación libre
const ESTADOS = ["ocupada","disponible","limpieza","reservada","mantenimiento"];
const ESTADOS_FISICOS = ["disponible","ocupada","limpieza","mantenimiento"];
const ESTADO_LABEL = { ocupada:"Ocupada", disponible:"Disponible", limpieza:"Limpieza", reservada:"Llega hoy", mantenimiento:"Mantenimiento" };
const BADGE = { ocupada:"b-red", disponible:"b-green", limpieza:"b-amber", reservada:"b-blue", mantenimiento:"b-gray" };

export default function HabitacionesPage() {
  const { habitaciones, loading } = useHabitaciones();
  const { reservas } = useReservas();
  const { toast, ToastContainer } = useToast();
  const [selected, setSelected] = useState(null);
  const [filtro, setFiltro] = useState("todas");

  // Reserva en curso o la próxima llegada de la habitación
  const hoy = hoyISO();
  const getReservaActiva = (numero) =>
    reservas
      .filter((r) => r.habitacion === numero && esActiva(r) && r.checkout > hoy)
      .sort((a, b) => a.checkin.localeCompare(b.checkin))[0];


  const counts = ESTADOS.reduce((acc, e) => ({ ...acc, [e]: habitaciones.filter(h => h.estado === e).length }), {});
  const filtradas = filtro === "todas" ? habitaciones : habitaciones.filter(h => h.estado === filtro);

  const cambiarEstado = async (hab, nuevoEstado) => {
    await actualizarHabitacion(hab.id, { estado: nuevoEstado, ...(nuevoEstado === "disponible" ? { huesped: null } : {}) });
    toast(`Hab. ${hab.numero} → ${ESTADO_LABEL[nuevoEstado]} ✓`);
    setSelected(null);
  };

  return (
    <>
      <ToastContainer />

      {/* Modal detalle */}
      {selected && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Habitación {selected.numero} — {selected.tipo}</div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign:"center", marginBottom:20 }}>
                <div className={`room-cell ${selected.estado}`} style={{ display:"inline-block", width:100, padding:"18px 12px" }}>
                  <div className="room-num" style={{ fontSize:24 }}>{selected.numero}</div>
                  <div className="room-type">{selected.tipo}</div>
                </div>
              </div>
              {(() => {
                const res = getReservaActiva(selected.numero);
                const filas = [
                  ["Estado actual", <span className={`badge ${BADGE[selected.estado]}`}>{ESTADO_LABEL[selected.estado]}</span>],
                  ["Tipo", selected.tipo],
                  ["Piso", `Piso ${selected.piso}`],
                  ["Precio/noche", new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(selected.precio || 0)],
                ];
                if (res) {
                  if (res.checkin > hoy) filas.push(["Próxima llegada", res.checkin]);
                  filas.push(["Reservado por", <strong style={{ color:"var(--white)" }}>{res.nombre}</strong>]);
                  if (res.documento) filas.push(["Cédula", res.documento]);
                  if (res.telefono) filas.push(["Teléfono / WhatsApp", <span style={{ color:"var(--green)", fontWeight:700 }}>📱 {res.telefono}</span>]);
                  if (res.email) filas.push(["Email", <span style={{ fontSize:11 }}>{res.email}</span>]);
                  if (res.checkin) filas.push(["Check-in", res.checkin]);
                  if (res.checkout) filas.push(["Check-out", res.checkout]);
                } else if (selected.huesped) {
                  filas.push(["Huésped", selected.huesped]);
                }
                return filas.map(([k, v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", fontSize:13 }}>
                    <span style={{ color:"var(--muted)" }}>{k}</span><span>{v}</span>
                  </div>
                ));
              })()}
              <div style={{ marginTop:18 }}>
                <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Cambiar estado</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {ESTADOS_FISICOS.filter(e => e !== selected.estadoFisico).map(e => (
                    <button key={e} className={`btn btn-sm badge ${BADGE[e]}`} style={{ cursor:"pointer", fontWeight:600 }} onClick={() => cambiarEstado(selected, e)}>
                      → {ESTADO_LABEL[e]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 }}>
        {[
          { lbl:"Ocupadas",   val:counts.ocupada,    color:"var(--red)",   e:"ocupada" },
          { lbl:"Disponibles",val:counts.disponible, color:"var(--green)", e:"disponible" },
          { lbl:"En limpieza",val:counts.limpieza,   color:"var(--amber)", e:"limpieza" },
          { lbl:"Llegan hoy", val:counts.reservada,  color:"var(--blue)",  e:"reservada" },
        ].map(s => (
          <div key={s.lbl} className="stat-card" style={{ cursor:"pointer" }} onClick={() => setFiltro(filtro === s.e ? "todas" : s.e)}>
            <div className="stat-lbl">{s.lbl}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.val || 0}</div>
            <div className="stat-sub">De {habitaciones.length} total</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Mapa de habitaciones</div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {[{c:"rgba(231,76,60,0.5)",l:"Ocupada"},{c:"rgba(46,204,113,0.5)",l:"Libre"},{c:"rgba(243,156,18,0.5)",l:"Limpieza"},{c:"rgba(52,152,219,0.5)",l:"Llega hoy"},{c:"rgba(255,255,255,0.2)",l:"Mantenimiento"}].map(x=>(
                <div key={x.l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"var(--muted)" }}>
                  <div style={{ width:8,height:8,borderRadius:2,background:x.c }} />{x.l}
                </div>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setFiltro("todas")}>Ver todas</button>
          </div>
        </div>
        <div className="panel-body">
          {loading ? <div style={{ textAlign:"center", padding:24, color:"var(--muted)" }}>Cargando habitaciones...</div> : (
            <>
              {[...new Set(filtradas.map(h => h.piso))].sort((a, b) => a - b).map(piso => {
                const pisoHabs = filtradas.filter(h => h.piso === piso);
                if (!pisoHabs.length) return null;
                return (
                  <div key={piso} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10, paddingBottom:6, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                      Piso {piso}
                    </div>
                    <div className="rooms-grid" style={{ gridTemplateColumns:"repeat(auto-fill,minmax(88px,1fr))", gap:10 }}>
                      {pisoHabs.map(h => {
                        const res = getReservaActiva(h.numero);
                        return (
                          <div key={h.id} className={`room-cell ${h.estado}`} onClick={() => setSelected(h)} style={{ padding:"14px 8px" }}>
                            <div className="room-num" style={{ fontSize:17 }}>{h.numero}</div>
                            <div className="room-type">{h.tipo?.split(" ")[0]}</div>
                            {res ? (
                              <>
                                <div style={{ fontSize:8, marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"rgba(255,255,255,0.75)" }}>{res.nombre?.split(" ")[0]}</div>
                                {res.telefono && <div style={{ fontSize:7, marginTop:1, color:"rgba(100,255,100,0.8)" }}>📱{res.telefono}</div>}
                              </>
                            ) : h.huesped ? (
                              <div style={{ fontSize:8, marginTop:4, opacity:0.6, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.huesped}</div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </>
  );
}
