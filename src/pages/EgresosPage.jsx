import { useState, useEffect } from "react";
import {
  suscribirEgresos,
  registrarEgreso,
  actualizarEgresoConAuditoria,
} from "../firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast.jsx";
import { toDateSafe, isSameDay, isSameMonth, formatCOP } from "../utils/dateMoney";
import { exportCsv } from "../utils/exportCsv";

// ── Constantes de módulo ──────────────────────────────────
const fmtFecha = (ts) =>
  toDateSafe(ts)?.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) || "—";

const CATEGORIAS = [
  "Servicios públicos", "Mantenimiento", "Suministros / limpieza",
  "Alimentación / cocina", "Tecnología", "Marketing",
  "Alquiler / arrendamiento", "Transporte", "Otros",
];
const METODOS    = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia", "Nequi / Daviplata"];
const FORM_VACIO = { concepto: "", categoria: "Otros", monto: "", metodo: "Efectivo", observacion: "" };

// ── Función pura de módulo ────────────────────────────────
const bloquearEnter = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
  }
};

// ── Definido FUERA de EgresosPage ─────────────────────────
function CamposEgresoForm({ f, sf }) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Concepto</label>
        <input
          className="form-input"
          required
          autoComplete="off"
          placeholder="Ej. Pago de agua y luz"
          value={f.concepto}
          onChange={(e) => sf((prev) => ({ ...prev, concepto: e.target.value }))}
        />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Categoría</label>
          <select
            className="form-input form-select"
            value={f.categoria}
            onChange={(e) => sf((prev) => ({ ...prev, categoria: e.target.value }))}
          >
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Monto (COP)</label>
          <input
            className="form-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ej. 150000"
            value={f.monto}
            onKeyDown={bloquearEnter}
            onChange={(e) => {
              const limpio = e.target.value.replace(/\D/g, "");
              sf((prev) => ({ ...prev, monto: limpio }));
            }}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Método de pago</label>
        <select
          className="form-input form-select"
          value={f.metodo}
          onChange={(e) => sf((prev) => ({ ...prev, metodo: e.target.value }))}
        >
          {METODOS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Observaciones</label>
        <textarea
          className="form-input"
          rows="2"
          placeholder="Notas adicionales..."
          style={{ resize: "none" }}
          value={f.observacion}
          onChange={(e) => sf((prev) => ({ ...prev, observacion: e.target.value }))}
        />
      </div>
    </>
  );
}

// ── Componente principal ──────────────────────────────────
export default function EgresosPage() {
  const [egresos, setEgresos]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const { usuario }                 = useAuth();
  const { toast, ToastContainer }   = useToast();
  const [form, setForm]             = useState(FORM_VACIO);
  const [formEdit, setFormEdit]     = useState(FORM_VACIO);

  useEffect(() => {
    const unsub = suscribirEgresos((data) => { setEgresos(data); setLoading(false); });
    return () => unsub();
  }, []);

  const totalHoy  = egresos.filter((e) => isSameDay(e.fecha)).reduce((s, e) => s + (Number(e.monto) || 0), 0);
  const totalMes  = egresos.filter((e) => isSameMonth(e.fecha)).reduce((s, e) => s + (Number(e.monto) || 0), 0);
  const totalAcum = egresos.reduce((s, e) => s + (Number(e.monto) || 0), 0);

  const handleCrear = async (ev) => {
    ev.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) { toast("El monto debe ser un número positivo"); return; }
    await registrarEgreso({ ...form, monto: Number(form.monto), registradoPor: usuario?.email || "sistema" });
    toast(`Egreso de ${formatCOP(Number(form.monto))} registrado ✓`);
    setModalCrear(false);
    setForm(FORM_VACIO);
  };

  const abrirEditar = (egreso) => {
    setFormEdit({
      concepto:    egreso.concepto    || "",
      categoria:   egreso.categoria   || "Otros",
      monto:       String(egreso.monto || ""),
      metodo:      egreso.metodo      || "Efectivo",
      observacion: egreso.observacion || "",
    });
    setModalEditar(egreso);
  };

  const handleEditar = async (ev) => {
    ev.preventDefault();
    if (!formEdit.monto || Number(formEdit.monto) <= 0) { toast("El monto debe ser un número positivo"); return; }
    await actualizarEgresoConAuditoria(
      modalEditar.id,
      { ...formEdit, monto: Number(formEdit.monto) },
      { concepto: modalEditar.concepto, monto: modalEditar.monto, metodo: modalEditar.metodo },
      usuario
    );
    toast("Egreso actualizado ✓");
    setModalEditar(null);
  };

  const handleExportarCSV = () => {
    const ok = exportCsv({
      filename: `egresos_hostly_${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { label: "Fecha",          key: "fecha",       transform: (v) => toDateSafe(v)?.toLocaleDateString("es-CO") || "—" },
        { label: "Concepto",       key: "concepto" },
        { label: "Categoría",      key: "categoria" },
        { label: "Método de pago", key: "metodo" },
        { label: "Monto COP",      key: "monto" },
        { label: "Observaciones",  key: "observacion" },
        { label: "Registrado por", key: "registradoPor" },
      ],
      rows: egresos,
    });
    if (!ok) toast("No hay egresos para exportar");
  };

  return (
    <>
      <ToastContainer />

      {modalCrear && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalCrear(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Registrar Egreso</div>
              <button type="button" className="modal-close" onClick={() => setModalCrear(false)}>✕</button>
            </div>
            <form
              onSubmit={handleCrear}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            >
              <div className="modal-body">
                <CamposEgresoForm f={form} sf={setForm} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold btn-sm">Registrar egreso</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalEditar && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalEditar(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Editar Egreso</div>
              <button type="button" className="modal-close" onClick={() => setModalEditar(null)}>✕</button>
            </div>
            <form
              onSubmit={handleEditar}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            >
              <div className="modal-body">
                <CamposEgresoForm f={formEdit} sf={setFormEdit} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setModalEditar(null)}>Cancelar</button>
                <button type="submit" className="btn btn-gold btn-sm">Guardar cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-lbl">Egresos hoy</div>
          <div className="stat-val" style={{ color: "var(--red)" }}>{formatCOP(totalHoy)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Egresos del mes</div>
          <div className="stat-val" style={{ color: "var(--red)" }}>{formatCOP(totalMes)}</div>
          <div className="stat-sub">{egresos.filter((e) => isSameMonth(e.fecha)).length} registros</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Total acumulado</div>
          <div className="stat-val">{formatCOP(totalAcum)}</div>
          <div className="stat-sub">{egresos.length} registros</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Registro de egresos</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportarCSV}>↓ CSV</button>
            <button className="btn btn-gold btn-sm" onClick={() => setModalCrear(true)}>+ Registrar</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Cargando egresos...</div>
        ) : egresos.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📤</div>
            No hay egresos registrados.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Método</th><th>Monto</th><th></th></tr>
            </thead>
            <tbody>
              {egresos.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{fmtFecha(e.fecha)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{e.concepto}</div>
                    {e.observacion && <div style={{ fontSize: 10, color: "var(--muted)" }}>{e.observacion}</div>}
                    {e.actualizadoEn && <div style={{ fontSize: 9, color: "var(--muted)" }}>✏ editado</div>}
                  </td>
                  <td><span className="badge b-gray">{e.categoria}</span></td>
                  <td><span className="badge b-gray">{e.metodo}</span></td>
                  <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--red)", fontSize: 14 }}>{formatCOP(e.monto)}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
