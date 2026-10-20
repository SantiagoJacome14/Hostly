import { useState } from "react";
import { useReservas } from "../hooks/useReservas.jsx";
import { useHabitaciones } from "../hooks/useHabitaciones.jsx";
import { useAuth } from "../context/AuthContext";
import { hacerCheckout } from "../firebase/firestore";
import { useToast } from "../hooks/useToast.jsx";
import { contarNoches as calcNight } from "../utils/disponibilidad";

const initials = (n) =>
  n?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "??";

const fmtMoney = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n || 0);

export default function CheckoutPage() {
  const { reservas } = useReservas();
  const { habitaciones } = useHabitaciones();
  const { usuario } = useAuth();
  const { toast, ToastContainer } = useToast();

  const enEstancia = reservas.filter((r) => r.estado === "checkin");

  // Modal de checkout con pago
  const [modalCO, setModalCO] = useState(null); // reserva seleccionada
  const [formCO, setFormCO] = useState({
    metodo: "Efectivo",
    monto: "",
    estadoHab: "limpieza",
    observacion: "",
  });
  const [procesando, setProcesando] = useState(false);

  const abrirCheckout = (res) => {
    const noches = calcNight(res.checkin, res.checkout);
    const montoSugerido = res.total || (noches * (res.precioNoche || 0));
    setFormCO({
      metodo: "Efectivo",
      monto: montoSugerido ? String(montoSugerido) : "",
      estadoHab: "limpieza",
      observacion: "",
    });
    setModalCO(res);
  };

  const confirmarCheckout = async () => {
    if (!modalCO) return;
    setProcesando(true);
    try {
      const res = modalCO;
      const hab = habitaciones.find((h) => h.numero === res.habitacion);
      // Todo en una sola operación: si algo falla no queda nada a medias
      await hacerCheckout(res, hab, formCO, usuario);
      toast(`Check-out completado — Hab. ${res.habitacion} en ${formCO.estadoHab}`);
      setModalCO(null);
    } catch (err) {
      console.error(err);
      toast("Error al procesar checkout");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <ToastContainer />

      {/* Modal checkout */}
      {modalCO && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setModalCO(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Registrar Check-out</div>
              <button type="button" className="modal-close" onClick={() => setModalCO(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Resumen del huésped */}
              <div style={{ background: "var(--bg4)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--white)", marginBottom: 4 }}>
                  {modalCO.nombre}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Hab. {modalCO.habitacion} · {modalCO.checkin} → {modalCO.checkout}
                  {calcNight(modalCO.checkin, modalCO.checkout) > 0 &&
                    ` · ${calcNight(modalCO.checkin, modalCO.checkout)} noches`}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Monto cobrado (COP)</label>
                  <input
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej. 300000"
                    value={formCO.monto}
                    onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                    autoComplete="off"
                    onChange={(e) => {
                      const limpio = e.target.value.replace(/\D/g, "");
                      setFormCO((prev) => ({ ...prev, monto: limpio }));
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Método de pago</label>
                  <select
                    className="form-input form-select"
                    value={formCO.metodo}
                    onChange={(e) => setFormCO({ ...formCO, metodo: e.target.value })}
                  >
                    <option>Efectivo</option>
                    <option>Tarjeta débito</option>
                    <option>Tarjeta crédito</option>
                    <option>Transferencia</option>
                    <option>Nequi / Daviplata</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Estado final de la habitación</label>
                <select
                  className="form-input form-select"
                  value={formCO.estadoHab}
                  onChange={(e) => setFormCO({ ...formCO, estadoHab: e.target.value })}
                >
                  <option value="limpieza">En limpieza</option>
                  <option value="disponible">Disponible de inmediato</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Observaciones</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Notas del check-out..."
                  style={{ resize: "none" }}
                  value={formCO.observacion}
                  onChange={(e) => setFormCO({ ...formCO, observacion: e.target.value })}
                />
              </div>

              {Number(formCO.monto) > 0 && (
                <div style={{ background: "rgba(212,168,67,0.06)", border: "1px solid rgba(212,168,67,0.15)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--muted)" }}>
                  Se registrará automáticamente un ingreso de{" "}
                  <strong style={{ color: "var(--gold)" }}>{fmtMoney(Number(formCO.monto))}</strong>
                  {" "}en el módulo de Ingresos.
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setModalCO(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-gold btn-sm"
                onClick={confirmarCheckout}
                disabled={procesando}
              >
                {procesando ? "Procesando..." : "Confirmar check-out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner informativo */}
      <div className="notif notif-red" style={{ marginBottom: 16 }}>
        <span className="notif-icon">🚪</span>
        <div>
          <div className="notif-title">Proceso de Check-out</div>
          <div className="notif-text">
            Al confirmar el check-out se registrará el pago, se guardará en el historial de estancias
            y la habitación pasará al estado seleccionado.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            Huéspedes en estancia ({enEstancia.length})
          </div>
        </div>
        <div className="panel-body">
          {enEstancia.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--muted)", fontSize: 13 }}>
              No hay huéspedes activos. Realiza un check-in primero.
            </div>
          ) : enEstancia.map((r) => {
            const noches = calcNight(r.checkin, r.checkout);
            return (
              <div key={r.id} style={{
                background: "var(--bg4)", border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 10, padding: "14px 16px", marginBottom: 10,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div className="av" style={{ width: 38, height: 38, fontSize: 13 }}>
                    {initials(r.nombre)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--white)" }}>
                      {r.nombre}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      Hab. {r.habitacion} · Salida: {r.checkout}
                      {noches > 0 && ` · ${noches} noches`}
                      {r.total ? ` · ${fmtMoney(r.total)}` : ""}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button className="btn btn-gold btn-sm" onClick={() => abrirCheckout(r)}>
                    Check-out
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
