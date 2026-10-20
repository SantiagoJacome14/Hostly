import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { firebaseConfigurado } from "./firebase/config";
import "./styles/global.css";

const FaltaConfiguracion = () => (
  <div className="loading-screen" style={{ flexDirection: "column", gap: 12, textAlign: "center", padding: 24 }}>
    <div>Falta configurar Firebase</div>
    <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "var(--muted)", letterSpacing: 0, maxWidth: 440 }}>
      Copia <code>.env.example</code> como <code>.env</code>, pega los datos de tu proyecto de Firebase
      y reinicia con <code>npm run dev</code>.
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {firebaseConfigurado ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <FaltaConfiguracion />
    )}
  </React.StrictMode>
);
