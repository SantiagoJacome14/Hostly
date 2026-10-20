// ==========================================
// HOSTLY — Configuración del hotel (solo admin)
// Datos del hotel y habitaciones
// ==========================================
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { actualizarHotel, actualizarHabitacion, crearHabitaciones } from "../firebase/firestore";
import { useToast } from "../hooks/useToast.jsx";
import { formatCOP } from "../utils/dateMoney";

const TIPOS = ["Sencilla", "Doble", "Twin", "Triple", "Familiar", "Suite"];

const HAB_VACIA = { numero: "", tipo: "Doble", piso: "1", precio: "", capacidad: "2" };
const RANGO_VACIO = { piso: "1", desde: "", hasta: "", tipo: "Doble", precio: "", capacidad: "2" };

export default function ConfiguracionPage() {
  const { hotel } = useAuth();
  const { habitaciones, loading } = useHabitaciones({ incluirInactivas: true });
  const { toast, ToastContainer } = useToast();

  const [datos, setDatos] = useState({ nombre: "", ciudad: "", nit: "", rnt: "", direccion: "", telefono: "" });
  const [guardandoHotel, setGuardandoHotel] = useState(false);

  const [modal, setModal] = useState(null); // "una" | "rango" | habitación a editar
  const [form, setForm] = useState(HAB_VACIA);
  const [rango, setRango] = useState(RANGO_VACIO);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!hotel) return;
    setDatos({
      nombre: hotel.nombre || "",
      ciudad: hotel.ciudad || "",
      nit: hotel.nit || "",
      rnt: hotel.rnt || "",
      direccion: hotel.direccion || "",
      telefono: hotel.telefono || "",
    });
  }, [hotel]);

  const guardarHotel = async (e) => {
    e.preventDefault();
    setGuardandoHotel(true);
    try {
      await actualizarHotel(datos);
      toast("Datos del hotel guardados ✓");
    } catch (err) {
      console.error(err);
      toast("No se pudieron guardar los datos");
    } finally {
      setGuardandoHotel(false);
    }
  };

  const abrir = (tipo) => {
    if (tipo === "una") setForm(HAB_VACIA);
    if (tipo === "rango") setRango(RANGO_VACIO);
    if (typeof tipo === "object") {
      setForm({
        numero: tipo.numero,
        tipo: tipo.tipo || "Doble",
        piso: String(tipo.piso ?? 1),
        precio: String(tipo.precio ?? ""),
        capacidad: String(tipo.capacidad ?? 2),
      });
    }
    setModal(tipo);
  };

  const errorRepetidas = (err) =>
    err.message === "REPETIDAS"
      ? `Ya existen las habitaciones: ${err.numeros.join(", ")}`
      : "No se pudo guardar";

  const guardarUna = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (typeof modal === "object") {
        await actualizarHabitacion(modal.id, {
          tipo: form.tipo,
          piso: Number(form.piso) || 1,
          precio: Number(form.precio) || 0,
          capacidad: Number(form.capacidad) || 1,
        });
        toast(`Habitación ${modal.numero} actualizada ✓`);
      } else {
        await crearHabitaciones([form]);
        toast(`Habitación ${form.numero} creada ✓`);
      }
      setModal(null);
    } catch (err) {
      console.error(err);
      toast(errorRepetidas(err));
    } finally {
      setGuardando(false);
    }
  };

  const numerosRango = () => {
    const desde = Number(rango.desde);
    const hasta = Number(rango.hasta);
    if (!desde || !hasta || hasta < desde || hasta - desde > 99) return [];
    return Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i));
  };

  const guardarRango = async (e) => {
    e.preventDefault();
    const numeros = numerosRango();
    if (!numeros.length) {
      toast("Revisa el rango (máximo 100 habitaciones por vez)");
      return;
    }
    setGuardando(true);
    try {
      await crearHabitaciones(numeros.map((numero) => ({ ...rango, numero })));
      toast(`${numeros.length} habitaciones creadas ✓`);
      setModal(null);
    } catch (err) {
      console.error(err);
      toast(errorRepetidas(err));
    } finally {
      setGuardando(false);
    }
  };

  const cambiarActiva = async (h) => {
    const activa = h.activa === false;
    await actualizarHabitacion(h.id, { activa });
    toast(activa ? `Habitación ${h.numero} habilitada` : `Habitación ${h.numero} fuera de venta`);
  };

  const campo = (obj, set, k) => ({ value: obj[k], onChange: (e) => set({ ...obj, [k]: e.target.value }) });

  return (
    <div style={{ maxWidth: 900 }}>
      <ToastContainer />
      <datalist id="tipos-hab">{TIPOS.map((t) => <option key={t} value={t} />)}</datalist>

      {/* ─── Modal habitación ─── */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">
                {modal === "rango" ? "Crear varias habitaciones" : typeof modal === "object" ? `Habitación ${modal.numero}` : "Nueva habitación"}
              </div>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>

            {modal === "rango" ? (
              <form onSubmit={guardarRango}>
                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Desde el número</label>
                      <input className="form-input" type="number" required placeholder="Ej. 101" {...campo(rango, setRango, "desde")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hasta el número</label>
                      <input className="form-input" type="number" required placeholder="Ej. 110" {...campo(rango, setRango, "hasta")} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Tipo</label>
                      <input className="form-input" list="tipos-hab" required {...campo(rango, setRango, "tipo")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Piso</label>
                      <input className="form-input" type="number" required {...campo(rango, setRango, "piso")} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Precio por noche (COP)</label>
                      <input className="form-input" type="number" required min={0} {...campo(rango, setRango, "precio")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Capacidad (personas)</label>
                      <input className="form-input" type="number" required min={1} {...campo(rango, setRango, "capacidad")} />
                    </div>
                  </div>
                  {numerosRango().length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      Se crearán {numerosRango().length} habitaciones: {numerosRango()[0]} a {numerosRango().at(-1)}.
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-gold btn-sm" disabled={guardando}>{guardando ? "Creando..." : "Crear"}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={guardarUna}>
                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Número</label>
                      <input className="form-input" required placeholder="Ej. 101" disabled={typeof modal === "object"} {...campo(form, setForm, "numero")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo</label>
                      <input className="form-input" list="tipos-hab" required {...campo(form, setForm, "tipo")} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Piso</label>
                      <input className="form-input" type="number" required {...campo(form, setForm, "piso")} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Capacidad (personas)</label>
                      <input className="form-input" type="number" required min={1} {...campo(form, setForm, "capacidad")} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Precio por noche (COP)</label>
                    <input className="form-input" type="number" required min={0} {...campo(form, setForm, "precio")} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal(null)}>Cancelar</button>
                  <button type="submit" className="btn btn-gold btn-sm" disabled={guardando}>{guardando ? "Guardando..." : "Guardar"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── Datos del hotel ─── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Datos del hotel</div>
          <span className="badge b-gold">Plan: {hotel?.plan || "—"}</span>
        </div>
        <form className="panel-body" onSubmit={guardarHotel}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-input" required {...campo(datos, setDatos, "nombre")} />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input className="form-input" {...campo(datos, setDatos, "ciudad")} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">NIT</label>
              <input className="form-input" placeholder="900123456-7" {...campo(datos, setDatos, "nit")} />
            </div>
            <div className="form-group">
              <label className="form-label">RNT (Registro Nacional de Turismo)</label>
              <input className="form-input" placeholder="Necesario para el TRA" {...campo(datos, setDatos, "rnt")} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Dirección</label>
              <input className="form-input" {...campo(datos, setDatos, "direccion")} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono / WhatsApp</label>
              <input className="form-input" {...campo(datos, setDatos, "telefono")} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-gold btn-sm" disabled={guardandoHotel}>
              {guardandoHotel ? "Guardando..." : "Guardar datos"}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Habitaciones ─── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Habitaciones ({habitaciones.filter((h) => h.activa !== false).length} en venta)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => abrir("rango")}>+ Varias</button>
            <button className="btn btn-gold btn-sm" onClick={() => abrir("una")}>+ Una habitación</button>
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Cargando...</div>
        ) : habitaciones.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            Aún no hay habitaciones. Crea la primera o usa "+ Varias" para crear un piso completo.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Número</th><th>Tipo</th><th>Piso</th><th>Capacidad</th><th>Precio/noche</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {habitaciones.map((h) => (
                <tr key={h.id} style={{ opacity: h.activa === false ? 0.5 : 1 }}>
                  <td><span className="room-tag">{h.numero}</span></td>
                  <td>{h.tipo}</td>
                  <td>{h.piso}</td>
                  <td>{h.capacidad || "—"}</td>
                  <td style={{ color: "var(--gold)" }}>{formatCOP(h.precio)}</td>
                  <td>
                    <span className={`badge ${h.activa === false ? "b-gray" : "b-green"}`}>
                      {h.activa === false ? "Fuera de venta" : "En venta"}
                    </span>
                  </td>
                  <td style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => abrir(h)}>Editar</button>
                    <button className="btn btn-outline btn-sm" onClick={() => cambiarActiva(h)}>
                      {h.activa === false ? "Habilitar" : "Quitar de venta"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
