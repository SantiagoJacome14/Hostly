import { useState, useEffect } from "react";
import {
  suscribirIngresos,
  registrarIngreso,
  actualizarIngresoConAuditoria,
} from "../firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast.jsx";
import { toDateSafe, isSameDay, isSameMonth, formatCOP } from "../utils/dateMoney";
import { exportCsv } from "../utils/exportCsv";

// ── Constantes de módulo ──────────────────────────────────
const fmtFecha = (ts) =>
  toDateSafe(ts)?.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) || "—";

const METODOS = ["Efectivo", "Tarjeta débito", "Tarjeta crédito", "Transferencia", "Nequi / Daviplata"];

// ── Función pura — no depende del componente padre ───────
const bloquearEnter = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
  }
};

// ── Definido FUERA de IngresosPage para que React no lo
//    remonte en cada render y el input conserve el foco ───
function ModalIngresoForm({ titulo, form, setForm, onSubmit, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{titulo}</div>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form
          onSubmit={onSubmit}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
        >
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <input
                className="form-input"
                required
                autoComplete="off"
                placeholder="Ej. Check-in Carlos Mendoza"
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Habitación</label>
                <input
                  className="form-input"
                  autoComplete="off"
                  placeholder="Ej. 101 (opcional)"
                  value={form.habitacion}
                  onChange={(e) => setForm((prev) => ({ ...prev, habitacion: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Monto (COP)</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej. 43000"
                  value={form.monto}
                  onKeyDown={bloquearEnter}
                  onChange={(e) => {
                    const limpio = e.target.value.replace(/\D/g, "");
                    setForm((prev) => ({ ...prev, monto: limpio }));
                  }}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Método de pago</label>
              <select
                className="form-input form-select"
                value={form.metodo}
                onChange={(e) => setForm((prev) => ({ ...prev, metodo: e.target.value }))}
              >
                {METODOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-gold btn-sm">
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
const FORM_VACIO = { descripcion: "", habitacion: "", monto: "", metodo: "Efectivo" };

export default function IngresosPage() {
  const [ingresos, setIngresos]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(null);
  const { usuario }                 = useAuth();
  const { toast, ToastContainer }   = useToast();
  const [form, setForm]             = useState(FORM_VACIO);
  const [formEdit, setFormEdit]     = useState(FORM_VACIO);

  useEffect(() => {
    const unsub = suscribirIngresos((data) => { setIngresos(data); setLoading(false); });
    return () => unsub();
  }, []);

  const totalHoy  = ingresos.filter((i) => isSameDay(i.fecha)).reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const totalMes  = ingresos.filter((i) => isSameMonth(i.fecha)).reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const totalAcum = ingresos.reduce((s, i) => s + (Number(i.monto) || 0), 0);

  const handleCrear = async (e) => {
    e.preventDefault();
    if (!form.monto || Number(form.monto) <= 0) { toast("El monto debe ser un número positivo"); return; }
    await registrarIngreso({ ...form, monto: Number(form.monto), registradoPor: usuario?.email || "sistema" });
    toast(`Ingreso de ${formatCOP(Number(form.monto))} registrado ✓`);
    setModalCrear(false);
    setForm(FORM_VACIO);
  };

  const abrirEditar = (ingreso) => {
    setFormEdit({
      descripcion: ingreso.descripcion || "",
      habitacion:  ingreso.habitacion  || "",
      monto:       String(ingreso.monto || ""),
      metodo:      ingreso.metodo || "Efectivo",
    });
    setModalEditar(ingreso);
  };

  const handleEditar = async (e) => {
    e.preventDefault();
    if (!formEdit.monto || Number(formEdit.monto) <= 0) { toast("El monto debe ser un número positivo"); return; }
    await actualizarIngresoConAuditoria(
      modalEditar.id,
      { ...formEdit, monto: Number(formEdit.monto) },
      { descripcion: modalEditar.descripcion, habitacion: modalEditar.habitacion, monto: modalEditar.monto, metodo: modalEditar.metodo },
      usuario
    );
    toast("Ingreso actualizado ✓");
    setModalEditar(null);
  };

  const handleExportarCSV = () => {
    const ok = exportCsv({
      filename: `ingresos_hostly_${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { label: "Fecha",          key: "fecha",       transform: (v) => toDateSafe(v)?.toLocaleDateString("es-CO") || "—" },
        { label: "Descripción",    key: "descripcion" },
        { label: "Habitación",     key: "habitacion" },
        { label: "Método de pago", key: "metodo" },
        { label: "Monto COP",      key: "monto" },
        { label: "Registrado por", key: "registradoPor" },
      ],
      rows: ingresos,
    });
    if (!ok) toast("No hay ingresos para exportar");
  };

  return (
    <>
      <ToastContainer />

      {modalCrear && (
        <ModalIngresoForm
          titulo="Registrar Ingreso"
          form={form}
          setForm={setForm}
          onSubmit={handleCrear}
          onClose={() => setModalCrear(false)}
        />
      )}

      {modalEditar && (
        <ModalIngresoForm
          titulo="Editar Ingreso"
          form={formEdit}
          setForm={setFormEdit}
          onSubmit={handleEditar}
          onClose={() => setModalEditar(null)}
        />
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-lbl">Total hoy</div>
          <div className="stat-val gold">{formatCOP(totalHoy)}</div>
          <div className="stat-sub">{ingresos.filter((i) => isSameDay(i.fecha)).length} registros hoy</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Total del mes</div>
          <div className="stat-val gold">{formatCOP(totalMes)}</div>
          <div className="stat-sub">{ingresos.filter((i) => isSameMonth(i.fecha)).length} registros este mes</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Total acumulado</div>
          <div className="stat-val gold">{formatCOP(totalAcum)}</div>
          <div className="stat-sub">{ingresos.length} registros totales</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Registro de ingresos</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportarCSV}>↓ CSV</button>
            <button className="btn btn-gold btn-sm" onClick={() => setModalCrear(true)}>+ Registrar</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Cargando ingresos...</div>
        ) : ingresos.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>💰</div>
            No hay ingresos registrados aún.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Fecha</th><th>Descripción</th><th>Hab.</th><th>Método</th><th>Monto</th><th></th></tr>
            </thead>
            <tbody>
              {ingresos.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{fmtFecha(i.fecha)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{i.descripcion}</div>
                    {i.actualizadoEn && <div style={{ fontSize: 9, color: "var(--muted)" }}>✏ editado</div>}
                  </td>
                  <td>{i.habitacion ? <span className="room-tag">{i.habitacion}</span> : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                  <td><span className="badge b-gray">{i.metodo}</span></td>
                  <td style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color: "var(--gold)", fontSize: 14 }}>
                    {formatCOP(i.monto)}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(i)}>Editar</button>
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
