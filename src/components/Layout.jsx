// ============================================================
//  src/components/Layout.jsx
//  Sidebar + topbar — el esqueleto visual de la app
// ============================================================

import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

// Navegación permitida por rol
const NAV_POR_ROL = {
  admin: [
    {
      section: "Principal",
      items: [
        { path: "/", icon: "◈", label: "Inicio" },
      ],
    },
    {
      section: "Operación",
      items: [
        { path: "/calendario",  icon: "▥",  label: "Calendario" },
        { path: "/reservas",    icon: "📅", label: "Reservas",         badge: "live" },
        { path: "/checkin",     icon: "↘",  label: "Check-in" },
        { path: "/checkout",    icon: "↗",  label: "Check-out" },
        { path: "/habitaciones",icon: "▦",  label: "Habitaciones" },
        { path: "/clientes",    icon: "◉",  label: "Clientes" },
        { path: "/historial",   icon: "📋", label: "Historial estancias" },
      ],
    },
    {
      section: "Finanzas",
      items: [
        { path: "/ingresos",        icon: "◎", label: "Ingresos" },
        { path: "/egresos",         icon: "◎", label: "Egresos" },
        { path: "/pagos-empleados", icon: "◎", label: "Pagos empleados" },
        { path: "/reportes",        icon: "▤", label: "Reportes" },
      ],
    },
    {
      section: "Contabilidad",
      items: [
        { path: "/informes-contables", icon: "📄", label: "Informes contables" },
        { path: "/auditoria",          icon: "🔍", label: "Auditoría" },
      ],
    },
    {
      section: "Sistema",
      items: [
        { path: "/accesos",  icon: "◈", label: "Control acceso", badge: "live" },
        { path: "/usuarios", icon: "◉", label: "Usuarios / empleados" },
        { path: "/configuracion", icon: "⚙", label: "Configuración" },
      ],
    },
  ],

  recepcionista: [
    {
      section: "Principal",
      items: [
        { path: "/", icon: "◈", label: "Inicio" },
      ],
    },
    {
      section: "Gestión",
      items: [
        { path: "/calendario",  icon: "▥",  label: "Calendario" },
        { path: "/reservas",    icon: "📅", label: "Reservas",    badge: "live" },
        { path: "/checkin",     icon: "↘",  label: "Check-in" },
        { path: "/checkout",    icon: "↗",  label: "Check-out" },
        { path: "/habitaciones",icon: "▦",  label: "Habitaciones" },
        { path: "/clientes",    icon: "◉",  label: "Clientes" },
        { path: "/historial",   icon: "📋", label: "Historial" },
      ],
    },
  ],

  servicio: [
    {
      section: "Principal",
      items: [
        { path: "/", icon: "◈", label: "Inicio" },
      ],
    },
    {
      section: "Limpieza",
      items: [
        { path: "/servicio", icon: "🧹", label: "Limpieza y habitaciones", badge: "live" },
      ],
    },
  ],

  contador: [
    {
      section: "Principal",
      items: [
        { path: "/", icon: "◈", label: "Inicio" },
      ],
    },
    {
      section: "Finanzas",
      items: [
        { path: "/reportes",        icon: "▤", label: "Reportes" },
        { path: "/ingresos",        icon: "◎", label: "Ingresos" },
        { path: "/egresos",         icon: "◎", label: "Egresos" },
        { path: "/pagos-empleados", icon: "◎", label: "Pagos empleados" },
      ],
    },
    {
      section: "Contabilidad",
      items: [
        { path: "/informes-contables", icon: "📄", label: "Informes contables" },
        { path: "/auditoria",          icon: "🔍", label: "Auditoría financiera" },
      ],
    },
  ],

  vigilante: [
    {
      section: "Principal",
      items: [
        { path: "/", icon: "◈", label: "Inicio" },
      ],
    },
    {
      section: "Seguridad",
      items: [
        { path: "/accesos", icon: "◈", label: "Control de Acceso", badge: "live" },
      ],
    },
  ],
};

const AVATARES = {
  admin:         "AD",
  recepcionista: "RC",
  servicio:      "SV",
  contador:      "CT",
  vigilante:     "VG",
};

const COLORES = {
  admin:         "#9B59B6",
  recepcionista: "#D4A843",
  servicio:      "#2ECC71",
  contador:      "#3498DB",
  vigilante:     "#E74C3C",
};

const LABELS_ROL = {
  admin:         "Administrador",
  recepcionista: "Recepcionista",
  servicio:      "Servicio",
  contador:      "Contador",
  vigilante:     "Vigilante",
};

export default function Layout() {
  const { usuario, rol, hotel, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const rolActual = rol || "recepcionista";
  const secciones = NAV_POR_ROL[rolActual] || NAV_POR_ROL.recepcionista;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    toast.success("Sesión cerrada");
  };

  const paginaActual =
    secciones
      .flatMap((sec) => sec.items)
      .find((item) => item.path === location.pathname)?.label || "Hostly";

  return (
    <div style={s.app}>
      {/* ───────── SIDEBAR ───────── */}
      <div style={s.sidebar}>
        {/* Logo */}
        <div style={s.logoArea}>
          <div style={s.logoMark}>
            <div style={s.logoIcon}>H</div>
            <div>
              <div style={s.logoText}>Hostly</div>
              <div style={s.logoSub} title={hotel?.nombre}>{hotel?.nombre || "Hotel Management"}</div>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav style={s.nav}>
          {secciones.map((sec) => (
            <div key={sec.section}>
              <div style={s.navSection}>{sec.section}</div>

              {sec.items.map((item) => {
                const active = location.pathname === item.path;

                return (
                  <div
                    key={item.path}
                    style={{
                      ...s.navItem,
                      ...(active ? s.navItemActive : {}),
                    }}
                    onClick={() => navigate(item.path)}
                  >
                    {active && <div style={s.navIndicator} />}

                    <span style={{ width: 16, textAlign: "center" }}>
                      {item.icon}
                    </span>

                    <span style={{ flex: 1 }}>{item.label}</span>

                    {item.badge === "live" && (
                      <span style={s.liveDot} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={s.sidebarFooter}>
          <div
            style={{
              ...s.sfAvatar,
              color: COLORES[rolActual] || "#D4A843",
              borderColor: `${COLORES[rolActual]}33`,
            }}
          >
            {AVATARES[rolActual] || "??"}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={s.sfName} title={usuario?.email}>
              {usuario?.nombre || LABELS_ROL[rolActual] || rolActual}
            </div>
            <div style={{ ...s.sfRole, color: "#6B6660" }}>
              {LABELS_ROL[rolActual] || rolActual}
            </div>
          </div>

          <button
            title="Cerrar sesión"
            style={s.logoutBtn}
            onClick={handleLogout}
          >
            ⏻
          </button>
        </div>
      </div>

      {/* ───────── MAIN ───────── */}
      <div style={s.main}>
        {/* Topbar */}
        <div style={s.topbar}>
          <div style={s.topbarTitle}>{paginaActual}</div>

          <div style={s.statusPill}>
            <div style={s.statusDot} />
            Sistema operativo
          </div>

          <div style={s.topbarDate}>
            {new Date().toLocaleDateString("es-CO", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>

          {(rolActual === "admin" || rolActual === "recepcionista") && (
            <button
              style={s.btnGold}
              onClick={() => navigate("/reservas?nueva=1")}
            >
              + Nueva reserva
            </button>
          )}
        </div>

        {/* Contenido dinámico */}
        <div style={s.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Estilos inline
// ─────────────────────────────────────────

const s = {
  app: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "Inter, sans-serif",
  },

  sidebar: {
    width: 220,
    background: "#111111",
    borderRight: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    position: "relative",
  },

  logoArea: {
    padding: "24px 20px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },

  logoMark: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  logoIcon: {
    width: 32,
    height: 32,
    background: "#D4A843",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Syne, sans-serif",
    fontWeight: 800,
    fontSize: 15,
    color: "#0A0A0A",
    flexShrink: 0,
  },

  logoText: {
    fontFamily: "Syne, sans-serif",
    fontSize: 18,
    fontWeight: 800,
    color: "#F5F0E8",
  },

  logoSub: {
    fontSize: 9,
    color: "#6B6660",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginTop: 2,
    maxWidth: 130,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  nav: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 10px",
  },

  navSection: {
    fontSize: 9,
    color: "#4A4540",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    padding: "0 8px",
    margin: "14px 0 5px",
  },

  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 10px",
    borderRadius: 8,
    color: "#6B6660",
    fontSize: 12.5,
    cursor: "pointer",
    transition: "all .15s",
    marginBottom: 1,
    position: "relative",
    border: "1px solid transparent",
  },

  navItemActive: {
    background: "rgba(212,168,67,0.1)",
    borderColor: "rgba(212,168,67,0.2)",
    color: "#F0C96A",
  },

  navIndicator: {
    position: "absolute",
    left: 0,
    top: "25%",
    bottom: "25%",
    width: 2,
    background: "#D4A843",
    borderRadius: 2,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#2ECC71",
    flexShrink: 0,
  },

  sidebarFooter: {
    padding: "12px 16px",
    borderTop: "1px solid rgba(255,255,255,0.04)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  sfAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(212,168,67,0.1)",
    border: "1px solid rgba(212,168,67,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
  },

  sfName: {
    fontSize: 12,
    fontWeight: 500,
    color: "#E8E0D0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  sfRole: {
    fontSize: 10,
    color: "#6B6660",
  },

  logoutBtn: {
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "#6B6660",
    cursor: "pointer",
    fontSize: 15,
    flexShrink: 0,
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#0A0A0A",
  },

  topbar: {
    height: 56,
    background: "#111111",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    display: "flex",
    alignItems: "center",
    padding: "0 28px",
    gap: 14,
    flexShrink: 0,
  },

  topbarTitle: {
    fontFamily: "Syne, sans-serif",
    fontSize: 15,
    fontWeight: 700,
    color: "#F5F0E8",
    flex: 1,
  },

  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 20,
    background: "rgba(46,204,113,0.08)",
    border: "1px solid rgba(46,204,113,0.2)",
    fontSize: 11,
    fontWeight: 500,
    color: "#2ECC71",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#2ECC71",
  },

  topbarDate: {
    fontSize: 11,
    color: "#6B6660",
  },

  btnGold: {
    padding: "7px 14px",
    background: "#D4A843",
    border: "none",
    borderRadius: 8,
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: "#0A0A0A",
    cursor: "pointer",
  },

  content: {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px",
  },
};
