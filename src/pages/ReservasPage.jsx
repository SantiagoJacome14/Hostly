import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useReservas } from "../hooks/useReservas.jsx";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { useAuth } from "../context/AuthContext";
import { crearReserva, cancelarReserva, hacerCheckin } from "../firebase/firestore";
import { useToast } from "../hooks/useToast.jsx";
import { contarNoches, habitacionesLibres, hoyISO } from "../utils/disponibilidad";

const initials = (n) =>
  n?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";

const badgeClass = {
  confirmada: "b-green",
  pendiente:  "b-amber",
  checkin:    "b-blue",
  checkout:   "b-gray",
  cancelada:  "b-red",
};

const badgeLabel = {
  confirmada: "Confirmada",
  pendiente:  "Pendiente",
  checkin:    "En estancia",
  checkout:   "Check-out",
  cancelada:  "Cancelada",
};

const calcNight = contarNoches;

const FORM_VACIO = {
  nombre:     "",
  documento:  "",
  email:      "",
  telefono:   "",
  habitacion: "",
  checkin:    "",
  checkout:   "",
  huespedes:  "2",
};

const fmtMoney = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n || 0);

export default function ReservasPage() {
  const { reservas, loading } = useReservas();
  const { habitaciones, loading: cargandoHabs } = useHabitaciones();
  const { usuario } = useAuth();
  const { toast, ToastContainer } = useToast();

  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [confirmarCancelar, setConfirmarCancelar] = useState(null); // reserva a cancelar
  const [errFecha, setErrFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState(FORM_VACIO);

  // Abrir el formulario desde el calendario o el botón "Nueva reserva"
  // (?nueva=1&hab=101&ci=2026-10-20&co=2026-10-22)
  useEffect(() => {
    if (!params.get("nueva")) return;
    setForm({
      ...FORM_VACIO,
      habitacion: params.get("hab") || "",
      checkin: params.get("ci") || "",
      checkout: params.get("co") || "",
    });
    setErrFecha("");
    setModal(true);
    setParams({}, { replace: true });
  }, [params, setParams]);

  // Solo se ofrecen habitaciones libres en TODAS las noches elegidas
  const disponibles = habitacionesLibres(habitaciones, reservas, form.checkin, form.checkout);

  const habSeleccionada = disponibles.find((h) => h.numero === form.habitacion);
  const noches = calcNight(form.checkin, form.checkout);
  const totalEstimado = noches * (habSeleccionada?.precio || 0);

  const handleFechaChange = (campo, valor) => {
    const nuevoForm = { ...form, [campo]: valor };
    const ci = campo === "checkin"  ? valor : form.checkin;
    const co = campo === "checkout" ? valor : form.checkout;

    if (ci && co && co <= ci) {
      setErrFecha("La fecha de salida debe ser posterior a la de entrada.");
    } else {
      setErrFecha("");
    }
    // Si la habitación elegida deja de estar libre con las nuevas fechas, se quita
    const libres = habitacionesLibres(habitaciones, reservas, ci, co);
    if (nuevoForm.habitacion && !libres.some((h) => h.numero === nuevoForm.habitacion)) {
      nuevoForm.habitacion = "";
    }
    setForm(nuevoForm);
  };

  const handleCrear = async (e) => {
    e.preventDefault();

    if (form.checkout && form.checkin && form.checkout <= form.checkin) {
      setErrFecha("La fecha de salida debe ser posterior a la de entrada.");
      return;
    }

    setGuardando(true);
    try {
      const habObj = habitaciones.find((h) => h.numero === form.habitacion);

      await crearReserva(
        {
          ...form,
          huespedes: Number(form.huespedes) || 1,
          precioNoche: habObj?.precio || 0,
          total: totalEstimado,
        },
        usuario
      );

      toast(`Reserva creada para ${form.nombre} ✓`);

      setModal(false);
      setErrFecha("");
      setForm(FORM_VACIO);
    } catch (error) {
      console.error(error);
      if (error.message === "OCUPADA") {
        toast(`La habitación ${form.habitacion} ya está ocupada la noche del ${error.noche}. Elige otra.`);
        setForm((f) => ({ ...f, habitacion: "" }));
      } else {
        toast("Error al crear reserva");
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleCancelar = async () => {
    if (!confirmarCancelar) return;
    try {
      // Libera las noches de la reserva en el calendario
      await cancelarReserva(confirmarCancelar, usuario);
      toast(`Reserva de ${confirmarCancelar.nombre} cancelada`);
    } catch (err) {
      console.error(err);
      toast("Error al cancelar reserva");
    } finally {
      setConfirmarCancelar(null);
    }
  };

  const filtros = ["todas", "confirmada", "pendiente", "checkin", "checkout", "cancelada"];
  const creada = (r) => r.creadaEn?.toMillis?.() || 0;
  const filtradas = reservas
    .filter((r) => filtro === "todas" || r.estado === filtro)
    .sort((a, b) => creada(b) - creada(a));

  return (
    <>
      <ToastContainer />

      {/* ─── Modal confirmación cancelar ─── */}
      {confirmarCancelar && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setConfirmarCancelar(null)}
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "var(--red)" }}>
                Cancelar reserva
              </div>
              <button className="modal-close" onClick={() => setConfirmarCancelar(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="notif notif-red">
                <span className="notif-icon">⚠️</span>
                <div>
                  <div className="notif-title">¿Seguro que deseas cancelar esta reserva?</div>
                  <div className="notif-text">
                    Esta acción no borrará el historial, solo cambiará el estado de la reserva a <strong>cancelada</strong>.
                    Quedará registro de quién la canceló y cuándo.
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, background: "var(--bg4)", borderRadius: 10, padding: "12px 16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--white)", marginBottom: 4 }}>
                  {confirmarCancelar.nombre}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Hab. {confirmarCancelar.habitacion} · {confirmarCancelar.checkin} → {confirmarCancelar.checkout}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setConfirmarCancelar(null)}
              >
                No cancelar
              </button>
              <button
                className="btn btn-sm"
                style={{ background: "rgba(231,76,60,0.15)", color: "var(--red)", border: "1px solid rgba(231,76,60,0.3)", borderRadius: 8 }}
                onClick={handleCancelar}
              >
                Sí, cancelar reserva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal crear reserva ─── */}
      {modal && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setModal(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Nueva Reserva</div>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCrear}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Nombre completo</label>
                    <input
                      className="form-input"
                      required
                      placeholder="Ej. María García"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Documento</label>
                    <input
                      className="form-input"
                      required
                      placeholder="CC / Pasaporte"
                      value={form.documento}
                      onChange={(e) => setForm({ ...form, documento: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Check-in</label>
                    <input
                      className="form-input"
                      type="date"
                      required
                      min={hoyISO()}
                      value={form.checkin}
                      onChange={(e) => handleFechaChange("checkin", e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Check-out</label>
                    <input
                      className="form-input"
                      type="date"
                      required
                      value={form.checkout}
                      min={form.checkin || undefined}
                      onChange={(e) => handleFechaChange("checkout", e.target.value)}
                    />
                  </div>
                </div>

                {/* Resumen de estancia */}
                {noches > 0 && (
                  <div style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {noches} noche{noches !== 1 ? "s" : ""}
                      {habSeleccionada ? ` · ${fmtMoney(habSeleccionada.precio)}/noche` : ""}
                    </span>
                    {habSeleccionada && (
                      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: "var(--gold)", fontSize: 15 }}>
                        Total: {fmtMoney(totalEstimado)}
                      </span>
                    )}
                  </div>
                )}

                {errFecha && (
                  <div style={{ color: "var(--red)", fontSize: 11, marginBottom: 10, padding: "6px 10px", background: "rgba(231,76,60,0.08)", borderRadius: 6 }}>
                    ⚠ {errFecha}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Habitación</label>
                    <select
                      className="form-input form-select"
                      required
                      value={form.habitacion}
                      onChange={(e) => setForm({ ...form, habitacion: e.target.value })}
                    >
                      <option value="">
                        {!form.checkin || !form.checkout
                          ? "Elige primero las fechas"
                          : cargandoHabs
                          ? "Cargando habitaciones..."
                          : disponibles.length
                          ? "Seleccionar..."
                          : "No hay habitaciones libres en esas fechas"}
                      </option>
                      {disponibles.map((h) => (
                        <option key={h.id} value={h.numero}>
                          {h.numero} – {h.tipo} · {fmtMoney(h.precio)}/noche
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Huéspedes</label>
                    <select
                      className="form-input form-select"
                      value={form.huespedes}
                      onChange={(e) => setForm({ ...form, huespedes: e.target.value })}
                    >
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>{n} persona{n > 1 ? "s" : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono / WhatsApp *</label>
                    <input
                      className="form-input"
                      type="tel"
                      required
                      placeholder="Ej. 3001234567"
                      value={form.telefono}
                      onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-gold btn-sm" disabled={!!errFecha || guardando}>
                  {guardando ? "Guardando..." : "Confirmar reserva"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Tabla principal ─── */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Todas las reservas</div>
          <button className="btn btn-gold btn-sm" onClick={() => setModal(true)}>+ Nueva</button>
        </div>

        <div style={{ padding: "12px 20px" }}>
          <div className="chip-row">
            {filtros.map((f) => (
              <div
                key={f}
                className={`chip ${filtro === f ? "active" : ""}`}
                onClick={() => setFiltro(f)}
              >
                {f === "todas" ? "Todas" : (badgeLabel[f] || f)}
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            No hay reservas {filtro !== "todas" ? `con estado "${badgeLabel[filtro] || filtro}"` : ""}.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Huésped</th>
                <th>Contacto</th>
                <th>Hab.</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Noches</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => {
                const noches = calcNight(r.checkin, r.checkout);
                const cancelada = r.estado === "cancelada" || r.estado === "checkout";
                return (
                  <tr key={r.id} style={{ opacity: cancelada ? 0.6 : 1 }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="av">{initials(r.nombre)}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{r.nombre}</div>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>CC: {r.documento || "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 11 }}>
                        {r.telefono && (
                          <div style={{ color: "var(--green)", fontWeight: 600 }}>📱 {r.telefono}</div>
                        )}
                        {r.email && (
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>{r.email}</div>
                        )}
                        {!r.telefono && !r.email && <span style={{ color: "var(--muted)" }}>—</span>}
                      </div>
                    </td>
                    <td><span className="room-tag">{r.habitacion}</span></td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{r.checkin}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{r.checkout}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {noches > 0 ? `${noches}n` : "—"}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600 }}>
                      {r.total ? fmtMoney(r.total) : noches > 0 && r.precioNoche ? fmtMoney(noches * r.precioNoche) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass[r.estado] || "b-gray"}`}>
                        {badgeLabel[r.estado] || r.estado}
                      </span>
                    </td>
                    <td style={{ display: "flex", gap: 6 }}>
                      {(r.estado === "confirmada" || r.estado === "pendiente") && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={r.checkin > hoyISO()}
                          title={r.checkin > hoyISO() ? `Llega el ${r.checkin}` : "Hacer check-in"}
                          onClick={async () => {
                            const hab = habitaciones.find((h) => h.numero === r.habitacion);
                            try {
                              await hacerCheckin(r, hab, usuario);
                              toast("Check-in realizado ✓");
                            } catch (err) {
                              console.error(err);
                              toast("Error al hacer check-in");
                            }
                          }}
                        >
                          Check-in
                        </button>
                      )}

                      {/* Solo mostrar cancelar si no está ya cancelada o completa */}
                      {r.estado !== "cancelada" && r.estado !== "checkout" && (
                        <button
                          className="btn btn-sm"
                          title="Cancelar reserva"
                          style={{
                            background: "rgba(231,76,60,0.08)",
                            color: "var(--red)",
                            border: "1px solid rgba(231,76,60,0.2)",
                            borderRadius: 8,
                          }}
                          onClick={() => setConfirmarCancelar(r)}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
