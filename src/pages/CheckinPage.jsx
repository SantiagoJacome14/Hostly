import { useReservas } from "../hooks/useReservas.jsx";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { useAuth } from "../context/AuthContext";
import { hacerCheckin } from "../firebase/firestore";
import { useToast } from "../hooks/useToast.jsx";
import { hoyISO } from "../utils/disponibilidad";

const initials = (n) => n?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";

export default function CheckinPage() {
  const { reservas } = useReservas();
  const { habitaciones } = useHabitaciones();
  const { usuario } = useAuth();
  const { toast, ToastContainer } = useToast();
  const hoy = hoyISO();
  // Primero las llegadas de hoy (o atrasadas), luego las futuras
  const pendientes = reservas
    .filter((r) => r.estado === "confirmada" || r.estado === "pendiente")
    .sort((a, b) => a.checkin.localeCompare(b.checkin));

  const doCheckin = async (res) => {
    const hab = habitaciones.find((h) => h.numero === res.habitacion);
    if (hab && hab.estadoFisico === "ocupada") {
      toast(`La habitación ${res.habitacion} todavía figura ocupada (${hab.huesped || "otro huésped"}). Haz primero su check-out.`);
      return;
    }
    try {
      await hacerCheckin(res, hab, usuario);
      toast(`✓ Check-in completado — ${res.nombre}, Hab. ${res.habitacion}`);
    } catch (err) {
      console.error(err);
      toast("Error al hacer check-in");
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <ToastContainer />
      <div className="notif notif-gold">
        <span className="notif-icon">🛎️</span>
        <div><div className="notif-title">Proceso de Check-in</div><div className="notif-text">Verifica el documento del huésped y confirma su llegada. El estado de la habitación se actualiza automáticamente en tiempo real.</div></div>
      </div>
      <div className="panel">
        <div className="panel-header"><div className="panel-title">Reservas listas para check-in ({pendientes.length})</div></div>
        <div className="panel-body">
          {pendientes.length === 0 ? (
            <div style={{ textAlign:"center", padding:24, color:"var(--muted)", fontSize:13 }}>No hay reservas pendientes de check-in.</div>
          ) : pendientes.map((r) => (
            <div key={r.id} style={{ background:"var(--bg4)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:10, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <div className="av" style={{ width:38, height:38, fontSize:13 }}>{initials(r.nombre)}</div>
                <div>
                  <div style={{ fontWeight:600, fontSize:14, color:"var(--white)" }}>{r.nombre}</div>
                  <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>Hab. {r.habitacion} · {r.checkin} → {r.checkout}</div>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span className={`badge ${r.estado === "confirmada" ? "b-green" : "b-amber"}`}>{r.estado}</span>
                {r.checkin > hoy ? (
                  <span style={{ fontSize:11, color:"var(--muted)" }}>Llega el {r.checkin}</span>
                ) : (
                  <button className="btn btn-gold btn-sm" onClick={() => doCheckin(r)}>Hacer check-in</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
