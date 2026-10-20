import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { useReservas } from "../hooks/useReservas.jsx";
import { suscribirIngresos, suscribirEgresos, suscribirAccesos } from "../firebase/firestore";

// ─── Utilidades ────────────────────────────────────────
const fmtMoney = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    .format(n || 0);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const isSameMonth = (ts) => {
  if (!ts?.toDate) return false;
  const d = ts.toDate();
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
};

const isSameDay = (ts) => {
  if (!ts?.toDate) return false;
  const d = ts.toDate();
  const now = new Date();
  return d.toDateString() === now.toDateString();
};

const initials = (n) =>
  n?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";

const badgeClass = {
  confirmada: "b-green", pendiente: "b-amber", checkin: "b-blue",
  checkout: "b-gray", cancelada: "b-red",
};
const badgeLabel = {
  confirmada: "Confirmada", pendiente: "Pendiente", checkin: "En estancia",
  checkout: "Check-out", cancelada: "Cancelada",
};

// ─── Tarjeta de estadística ────────────────────────────
function StatCard({ lbl, val, sub, color, prog }) {
  return (
    <div className="stat-card">
      <div className="stat-lbl">{lbl}</div>
      <div className="stat-val" style={color ? { color } : {}}>{val}</div>
      {prog != null && (
        <div className="prog"><div className="prog-fill" style={{ width: `${prog}%` }} /></div>
      )}
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════
//  PANEL ADMINISTRADOR
// ════════════════════════════════════════════════════════
function AdminPanel() {
  const { habitaciones } = useHabitaciones();
  const { reservas } = useReservas();
  const navigate = useNavigate();
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos] = useState([]);

  useEffect(() => {
    const u1 = suscribirIngresos(setIngresos);
    const u2 = suscribirEgresos(setEgresos);
    return () => { u1(); u2(); };
  }, []);

  const hoy = todayStr();
  const ocupadas   = habitaciones.filter((h) => h.estado === "ocupada").length;
  const disponibles = habitaciones.filter((h) => h.estado === "disponible").length;
  const limpieza   = habitaciones.filter((h) => h.estado === "limpieza").length;
  const reservadas = habitaciones.filter((h) => h.estado === "reservada").length;
  const total      = habitaciones.length || 1;
  const pct        = Math.round((ocupadas / total) * 100);

  const checkinHoy   = reservas.filter((r) => r.estado === "checkin" && r.checkin === hoy).length;
  const checkoutHoy  = reservas.filter((r) => r.estado === "checkout" && r.checkout === hoy).length;
  const reservasAct  = reservas.filter((r) => ["confirmada", "pendiente", "checkin"].includes(r.estado)).length;

  const ingresosHoy = ingresos.filter((i) => isSameDay(i.fecha)).reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const ingresosMes = ingresos.filter((i) => isSameMonth(i.fecha)).reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const egresosMes  = egresos.filter((e) => isSameMonth(e.fecha)).reduce((s, e) => s + (Number(e.monto) || 0), 0);
  const balance     = ingresosMes - egresosMes;

  const ultimosPagos = ingresos.slice(0, 5);

  return (
    <>
      {/* Hero */}
      <div style={{
        borderRadius: 16, background: "var(--bg3)", border: "1px solid rgba(255,255,255,0.06)",
        padding: "28px 32px", marginBottom: 20, display: "flex",
        alignItems: "center", justifyContent: "space-between", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle,rgba(155,89,182,0.09) 0%,transparent 65%)", pointerEvents: "none" }} />
        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9B59B6", marginBottom: 10 }}>
            Panel de Administración
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "var(--white)", marginBottom: 6, lineHeight: 1.1 }}>
            Resumen del negocio
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18 }}>
            Datos en tiempo real desde la base de datos
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-gold" onClick={() => navigate("/reservas")}>Ver reservas →</button>
            <button className="btn btn-outline" onClick={() => navigate("/reportes")}>Reportes</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, zIndex: 1 }}>
          {[
            { num: `${pct}%`, lbl: "Ocupación" },
            { num: fmtMoney(ingresosHoy), lbl: "Ingresos hoy" },
            { num: fmtMoney(balance), lbl: "Balance mes" },
          ].map((s) => (
            <div key={s.lbl} style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "#D4A843", lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Habitaciones */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Ocupación" val={`${pct}%`} color="var(--gold)" prog={pct} />
        <StatCard lbl="Disponibles" val={disponibles} sub={`De ${total} habitaciones`} color="var(--green)" />
        <StatCard lbl="En limpieza" val={limpieza} sub="Pendientes" color="var(--amber)" />
        <StatCard lbl="Llegan hoy" val={reservadas} sub="Pendientes de check-in" color="var(--blue)" />
      </div>

      {/* Reservas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Reservas activas" val={reservasAct} />
        <StatCard lbl="Check-ins hoy" val={checkinHoy} color="var(--blue)" />
        <StatCard lbl="Check-outs hoy" val={checkoutHoy} color="var(--muted)" />
        <StatCard lbl="Huéspedes activos" val={habitaciones.filter(h => h.estado === "ocupada").length} color="var(--red)" />
      </div>

      {/* Finanzas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Ingresos hoy" val={fmtMoney(ingresosHoy)} color="var(--gold)" />
        <StatCard lbl="Ingresos del mes" val={fmtMoney(ingresosMes)} color="var(--gold)" />
        <StatCard lbl="Egresos del mes" val={fmtMoney(egresosMes)} color="var(--red)" />
        <StatCard lbl="Balance" val={fmtMoney(balance)} color={balance >= 0 ? "var(--green)" : "var(--red)"} />
      </div>

      {/* Grid inferior */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Reservas recientes</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/reservas")}>Ver todas →</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Huésped</th><th>Hab.</th><th>Check-in</th><th>Check-out</th><th>Estado</th></tr></thead>
            <tbody>
              {reservas.slice(0, 6).map((r) => (
                <tr key={r.id}>
                  <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="av">{initials(r.nombre)}</div>{r.nombre}</div></td>
                  <td><span className="room-tag">{r.habitacion}</span></td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{r.checkin}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>{r.checkout}</td>
                  <td><span className={`badge ${badgeClass[r.estado] || "b-gray"}`}>{badgeLabel[r.estado] || r.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Últimos pagos</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/ingresos")}>Ver todos →</button>
            </div>
            <div className="panel-body">
              {ultimosPagos.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: 16 }}>Sin pagos registrados</div>
              ) : ultimosPagos.map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{i.descripcion || "Pago"}</div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>{i.metodo}</div>
                  </div>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--gold)", fontSize: 13 }}>
                    {fmtMoney(i.monto)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
//  PANEL RECEPCIONISTA
// ════════════════════════════════════════════════════════
function RecepcionistaPanel() {
  const { habitaciones } = useHabitaciones();
  const { reservas } = useReservas();
  const navigate = useNavigate();

  const hoy = todayStr();
  const ocupadas    = habitaciones.filter((h) => h.estado === "ocupada").length;
  const disponibles = habitaciones.filter((h) => h.estado === "disponible").length;
  const limpieza    = habitaciones.filter((h) => h.estado === "limpieza").length;
  const total       = habitaciones.length || 1;
  const pct         = Math.round((ocupadas / total) * 100);

  const reservasHoy   = reservas.filter((r) => r.checkin === hoy).length;
  const proximosCI    = reservas.filter((r) => r.estado === "confirmada" || r.estado === "pendiente");
  const checkoutPend  = reservas.filter((r) => r.estado === "checkin" && r.checkout === hoy);
  const activos       = reservas.filter((r) => r.estado === "checkin").length;
  const sinConfirmar  = reservas.filter((r) => r.estado === "pendiente").length;

  return (
    <>
      {/* Hero */}
      <div style={{
        borderRadius: 16, background: "var(--bg3)", border: "1px solid rgba(255,255,255,0.06)",
        padding: "36px 40px", marginBottom: 20, position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ position: "absolute", right: -40, top: -40, width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle,rgba(212,168,67,0.07) 0%,transparent 65%)", pointerEvents: "none" }} />
        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 12 }}>
            Operación del día
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 800, lineHeight: 1.05, color: "var(--white)", marginBottom: 6 }}>
            Bienvenido al<br /><span style={{ color: "var(--gold)" }}>sistema Hostly</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20 }}>
            Gestiona reservas, huéspedes y habitaciones en tiempo real.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-gold" onClick={() => navigate("/reservas")}>Nueva reserva →</button>
            <button className="btn btn-outline" onClick={() => navigate("/habitaciones")}>Ver habitaciones</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end", zIndex: 1 }}>
          {[
            { num: `${pct}%`, lbl: "Ocupación" },
            { num: disponibles, lbl: "Disponibles" },
            { num: activos, lbl: "En estancia" },
          ].map((s) => (
            <div key={s.lbl} style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "var(--gold)", lineHeight: 1 }}>{s.num}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Ocupación" val={`${pct}%`} color="var(--gold)" prog={pct} />
        <StatCard lbl="Disponibles" val={disponibles} sub={`De ${total} total`} />
        <StatCard lbl="En limpieza" val={limpieza} color="var(--amber)" />
        <StatCard lbl="Check-outs hoy" val={checkoutPend.length} color={checkoutPend.length > 0 ? "var(--red)" : undefined} sub="Pendientes" />
        <StatCard lbl="Sin confirmar" val={sinConfirmar} color={sinConfirmar > 0 ? "var(--amber)" : undefined} />
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
        <div>
          {checkoutPend.length > 0 && (
            <div className="notif notif-red" style={{ marginBottom: 12 }}>
              <span className="notif-icon">⏰</span>
              <div>
                <div className="notif-title">{checkoutPend.length} check-out{checkoutPend.length > 1 ? "s" : ""} pendiente{checkoutPend.length > 1 ? "s" : ""} hoy</div>
                <div className="notif-text">{checkoutPend.map(r => `Hab. ${r.habitacion} — ${r.nombre}`).join(" · ")}</div>
              </div>
            </div>
          )}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Próximos check-ins</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/checkin")}>Ver todos →</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Huésped</th><th>Hab.</th><th>Check-in</th><th>Check-out</th><th>Estado</th></tr></thead>
              <tbody>
                {proximosCI.slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div className="av">{initials(r.nombre)}</div>{r.nombre}</div></td>
                    <td><span className="room-tag">{r.habitacion}</span></td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{r.checkin}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{r.checkout}</td>
                    <td><span className={`badge ${badgeClass[r.estado] || "b-gray"}`}>{badgeLabel[r.estado] || r.estado}</span></td>
                  </tr>
                ))}
                {proximosCI.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 16, fontSize: 12 }}>Sin check-ins pendientes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Mapa rápido</div>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate("/habitaciones")}>Ver mapa →</button>
            </div>
            <div className="panel-body">
              <div className="rooms-grid">
                {habitaciones.slice(0, 12).map((h) => (
                  <div key={h.id} className={`room-cell ${h.estado}`} onClick={() => navigate("/habitaciones")}>
                    <div className="room-num">{h.numero}</div>
                    <div className="room-type">{h.tipo?.split(" ")[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
//  PANEL CONTADOR
// ════════════════════════════════════════════════════════
function ContadorPanel() {
  const { reservas } = useReservas();
  const navigate = useNavigate();
  const [ingresos, setIngresos] = useState([]);
  const [egresos, setEgresos]   = useState([]);

  useEffect(() => {
    const u1 = suscribirIngresos(setIngresos);
    const u2 = suscribirEgresos(setEgresos);
    return () => { u1(); u2(); };
  }, []);

  const ingresosHoy = ingresos.filter((i) => isSameDay(i.fecha)).reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const ingresosMes = ingresos.filter((i) => isSameMonth(i.fecha)).reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const egresosMes  = egresos.filter((e) => isSameMonth(e.fecha)).reduce((s, e) => s + (Number(e.monto) || 0), 0);
  const balance     = ingresosMes - egresosMes;

  const metodosMap = ingresos.reduce((acc, i) => {
    const m = i.metodo || "Otro";
    acc[m] = (acc[m] || 0) + (Number(i.monto) || 0);
    return acc;
  }, {});

  const reservasCobradas = reservas.filter((r) => r.estado === "checkout").length;
  const reservasPendientes = reservas.filter((r) => ["confirmada", "pendiente", "checkin"].includes(r.estado)).length;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "var(--white)", marginBottom: 4 }}>
          Panel Financiero
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Datos en tiempo real desde la base de datos</div>
      </div>

      {/* Stats principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Ingresos hoy" val={fmtMoney(ingresosHoy)} color="var(--gold)" />
        <StatCard lbl="Ingresos del mes" val={fmtMoney(ingresosMes)} color="var(--gold)" />
        <StatCard lbl="Egresos del mes" val={fmtMoney(egresosMes)} color="var(--red)" />
        <StatCard lbl="Balance" val={fmtMoney(balance)} color={balance >= 0 ? "var(--green)" : "var(--red)"} sub={balance >= 0 ? "Positivo" : "Negativo"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Total registros ingresos" val={ingresos.length} />
        <StatCard lbl="Reservas cobradas" val={reservasCobradas} color="var(--green)" />
        <StatCard lbl="Reservas activas" val={reservasPendientes} color="var(--amber)" />
        <StatCard lbl="Total egresos registrados" val={egresos.length} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        {/* Últimas transacciones */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Últimos ingresos</div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/ingresos")}>Ver todos →</button>
          </div>
          <table className="data-table">
            <thead><tr><th>Descripción</th><th>Hab.</th><th>Método</th><th>Monto</th></tr></thead>
            <tbody>
              {ingresos.slice(0, 8).map((i) => (
                <tr key={i.id}>
                  <td>{i.descripcion || "—"}</td>
                  <td>{i.habitacion ? <span className="room-tag">{i.habitacion}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td><span className="badge b-gray">{i.metodo}</span></td>
                  <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--gold)" }}>{fmtMoney(i.monto)}</td>
                </tr>
              ))}
              {ingresos.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 16, fontSize: 12 }}>Sin ingresos registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Métodos de pago */}
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Métodos de pago</div></div>
          <div className="panel-body">
            {Object.entries(metodosMap).length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: 16 }}>Sin datos</div>
            ) : Object.entries(metodosMap).sort((a, b) => b[1] - a[1]).map(([metodo, total]) => (
              <div key={metodo} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--muted)" }}>{metodo}</span>
                  <span style={{ fontWeight: 600, color: "var(--gold)" }}>{fmtMoney(total)}</span>
                </div>
                <div className="prog">
                  <div className="prog-fill" style={{ width: `${Math.round((total / (ingresosMes || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
//  PANEL SERVICIO / HOUSEKEEPING
// ════════════════════════════════════════════════════════
function ServicioPanel() {
  const { habitaciones } = useHabitaciones();
  const navigate = useNavigate();

  const limpieza    = habitaciones.filter((h) => h.estado === "limpieza");
  const disponibles = habitaciones.filter((h) => h.estado === "disponible").length;
  const ocupadas    = habitaciones.filter((h) => h.estado === "ocupada").length;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "var(--white)", marginBottom: 4 }}>
          Panel de Servicio
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Estado actual de habitaciones</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Por limpiar" val={limpieza.length} color="var(--amber)" sub="Pendientes" />
        <StatCard lbl="Disponibles" val={disponibles} color="var(--green)" sub="Listas para ocupar" />
        <StatCard lbl="Ocupadas" val={ocupadas} color="var(--red)" sub="No tocar" />
      </div>

      {limpieza.length > 0 && (
        <div className="notif notif-gold" style={{ marginBottom: 16 }}>
          <span className="notif-icon">🧹</span>
          <div>
            <div className="notif-title">{limpieza.length} habitación{limpieza.length > 1 ? "es" : ""} pendiente{limpieza.length > 1 ? "s" : ""} de limpieza</div>
            <div className="notif-text">{limpieza.map(h => `Hab. ${h.numero}`).join(" · ")}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title" style={{ color: "var(--amber)" }}>⬡ Habitaciones por limpiar</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/servicio")}>Ver detalle →</button>
        </div>
        <div className="panel-body">
          {limpieza.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>✅</div>
              Todo limpio — sin pendientes
            </div>
          ) : (
            <div className="rooms-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(80px,1fr))", gap: 8 }}>
              {limpieza.map((h) => (
                <div key={h.id} className="room-cell limpieza">
                  <div className="room-num">{h.numero}</div>
                  <div className="room-type">{h.tipo?.split(" ")[0]}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
//  PANEL VIGILANTE
// ════════════════════════════════════════════════════════
function VigilantePanel() {
  const { habitaciones } = useHabitaciones();
  const { reservas } = useReservas();
  const navigate = useNavigate();
  const [accesos, setAccesos] = useState([]);

  useEffect(() => {
    const unsub = suscribirAccesos(setAccesos);
    return () => unsub();
  }, []);

  const hoy = new Date();
  const accesosHoy = accesos.filter((a) => {
    const d = a.hora?.toDate?.();
    return d && d.toDateString() === hoy.toDateString();
  });
  const alertas = accesos.filter((a) => a.estado === "alerta");
  const entradasHoy = accesosHoy.filter((a) => a.tipo === "Entrada").length;
  const salidasHoy  = accesosHoy.filter((a) => a.tipo === "Salida").length;
  const ocupadas    = habitaciones.filter((h) => h.estado === "ocupada").length;
  const activos     = reservas.filter((r) => r.estado === "checkin").length;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, color: "var(--white)", marginBottom: 4 }}>
          Panel de Seguridad
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Control de acceso en tiempo real</div>
      </div>

      {alertas.length > 0 && (
        <div className="notif notif-red" style={{ marginBottom: 16 }}>
          <span className="notif-icon">⚠️</span>
          <div>
            <div className="notif-title">{alertas.length} alerta{alertas.length > 1 ? "s" : ""} de acceso activa{alertas.length > 1 ? "s" : ""}</div>
            <div className="notif-text">Revisa el registro de accesos inmediatamente.</div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Huéspedes activos" val={activos} color="var(--blue)" />
        <StatCard lbl="Entradas hoy" val={entradasHoy} color="var(--green)" />
        <StatCard lbl="Salidas hoy" val={salidasHoy} color="var(--muted)" />
        <StatCard lbl="Alertas" val={alertas.length} color={alertas.length > 0 ? "var(--red)" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard lbl="Habitaciones ocupadas" val={ocupadas} color="var(--red)" />
        <StatCard lbl="Accesos hoy" val={accesosHoy.length} />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Últimos accesos</div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/accesos")}>Ver registro →</button>
        </div>
        <table className="data-table">
          <thead><tr><th>Persona</th><th>Hab.</th><th>Tipo</th><th>Estado</th></tr></thead>
          <tbody>
            {accesos.slice(0, 6).map((a) => (
              <tr key={a.id} style={{ background: a.estado === "alerta" ? "rgba(231,76,60,0.04)" : "transparent" }}>
                <td style={{ fontWeight: 500 }}>{a.nombre}</td>
                <td>{a.habitacion ? <span className="room-tag">{a.habitacion}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                <td><span className={`badge ${a.tipo === "Entrada" ? "b-green" : a.tipo === "Salida" ? "b-gray" : a.tipo === "Intento" ? "b-red" : "b-blue"}`}>{a.tipo}</span></td>
                <td>{a.estado === "ok" ? <span className="badge b-green">✓ OK</span> : <span className="badge b-red">⚠ Alerta</span>}</td>
              </tr>
            ))}
            {accesos.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 16, fontSize: 12 }}>Sin registros de acceso</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL — selecciona panel por rol
// ════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { usuario } = useAuth();
  const rol = usuario?.rol;

  if (rol === "admin")         return <AdminPanel />;
  if (rol === "contador")      return <ContadorPanel />;
  if (rol === "servicio")      return <ServicioPanel />;
  if (rol === "vigilante")     return <VigilantePanel />;
  return <RecepcionistaPanel />;
}
