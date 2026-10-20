import { useState, useEffect } from "react";
import { crearEmpleado, actualizarEmpleado } from "../firebase/auth";
import { suscribirEmpleados } from "../firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast.jsx";

const ROLES = ["recepcionista", "contador", "servicio", "vigilante", "admin"];
const COLORES_ROL = {
  admin: "#9B59B6", recepcionista: "#D4A843",
  servicio: "#2ECC71", contador: "#3498DB", vigilante: "#E74C3C",
};

export default function UsuariosPage() {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [creando, setCreando]     = useState(false);
  const { toast, ToastContainer } = useToast();
  const { usuario, hotelId } = useAuth();
  const [editando, setEditando]   = useState(null);
  const [formEdit, setFormEdit]   = useState({ nombre: "", rol: "recepcionista", area: "" });

  const [form, setForm] = useState({
    nombre: "", email: "", password: "", rol: "recepcionista", area: "",
  });

  useEffect(() => {
    const unsub = suscribirEmpleados((data) => {
      setEmpleados(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleCrear = async (ev) => {
    ev.preventDefault();
    setCreando(true);
    try {
      // Se crea en segundo plano: tu sesión de administrador sigue abierta
      await crearEmpleado({ ...form, hotelId });
      toast(`Empleado ${form.nombre} creado con rol ${form.rol} ✓`);
      setModal(false);
      setForm({ nombre: "", email: "", password: "", rol: "recepcionista", area: "" });
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        toast("Ese correo ya está registrado");
      } else if (err.code === "auth/weak-password") {
        toast("La contraseña debe tener al menos 6 caracteres");
      } else {
        toast("Error al crear empleado: " + err.message);
      }
    } finally {
      setCreando(false);
    }
  };

  const abrirEditar = (e) => {
    setFormEdit({ nombre: e.nombre || "", rol: e.rol, area: e.area || "" });
    setEditando(e);
  };

  const handleEditar = async (ev) => {
    ev.preventDefault();
    try {
      await actualizarEmpleado(editando.id, formEdit);
      toast("Empleado actualizado ✓");
      setEditando(null);
    } catch (err) {
      console.error(err);
      toast("No se pudo actualizar el empleado");
    }
  };

  const cambiarActivo = async (e) => {
    const activo = e.activo === false;
    try {
      await actualizarEmpleado(e.id, { activo });
      toast(activo ? `${e.nombre} puede volver a ingresar` : `${e.nombre} ya no puede ingresar`);
    } catch (err) {
      console.error(err);
      toast("No se pudo cambiar el acceso");
    }
  };

  const esYo = (e) => e.id === usuario?.uid;

  return (
    <>
      <ToastContainer />

      {editando && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Editar empleado</div>
              <button className="modal-close" onClick={() => setEditando(null)}>✕</button>
            </div>
            <form onSubmit={handleEditar}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre completo</label>
                  <input className="form-input" required value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Rol</label>
                    <select className="form-input form-select" value={formEdit.rol} disabled={esYo(editando)} onChange={(e) => setFormEdit({ ...formEdit, rol: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Área / Turno</label>
                    <input className="form-input" value={formEdit.area} onChange={(e) => setFormEdit({ ...formEdit, area: e.target.value })} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>
                  Para cambiar la contraseña, el empleado usa "¿Olvidaste tu contraseña?" en la pantalla de ingreso.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-gold btn-sm">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Crear Empleado</div>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCrear}>
              <div className="modal-body">
                <div className="notif" style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--muted)" }}>
                  Se creará una cuenta en Firebase Authentication y un perfil de empleado.
                  El empleado puede iniciar sesión con el email y contraseña registrados.
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nombre completo</label>
                    <input className="form-input" required placeholder="Ej. Juan Pérez" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rol</label>
                    <select className="form-input form-select" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" required placeholder="empleado@hotel.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Contraseña</label>
                    <input className="form-input" type="password" required minLength={6} placeholder="Mín. 6 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Área / Turno</label>
                    <input className="form-input" placeholder="Ej. Recepción mañana" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold btn-sm" disabled={creando}>
                  {creando ? "Creando..." : "Crear empleado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 20 }}>
        {ROLES.map((rol) => (
          <div className="stat-card" key={rol}>
            <div className="stat-lbl" style={{ color: COLORES_ROL[rol] }}>{rol}</div>
            <div className="stat-val">{empleados.filter((e) => e.rol === rol).length}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Empleados del sistema ({empleados.length})</div>
          <button className="btn btn-gold btn-sm" onClick={() => setModal(true)}>+ Crear empleado</button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Cargando...</div>
        ) : empleados.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>👥</div>
            No hay empleados registrados.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Área</th><th>Creado</th><th>Acceso</th><th></th></tr>
            </thead>
            <tbody>
              {empleados.map((e) => (
                <tr key={e.id} style={{ opacity: e.activo === false ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 500 }}>{e.nombre || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{e.email}</td>
                  <td>
                    <span className="badge" style={{
                      background: `${COLORES_ROL[e.rol] || "#6B6660"}18`,
                      color: COLORES_ROL[e.rol] || "#6B6660",
                      border: `1px solid ${COLORES_ROL[e.rol] || "#6B6660"}33`,
                      padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                    }}>
                      {e.rol}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{e.area || "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--muted)" }}>
                    {e.creadoEn?.toDate?.()?.toLocaleDateString("es-CO") || "—"}
                  </td>
                  <td>
                    <span className={`badge ${e.activo === false ? "b-gray" : "b-green"}`}>
                      {e.activo === false ? "Desactivado" : "Activo"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)}>Editar</button>
                    {!esYo(e) && (
                      <button className="btn btn-outline btn-sm" onClick={() => cambiarActivo(e)}>
                        {e.activo === false ? "Activar" : "Desactivar"}
                      </button>
                    )}
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
