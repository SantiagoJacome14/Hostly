import { useState, useEffect, useMemo } from "react";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { useReservas } from "../hooks/useReservas.jsx";
import {
  suscribirIngresos,
  suscribirEgresos,
  suscribirPagosEmpleados,
  suscribirHistorial,
} from "../firebase/firestore";
import { formatCOP, sumBy, toDateSafe, inDateRange, isSameMonth, avgBy } from "../utils/dateMoney";
import { exportCsv } from "../utils/exportCsv";
import { useToast } from "../hooks/useToast.jsx";

// Preset de fechas
const hoy         = new Date();
const primerDelMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-01`;
const hoyStr      = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`;

const TIPOS_REPORTE = [
  { value: "general",       label: "General" },
  { value: "financiero",    label: "Financiero" },
  { value: "ocupacion",     label: "Ocupación" },
  { value: "reservas",      label: "Reservas" },
  { value: "empleados",     label: "Pagos empleados" },
  { value: "egresos",       label: "Egresos" },
];

// ── Barra de progreso simple ──
function BarraProgreso({ valor, max, color = "var(--gold)" }) {
  const pct = max > 0 ? Math.min(100, Math.round((valor / max) * 100)) : 0;
  return (
    <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .3s" }} />
    </div>
  );
}

export default function ReportesPage() {
  const { habitaciones } = useHabitaciones();
  const { reservas }     = useReservas();
  const { toast, ToastContainer } = useToast();

  const [ingresos,        setIngresos]        = useState([]);
  const [egresos,         setEgresos]         = useState([]);
  const [pagosEmpleados,  setPagosEmpleados]  = useState([]);
  const [historial,       setHistorial]       = useState([]);

  const [desde,       setDesde]       = useState(primerDelMes);
  const [hasta,       setHasta]       = useState(hoyStr);
  const [tipoReporte, setTipoReporte] = useState("general");

  useEffect(() => {
    const u1 = suscribirIngresos(setIngresos);
    const u2 = suscribirEgresos(setEgresos);
    const u3 = suscribirPagosEmpleados(setPagosEmpleados);
    const u4 = suscribirHistorial(setHistorial);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  // ── Datos filtrados por rango de fechas ──
  const ingresosFiltrados = useMemo(
    () => ingresos.filter((i) => inDateRange(i.fecha, desde, hasta)),
    [ingresos, desde, hasta]
  );
  const egresosFiltrados = useMemo(
    () => egresos.filter((e) => inDateRange(e.fecha, desde, hasta)),
    [egresos, desde, hasta]
  );
  const pagosFiltrados = useMemo(
    () => pagosEmpleados.filter((p) => inDateRange(p.fecha, desde, hasta)),
    [pagosEmpleados, desde, hasta]
  );
  const historialFiltrado = useMemo(
    () => historial.filter((h) => inDateRange(h.creadoEn, desde, hasta)),
    [historial, desde, hasta]
  );
  const reservasFiltradas = useMemo(
    () => reservas.filter((r) => {
      if (!desde && !hasta) return true;
      if (desde && r.checkin < desde) return false;
      if (hasta && r.checkout > hasta) return false;
      return true;
    }),
    [reservas, desde, hasta]
  );

  // ── Métricas de habitaciones ──
  const habOcupadas    = habitaciones.filter((h) => h.estado === "ocupada").length;
  const habDisponibles = habitaciones.filter((h) => h.estado === "disponible").length;
  const habLimpieza    = habitaciones.filter((h) => h.estado === "limpieza").length;
  const habReservadas  = habitaciones.filter((h) => h.estado === "reservada").length;
  const habTotal       = habitaciones.length || 1;
  const pctOcupacion   = Math.round((habOcupadas / habTotal) * 100);

  // ── Métricas financieras ──
  const totalIngresos   = sumBy(ingresosFiltrados, "monto");
  const totalEgresos    = sumBy(egresosFiltrados,  "monto");
  const totalPagos      = sumBy(pagosFiltrados,     "monto");
  const totalGastos     = totalEgresos + totalPagos;
  const balance         = totalIngresos - totalGastos;

  // ── Métricas de reservas ──
  const reservasCompletadas  = reservasFiltradas.filter((r) => r.estado === "checkout").length;
  const reservasCanceladas   = reservasFiltradas.filter((r) => r.estado === "cancelada").length;
  const reservasActivas      = reservasFiltradas.filter((r) => ["checkin","confirmada","pendiente"].includes(r.estado)).length;
  const promNochesHistorial  = historialFiltrado.length
    ? (historialFiltrado.reduce((s, h) => s + (h.noches || 0), 0) / historialFiltrado.length).toFixed(1)
    : "—";

  // ── Métodos de pago (ingresos) ──
  const metodosPago = ingresosFiltrados.reduce((acc, i) => {
    const m = i.metodo || "Otro";
    acc[m] = (acc[m] || 0) + (Number(i.monto) || 0);
    return acc;
  }, {});

  // ── Tipos de habitación ──
  const tipoStats = habitaciones.reduce((acc, h) => {
    const t = h.tipo || "Otro";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  // ── Categorías de egresos ──
  const categoriasEgreso = egresosFiltrados.reduce((acc, e) => {
    const c = e.categoria || "Otros";
    acc[c] = (acc[c] || 0) + (Number(e.monto) || 0);
    return acc;
  }, {});

  // ── CSV exporters ──
  const exportarIngresos = () => {
    const ok = exportCsv({
      filename: `ingresos_${desde}_${hasta}.csv`,
      columns: [
        { label: "Fecha",       key: "fecha",       transform: (v) => toDateSafe(v)?.toLocaleDateString("es-CO") || "—" },
        { label: "Descripción", key: "descripcion" },
        { label: "Habitación",  key: "habitacion" },
        { label: "Método",      key: "metodo" },
        { label: "Monto COP",   key: "monto" },
        { label: "Registrado por", key: "registradoPor" },
      ],
      rows: ingresosFiltrados,
    });
    if (!ok) toast("No hay ingresos para exportar en el período seleccionado");
  };

  const exportarEgresos = () => {
    const ok = exportCsv({
      filename: `egresos_${desde}_${hasta}.csv`,
      columns: [
        { label: "Fecha",       key: "fecha",       transform: (v) => toDateSafe(v)?.toLocaleDateString("es-CO") || "—" },
        { label: "Concepto",    key: "concepto" },
        { label: "Categoría",   key: "categoria" },
        { label: "Método",      key: "metodo" },
        { label: "Monto COP",   key: "monto" },
        { label: "Registrado por", key: "registradoPor" },
      ],
      rows: egresosFiltrados,
    });
    if (!ok) toast("No hay egresos para exportar en el período seleccionado");
  };

  const exportarPagos = () => {
    const ok = exportCsv({
      filename: `pagos_empleados_${desde}_${hasta}.csv`,
      columns: [
        { label: "Fecha",       key: "fecha",       transform: (v) => toDateSafe(v)?.toLocaleDateString("es-CO") || "—" },
        { label: "Empleado",    key: "nombreEmpleado" },
        { label: "Concepto",    key: "concepto" },
        { label: "Método",      key: "metodo" },
        { label: "Monto COP",   key: "monto" },
        { label: "Registrado por", key: "registradoPor" },
      ],
      rows: pagosFiltrados,
    });
    if (!ok) toast("No hay pagos para exportar en el período seleccionado");
  };

  const exportarBalance = () => {
    const filas = [
      { concepto: "INGRESOS",               tipo: "—",         monto: totalIngresos  },
      ...ingresosFiltrados.map((i) => ({ concepto: i.descripcion || "Ingreso", tipo: "Ingreso", monto: i.monto, fecha: toDateSafe(i.fecha)?.toLocaleDateString("es-CO") })),
      { concepto: "EGRESOS GENERALES",       tipo: "—",        monto: totalEgresos   },
      ...egresosFiltrados.map((e) => ({ concepto: e.concepto || "Egreso", tipo: "Egreso", monto: e.monto, fecha: toDateSafe(e.fecha)?.toLocaleDateString("es-CO") })),
      { concepto: "PAGOS EMPLEADOS",         tipo: "—",        monto: totalPagos     },
      ...pagosFiltrados.map((p) => ({ concepto: p.nombreEmpleado || "Empleado", tipo: "Pago", monto: p.monto, fecha: toDateSafe(p.fecha)?.toLocaleDateString("es-CO") })),
      { concepto: "BALANCE FINAL",           tipo: "—",        monto: balance        },
    ];
    const ok = exportCsv({
      filename: `balance_${desde}_${hasta}.csv`,
      columns: [
        { label: "Concepto", key: "concepto" },
        { label: "Tipo",     key: "tipo" },
        { label: "Fecha",    key: "fecha" },
        { label: "Monto COP", key: "monto" },
      ],
      rows: filas,
    });
    if (!ok) toast("No hay datos para exportar en el período seleccionado");
  };

  const mostrarSeccion = (tipo) =>
    tipoReporte === "general" || tipoReporte === tipo;

  return (
    <>
      <ToastContainer />

      {/* Filtros */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title">Filtros del reporte</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setDesde(primerDelMes); setHasta(hoyStr); }}>
              Mes actual
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setDesde(""); setHasta(""); }}>
              Sin filtro
            </button>
          </div>
        </div>
        <div className="panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 12, alignItems: "end" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Desde</label>
              <input className="form-input" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Hasta</label>
              <input className="form-input" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tipo de reporte</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TIPOS_REPORTE.map((t) => (
                  <div
                    key={t.value}
                    className={`chip ${tipoReporte === t.value ? "active" : ""}`}
                    onClick={() => setTipoReporte(t.value)}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RESUMEN GENERAL ── */}
      {mostrarSeccion("financiero") && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-lbl">Ingresos período</div>
              <div className="stat-val gold">{formatCOP(totalIngresos)}</div>
              <div className="stat-sub">{ingresosFiltrados.length} registros</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Egresos + pagos</div>
              <div className="stat-val" style={{ color: "var(--red)" }}>{formatCOP(totalGastos)}</div>
              <div className="stat-sub">{egresosFiltrados.length + pagosFiltrados.length} registros</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Balance</div>
              <div className="stat-val" style={{ color: balance >= 0 ? "var(--green)" : "var(--red)" }}>
                {formatCOP(balance)}
              </div>
              <div className="stat-sub">{balance >= 0 ? "Positivo" : "Negativo"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Pagos empleados</div>
              <div className="stat-val" style={{ color: "var(--blue)" }}>{formatCOP(totalPagos)}</div>
              <div className="stat-sub">{pagosFiltrados.length} pagos</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginBottom: 20 }}>
            {/* Ingresos por método */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Ingresos por método de pago</div>
                <button className="btn btn-ghost btn-sm" onClick={exportarIngresos}>↓ CSV Ingresos</button>
              </div>
              <div className="panel-body">
                {Object.entries(metodosPago).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20, color: "var(--muted)", fontSize: 12 }}>
                    Sin ingresos en el período seleccionado
                  </div>
                ) : Object.entries(metodosPago).sort((a, b) => b[1] - a[1]).map(([metodo, monto]) => (
                  <div key={metodo} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                      <span style={{ color: "var(--muted)" }}>{metodo}</span>
                      <span style={{ fontWeight: 600, color: "var(--gold)" }}>{formatCOP(monto)}</span>
                    </div>
                    <BarraProgreso valor={monto} max={totalIngresos} />
                  </div>
                ))}
              </div>
            </div>

            {/* Egresos por categoría */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">Egresos por categoría</div>
                <button className="btn btn-ghost btn-sm" onClick={exportarEgresos}>↓ CSV</button>
              </div>
              <div className="panel-body">
                {Object.entries(categoriasEgreso).length === 0 ? (
                  <div style={{ textAlign: "center", padding: 16, color: "var(--muted)", fontSize: 12 }}>Sin egresos</div>
                ) : Object.entries(categoriasEgreso).sort((a, b) => b[1] - a[1]).map(([cat, monto]) => (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
                      <span style={{ color: "var(--muted)" }}>{cat}</span>
                      <span style={{ fontWeight: 600, color: "var(--red)" }}>{formatCOP(monto)}</span>
                    </div>
                    <BarraProgreso valor={monto} max={totalGastos || 1} color="var(--red)" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── OCUPACIÓN ── */}
      {mostrarSeccion("ocupacion") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Estado de habitaciones (actual)</div>
            </div>
            <div className="panel-body">
              {[
                { lbl: "Ocupadas",    val: habOcupadas,    max: habTotal, color: "var(--red)"   },
                { lbl: "Disponibles", val: habDisponibles, max: habTotal, color: "var(--green)" },
                { lbl: "En limpieza", val: habLimpieza,    max: habTotal, color: "var(--amber)" },
                { lbl: "Llegan hoy",  val: habReservadas,  max: habTotal, color: "var(--blue)"  },
              ].map((item) => (
                <div key={item.lbl} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span>{item.lbl}</span>
                    <span style={{ fontWeight: 700, color: item.color }}>
                      {item.val} <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>
                        ({Math.round((item.val / habTotal) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <BarraProgreso valor={item.val} max={habTotal} color={item.color} />
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><div className="panel-title">Tipos de habitación</div></div>
            <div className="panel-body">
              {Object.entries(tipoStats).map(([tipo, cant], i) => {
                const colors = ["var(--gold)","var(--blue)","var(--green)","var(--amber)","var(--red)"];
                const color = colors[i % colors.length];
                return (
                  <div key={tipo} style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                      <span>{tipo}</span>
                      <span style={{ fontWeight: 600, color }}>{cant} hab.</span>
                    </div>
                    <BarraProgreso valor={cant} max={habTotal} color={color} />
                  </div>
                );
              })}
              {habitaciones.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, padding: 16 }}>Sin habitaciones</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RESERVAS ── */}
      {mostrarSeccion("reservas") && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-lbl">Total reservas período</div>
              <div className="stat-val">{reservasFiltradas.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Completadas</div>
              <div className="stat-val" style={{ color: "var(--green)" }}>{reservasCompletadas}</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Canceladas</div>
              <div className="stat-val" style={{ color: "var(--red)" }}>{reservasCanceladas}</div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Prom. noches (estancias)</div>
              <div className="stat-val">{promNochesHistorial}</div>
              <div className="stat-sub">{historialFiltrado.length} estancias</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Estado de reservas — período</div>
            </div>
            <div className="panel-body">
              {[
                { lbl: "Completadas (checkout)", estado: "checkout",  color: "var(--muted)"  },
                { lbl: "En estancia (checkin)",  estado: "checkin",   color: "var(--blue)"   },
                { lbl: "Confirmadas",             estado: "confirmada",color: "var(--green)"  },
                { lbl: "Pendientes",              estado: "pendiente", color: "var(--amber)"  },
                { lbl: "Canceladas",              estado: "cancelada", color: "var(--red)"    },
              ].map((s) => {
                const cnt = reservasFiltradas.filter((r) => r.estado === s.estado).length;
                return (
                  <div key={s.estado} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 12.5 }}>
                    <span style={{ color: "var(--muted)" }}>{s.lbl}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: s.color }}>{cnt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PAGOS EMPLEADOS ── */}
      {mostrarSeccion("empleados") && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title">Pagos a empleados — período</div>
            <button className="btn btn-ghost btn-sm" onClick={exportarPagos}>↓ CSV Pagos</button>
          </div>
          {pagosFiltrados.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin pagos en el período seleccionado</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Empleado</th><th>Concepto</th><th>Método</th><th>Monto</th></tr></thead>
              <tbody>
                {pagosFiltrados.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nombreEmpleado}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{p.concepto}</td>
                    <td><span className="badge b-gray">{p.metodo}</span></td>
                    <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--blue)" }}>{formatCOP(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── EGRESOS ── */}
      {mostrarSeccion("egresos") && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title">Egresos generales — período</div>
            <button className="btn btn-ghost btn-sm" onClick={exportarEgresos}>↓ CSV Egresos</button>
          </div>
          {egresosFiltrados.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Sin egresos en el período seleccionado</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Concepto</th><th>Categoría</th><th>Método</th><th>Monto</th></tr></thead>
              <tbody>
                {egresosFiltrados.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.concepto}</td>
                    <td><span className="badge b-gray">{e.categoria}</span></td>
                    <td><span className="badge b-gray">{e.metodo}</span></td>
                    <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--red)" }}>{formatCOP(e.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Acciones de exportación ── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Exportar informes del período</div>
        </div>
        <div className="panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={exportarIngresos} style={{ padding: "10px 8px" }}>
              ↓ Ingresos CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportarEgresos} style={{ padding: "10px 8px" }}>
              ↓ Egresos CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportarPagos} style={{ padding: "10px 8px" }}>
              ↓ Pagos empleados CSV
            </button>
            <button className="btn btn-ghost btn-sm" onClick={exportarBalance} style={{ padding: "10px 8px" }}>
              ↓ Balance completo CSV
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
