import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  suscribirIngresos,
  suscribirEgresos,
  suscribirPagosEmpleados,
  crearComprobante,
  suscribirComprobantes,
  anularComprobante,
} from "../firebase/firestore";
import { formatCOP, toDateSafe, inDateRange, sumBy, currentYYYYMM } from "../utils/dateMoney";
import { exportCsv } from "../utils/exportCsv";
import { useToast } from "../hooks/useToast.jsx";

const fmtFecha = (ts) =>
  toDateSafe(ts)?.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) || "—";

const TABS = [
  { id: "comprobantes",  label: "Comprobantes" },
  { id: "crear",         label: "Crear comprobante" },
  { id: "exportar",      label: "Exportar informes" },
];

export default function InformesContablesPage() {
  const { usuario } = useAuth();
  const { toast, ToastContainer } = useToast();

  const [tab, setTab]                   = useState("comprobantes");
  const [comprobantes, setComprobantes] = useState([]);
  const [ingresos, setIngresos]         = useState([]);
  const [egresos, setEgresos]           = useState([]);
  const [pagos, setPagos]               = useState([]);

  const [modalAnular, setModalAnular]   = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");

  // Filtros exportación
  const [expDesde,  setExpDesde]  = useState("");
  const [expHasta,  setExpHasta]  = useState("");
  const [expTipo,   setExpTipo]   = useState("todos");

  // Formulario nuevo comprobante
  const [form, setForm] = useState({
    tipo: "ingreso", tercero: "", documento: "", concepto: "",
    metodo: "Efectivo", monto: "", observaciones: "", referencia: "",
  });
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    const u1 = suscribirComprobantes(setComprobantes);
    const u2 = suscribirIngresos(setIngresos);
    const u3 = suscribirEgresos(setEgresos);
    const u4 = suscribirPagosEmpleados(setPagos);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const handleCrearComprobante = async (e) => {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) { toast("El monto debe ser positivo"); return; }
    setCreando(true);
    try {
      // El consecutivo lo asigna la base de datos (nunca se repite)
      const consecutivo = await crearComprobante({
        tipo:           form.tipo,
        tercero:        form.tercero,
        documento:      form.documento,
        concepto:       form.concepto,
        metodo:         form.metodo,
        monto:          Number(form.monto),
        observaciones:  form.observaciones,
        referencia:     form.referencia,
        registradoPor:  usuario?.email || "sistema",
        origenColeccion: null,
        origenId:       null,
      }, currentYYYYMM());
      toast(`Comprobante ${consecutivo} creado ✓`);
      setForm({ tipo: "ingreso", tercero: "", documento: "", concepto: "", metodo: "Efectivo", monto: "", observaciones: "", referencia: "" });
      setTab("comprobantes");
    } catch (err) {
      console.error(err);
      toast("Error al crear comprobante");
    } finally {
      setCreando(false);
    }
  };

  const handleAnular = async () => {
    if (!modalAnular || !motivoAnulacion.trim()) { toast("Ingresa el motivo de anulación"); return; }
    await anularComprobante(modalAnular.id, motivoAnulacion, usuario);
    toast(`Comprobante ${modalAnular.consecutivo} anulado`);
    setModalAnular(null);
    setMotivoAnulacion("");
  };

  const filtrarPorRango = (arr, campoFecha) =>
    arr.filter((item) => inDateRange(item[campoFecha], expDesde, expHasta));

  const exportarInforme = () => {
    const ingresosFilt = filtrarPorRango(ingresos, "fecha");
    const egresosFilt  = filtrarPorRango(egresos,  "fecha");
    const pagosFilt    = filtrarPorRango(pagos,     "fecha");

    const movimientos = [
      ...ingresosFilt.map((i) => ({ ...i, tipoMov: "Ingreso", tercero: i.descripcion })),
      ...egresosFilt.map((e) => ({ ...e, tipoMov: "Egreso",   tercero: e.concepto })),
      ...pagosFilt.map((p) => ({ ...p, tipoMov: "Pago empleado", tercero: p.nombreEmpleado })),
    ].filter((m) => expTipo === "todos" || m.tipoMov.toLowerCase().includes(expTipo));

    if (movimientos.length === 0) { toast("No hay movimientos en el período seleccionado"); return; }

    exportCsv({
      filename: `informe_contable_${expDesde || "inicio"}_${expHasta || "fin"}.csv`,
      columns: [
        { label: "Tipo",          key: "tipoMov" },
        { label: "Fecha",         key: "fecha",   transform: (v) => toDateSafe(v)?.toLocaleDateString("es-CO") || "—" },
        { label: "Tercero",       key: "tercero" },
        { label: "Método pago",   key: "metodo" },
        { label: "Monto COP",     key: "monto" },
        { label: "Habitación",    key: "habitacion" },
        { label: "Registrado por", key: "registradoPor" },
      ],
      rows: movimientos,
    });
    toast("Informe contable exportado ✓");
  };

  const comprobantesActivos = comprobantes.filter((c) => c.estado !== "anulado");
  const comprobantesAnulados = comprobantes.filter((c) => c.estado === "anulado");

  return (
    <>
      <ToastContainer />

      {/* Modal anular */}
      {modalAnular && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalAnular(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "var(--red)" }}>Anular comprobante</div>
              <button type="button" className="modal-close" onClick={() => setModalAnular(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: "var(--bg4)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{modalAnular.consecutivo}</div>
                <div style={{ color: "var(--muted)" }}>{modalAnular.concepto} — {formatCOP(modalAnular.monto)}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Motivo de anulación (obligatorio)</label>
                <textarea className="form-input" rows="2" required style={{ resize: "none" }} placeholder="Describe el motivo..." value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setModalAnular(null)}>Cancelar</button>
              <button type="button" className="btn btn-sm" style={{ background: "rgba(231,76,60,0.12)", color: "var(--red)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: 8 }} onClick={handleAnular}>
                Anular comprobante
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nota importante */}
      <div className="notif" style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16 }}>📋</span>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          <strong style={{ color: "var(--gold)" }}>Informes para revisión contable interna.</strong> Los comprobantes generados aquí son <em>soportes internos del hotel</em>, no constituyen facturación electrónica válida ante la DIAN.
        </div>
      </div>

      {/* Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-lbl">Comprobantes activos</div><div className="stat-val">{comprobantesActivos.length}</div></div>
        <div className="stat-card"><div className="stat-lbl">Anulados</div><div className="stat-val" style={{ color: "var(--red)" }}>{comprobantesAnulados.length}</div></div>
        <div className="stat-card"><div className="stat-lbl">Total ingresos</div><div className="stat-val gold">{formatCOP(sumBy(ingresos, "monto"))}</div></div>
        <div className="stat-card"><div className="stat-lbl">Total egresos</div><div className="stat-val" style={{ color: "var(--red)" }}>{formatCOP(sumBy(egresos, "monto") + sumBy(pagos, "monto"))}</div></div>
      </div>

      {/* Tabs */}
      <div className="chip-row" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <div key={t.id} className={`chip ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── TAB COMPROBANTES ── */}
      {tab === "comprobantes" && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Comprobantes internos ({comprobantes.length})</div>
            <button className="btn btn-gold btn-sm" onClick={() => setTab("crear")}>+ Nuevo comprobante</button>
          </div>
          {comprobantes.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📄</div>
              Sin comprobantes registrados.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Consecutivo</th><th>Tipo</th><th>Tercero</th><th>Concepto</th><th>Monto</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {comprobantes.map((c) => (
                  <tr key={c.id} style={{ opacity: c.estado === "anulado" ? 0.5 : 1 }}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--gold)" }}>{c.consecutivo}</td>
                    <td><span className={`badge ${c.tipo === "ingreso" ? "b-green" : c.tipo === "egreso" ? "b-red" : "b-blue"}`}>{c.tipo}</span></td>
                    <td style={{ fontSize: 12 }}>{c.tercero || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{c.concepto}</td>
                    <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: c.tipo === "ingreso" ? "var(--gold)" : "var(--red)" }}>{formatCOP(c.monto)}</td>
                    <td>
                      <span className={`badge ${c.estado === "confirmado" ? "b-green" : "b-red"}`}>{c.estado}</span>
                    </td>
                    <td>
                      {c.estado === "confirmado" && (
                        <button className="btn btn-sm" style={{ background: "rgba(231,76,60,0.08)", color: "var(--red)", border: "1px solid rgba(231,76,60,0.2)", borderRadius: 8, fontSize: 11 }} onClick={() => setModalAnular(c)}>
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── TAB CREAR ── */}
      {tab === "crear" && (
        <div className="panel" style={{ maxWidth: 600 }}>
          <div className="panel-header"><div className="panel-title">Nuevo comprobante interno</div></div>
          <form
            onSubmit={handleCrearComprobante}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          >
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tipo</label>
                  <select className="form-input form-select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                    <option value="pago_empleado">Pago empleado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Monto (COP)</label>
                  <input
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 250000"
                    value={form.monto}
                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                    autoComplete="off"
                    onChange={(e) => {
                      const limpio = e.target.value.replace(/\D/g, "");
                      setForm((prev) => ({ ...prev, monto: limpio }));
                    }}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tercero (cliente / proveedor / empleado)</label>
                  <input className="form-input" required placeholder="Nombre" value={form.tercero} onChange={(e) => setForm({ ...form, tercero: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Documento / NIT</label>
                  <input className="form-input" placeholder="CC / NIT (opcional)" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Concepto</label>
                <input className="form-input" required placeholder="Descripción del comprobante" value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Método de pago</label>
                  <select className="form-input form-select" value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
                    <option>Efectivo</option><option>Tarjeta débito</option><option>Tarjeta crédito</option><option>Transferencia</option><option>Nequi / Daviplata</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Referencia (hab./factura)</label>
                  <input className="form-input" placeholder="Ej. Hab. 101" value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Observaciones</label>
                <textarea className="form-input" rows="2" style={{ resize: "none" }} placeholder="Notas adicionales..." value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
              </div>
            </div>
            <div style={{ padding: "12px 20px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setTab("comprobantes")}>Cancelar</button>
              <button type="submit" className="btn btn-gold btn-sm" disabled={creando}>{creando ? "Creando..." : "Crear comprobante"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── TAB EXPORTAR ── */}
      {tab === "exportar" && (
        <div className="panel">
          <div className="panel-header"><div className="panel-title">Exportar informe contable</div></div>
          <div className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Desde</label>
                <input className="form-input" type="date" value={expDesde} onChange={(e) => setExpDesde(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Hasta</label>
                <input className="form-input" type="date" value={expHasta} onChange={(e) => setExpHasta(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo de movimiento</label>
                <select className="form-input form-select" value={expTipo} onChange={(e) => setExpTipo(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="ingreso">Solo ingresos</option>
                  <option value="egreso">Solo egresos</option>
                  <option value="pago">Solo pagos empleados</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={exportarInforme} style={{ padding: "12px 8px" }}>
                ↓ Movimientos completos CSV
              </button>
              <button className="btn btn-ghost btn-sm" style={{ padding: "12px 8px" }} onClick={() => {
                const ok = exportCsv({
                  filename: `comprobantes_${new Date().toISOString().slice(0,10)}.csv`,
                  columns: [
                    { label: "Consecutivo", key: "consecutivo" },
                    { label: "Tipo",        key: "tipo" },
                    { label: "Tercero",     key: "tercero" },
                    { label: "Documento",   key: "documento" },
                    { label: "Concepto",    key: "concepto" },
                    { label: "Método",      key: "metodo" },
                    { label: "Monto COP",   key: "monto" },
                    { label: "Estado",      key: "estado" },
                    { label: "Creado por",  key: "registradoPor" },
                    { label: "Fecha",       key: "creadoEn", transform: (v) => toDateSafe(v)?.toLocaleDateString("es-CO") || "—" },
                  ],
                  rows: comprobantes.filter((c) => c.estado !== "anulado"),
                });
                if (!ok) toast("Sin comprobantes para exportar");
              }}>
                ↓ Comprobantes CSV
              </button>
              <button className="btn btn-ghost btn-sm" style={{ padding: "12px 8px" }} onClick={() => window.print()}>
                🖨 Imprimir vista
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
