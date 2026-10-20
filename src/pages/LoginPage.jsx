// ==========================================
// HOSTLY — Página de Login
// ==========================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/config";
import { login, registrarHotel } from "../firebase/auth";

const MENSAJES_ERROR = {
  "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Ingresa con él.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/invalid-email": "El correo no es válido.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
  "auth/network-request-failed": "Sin conexión a internet.",
};

export default function LoginPage() {
  // "login" | "registro" | "recuperar"
  const [modo, setModo] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [nombreHotel, setNombreHotel] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const cambiarModo = (m) => {
    setModo(m);
    setError("");
    setAviso("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAviso("");

    try {
      if (modo === "registro") {
        await registrarHotel({ nombreHotel, ciudad, nombre, email, password });
        navigate("/configuracion");
      } else if (modo === "recuperar") {
        await sendPasswordResetEmail(auth, email);
        setAviso("Te enviamos un correo para crear una nueva contraseña.");
      } else {
        await login(email, password);
        navigate("/");
      }
    } catch (error) {
      console.error(error);
      setError(
        MENSAJES_ERROR[error.code] ||
          (modo === "login"
            ? "Credenciales incorrectas. Verifica tu email y contraseña."
            : "No se pudo completar. Intenta de nuevo.")
      );
    } finally {
      setLoading(false);
    }
  };

  const subtitulo = {
    login: "Ingresa con tus credenciales",
    registro: "Registra tu hotel. Quedarás como administrador.",
    recuperar: "Te enviaremos un enlace para cambiar tu contraseña",
  }[modo];

  const textoBoton = {
    login: loading ? "Iniciando sesión..." : "Ingresar al sistema →",
    registro: loading ? "Registrando..." : "Registrar mi hotel →",
    recuperar: loading ? "Enviando..." : "Enviar enlace →",
  }[modo];

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      backgroundImage:
        "radial-gradient(ellipse at 30% 20%, rgba(212,168,67,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(212,168,67,0.04) 0%, transparent 50%)"
    }}>
      {/* Grid decorativo */}
      <div style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        backgroundImage:
          "repeating-linear-gradient(90deg,rgba(255,255,255,0.02) 0,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 80px),repeating-linear-gradient(180deg,rgba(255,255,255,0.02) 0,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 80px)"
      }} />

      <div style={{
        background: "var(--bg2)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "40px 44px",
        width: "min(440px, calc(100vw - 32px))",
        position: "relative",
        zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 48,
            height: 48,
            background: "var(--gold)",
            borderRadius: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Syne',sans-serif",
            fontSize: 22,
            fontWeight: 800,
            color: "#0A0A0A",
            marginBottom: 12
          }}>
            H
          </div>

          <div style={{
            fontFamily: "'Syne',sans-serif",
            fontSize: 24,
            fontWeight: 800,
            color: "var(--white)"
          }}>
            Hostly
          </div>

          <div style={{
            fontSize: 12,
            color: "var(--muted)",
            marginTop: 4
          }}>
            {subtitulo}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {modo === "registro" && (
            <>
              <div className="form-group">
                <label className="form-label">Nombre del hotel</label>
                <input className="form-input" required placeholder="Ej. Hotel Los Andes" value={nombreHotel} onChange={(e) => setNombreHotel(e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ciudad</label>
                  <input className="form-input" placeholder="Ej. Bucaramanga" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tu nombre</label>
                  <input className="form-input" required placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="tu@hotel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {modo !== "recuperar" && (
            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                className="form-input"
                type="password"
                placeholder={modo === "registro" ? "Mínimo 6 caracteres" : "••••••••"}
                minLength={modo === "registro" ? 6 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}

          {aviso && (
            <div style={{
              background: "rgba(46,204,113,0.1)",
              border: "1px solid rgba(46,204,113,0.25)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "var(--green)",
              marginBottom: 14
            }}>
              {aviso}
            </div>
          )}

          {error && (
            <div style={{
              background: "rgba(231,76,60,0.1)",
              border: "1px solid rgba(231,76,60,0.25)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "var(--red)",
              marginBottom: 14
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-gold"
            style={{
              width: "100%",
              padding: "11px",
              fontSize: 13,
              marginTop: 4
            }}
            disabled={loading}
          >
            {textoBoton}
          </button>
        </form>

        <div style={{
          textAlign: "center",
          marginTop: 20,
          fontSize: 11,
          color: "var(--muted)"
        }}>
          {modo === "login" ? (
            <>
              <span style={s.link} onClick={() => cambiarModo("recuperar")}>¿Olvidaste tu contraseña?</span>
              <div style={{ marginTop: 10 }}>
                ¿Tu hotel aún no usa Hostly?{" "}
                <span style={s.link} onClick={() => cambiarModo("registro")}>Registrar mi hotel</span>
              </div>
              <div style={{ marginTop: 10 }}>¿Eres empleado? Pide tu acceso al administrador del hotel.</div>
            </>
          ) : (
            <span style={s.link} onClick={() => cambiarModo("login")}>← Volver a ingresar</span>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  link: { color: "var(--gold)", cursor: "pointer", textDecoration: "underline" },
};
