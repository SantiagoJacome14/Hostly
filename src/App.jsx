// ==========================================
// HOSTLY — Enrutador principal
// Protege rutas según rol del usuario
// ==========================================

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ReservasPage from "./pages/ReservasPage";
import CheckinPage from "./pages/CheckinPage";
import CheckoutPage from "./pages/CheckoutPage";
import HabitacionesPage from "./pages/HabitacionesPage";
import ClientesPage from "./pages/ClientesPage";
import ServicioPage from "./pages/ServicioPage";
import ReportesPage from "./pages/ReportesPage";
import IngresosPage from "./pages/IngresosPage";
import AccesosPage from "./pages/AccesosPage";
import HistorialPage from "./pages/HistorialPage";
import EgresosPage from "./pages/EgresosPage";
import PagosEmpleadosPage from "./pages/PagosEmpleadosPage";
import UsuariosPage from "./pages/UsuariosPage";
import AuditoriaPage from "./pages/AuditoriaPage";
import InformesContablesPage from "./pages/InformesContablesPage";
import CalendarioPage from "./pages/CalendarioPage";
import ConfiguracionPage from "./pages/ConfiguracionPage";

// Rutas permitidas por rol
const ROL_RUTAS = {
  admin: [
    "/",
    "/calendario",
    "/reservas",
    "/checkin",
    "/checkout",
    "/habitaciones",
    "/clientes",
    "/historial",
    "/ingresos",
    "/egresos",
    "/pagos-empleados",
    "/reportes",
    "/accesos",
    "/usuarios",
    "/auditoria",
    "/informes-contables",
    "/configuracion",
  ],

  recepcionista: [
    "/",
    "/calendario",
    "/reservas",
    "/checkin",
    "/checkout",
    "/habitaciones",
    "/clientes",
    "/historial",
  ],

  servicio: [
    "/",
    "/servicio",
  ],

  contador: [
    "/",
    "/reportes",
    "/ingresos",
    "/egresos",
    "/pagos-empleados",
    "/auditoria",
    "/informes-contables",
  ],

  vigilante: [
    "/",
    "/accesos",
  ],
};

const ProtectedRoute = ({ children, ruta }) => {
  const { usuario, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Cargando Hostly...</div>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  const permitidas = ROL_RUTAS[usuario.rol] || [];

  if (!permitidas.includes(ruta)) {
    return <Navigate to={permitidas[0] || "/login"} replace />;
  }

  return children;
};

const SinAcceso = () => {
  const { logout } = useAuth();
  return (
    <div className="loading-screen" style={{ flexDirection: "column", gap: 14, textAlign: "center", padding: 24 }}>
      <div>Tu cuenta no tiene acceso a ningún hotel</div>
      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--muted)", letterSpacing: 0 }}>
        Puede estar desactivada. Habla con el administrador del hotel.
      </div>
      <button className="btn btn-outline btn-sm" onClick={logout}>Cerrar sesión</button>
    </div>
  );
};

export default function App() {
  const { usuario, loading, sinAcceso } = useAuth();

  if (loading) {
    return <div className="loading-screen">Iniciando Hostly...</div>;
  }

  if (sinAcceso) {
    return <SinAcceso />;
  }

  if (!usuario) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>

        {/* Inicio (dashboard por rol) */}
        <Route
          index
          element={
            <ProtectedRoute ruta="/">
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Recepcionista + Admin */}
        <Route path="calendario" element={<ProtectedRoute ruta="/calendario"><CalendarioPage /></ProtectedRoute>} />
        <Route path="reservas" element={<ProtectedRoute ruta="/reservas"><ReservasPage /></ProtectedRoute>} />
        <Route path="checkin" element={<ProtectedRoute ruta="/checkin"><CheckinPage /></ProtectedRoute>} />
        <Route path="checkout" element={<ProtectedRoute ruta="/checkout"><CheckoutPage /></ProtectedRoute>} />
        <Route path="habitaciones" element={<ProtectedRoute ruta="/habitaciones"><HabitacionesPage /></ProtectedRoute>} />
        <Route path="clientes" element={<ProtectedRoute ruta="/clientes"><ClientesPage /></ProtectedRoute>} />
        <Route path="historial" element={<ProtectedRoute ruta="/historial"><HistorialPage /></ProtectedRoute>} />

        {/* Servicio / Housekeeping */}
        <Route path="servicio" element={<ProtectedRoute ruta="/servicio"><ServicioPage /></ProtectedRoute>} />

        {/* Contador + Admin */}
        <Route path="reportes" element={<ProtectedRoute ruta="/reportes"><ReportesPage /></ProtectedRoute>} />
        <Route path="ingresos" element={<ProtectedRoute ruta="/ingresos"><IngresosPage /></ProtectedRoute>} />
        <Route path="egresos" element={<ProtectedRoute ruta="/egresos"><EgresosPage /></ProtectedRoute>} />
        <Route path="pagos-empleados" element={<ProtectedRoute ruta="/pagos-empleados"><PagosEmpleadosPage /></ProtectedRoute>} />

        {/* Vigilante + Admin */}
        <Route path="accesos" element={<ProtectedRoute ruta="/accesos"><AccesosPage /></ProtectedRoute>} />

        {/* Admin exclusivo */}
        <Route path="usuarios" element={<ProtectedRoute ruta="/usuarios"><UsuariosPage /></ProtectedRoute>} />
        <Route path="configuracion" element={<ProtectedRoute ruta="/configuracion"><ConfiguracionPage /></ProtectedRoute>} />

        {/* Admin + Contador */}
        <Route path="auditoria" element={<ProtectedRoute ruta="/auditoria"><AuditoriaPage /></ProtectedRoute>} />
        <Route path="informes-contables" element={<ProtectedRoute ruta="/informes-contables"><InformesContablesPage /></ProtectedRoute>} />

      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
