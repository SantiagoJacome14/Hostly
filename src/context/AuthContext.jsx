import { createContext, useContext, useEffect, useState } from "react";
import { escucharSesion, escucharPerfil, escucharHotel, logout } from "../firebase/auth";
import { setHotelActual } from "../firebase/firestore";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(undefined); // undefined = aún no se sabe
  const [perfil, setPerfil] = useState(undefined);
  const [hotel, setHotel] = useState(null);

  // 1. Sesión de Firebase Auth
  useEffect(() => escucharSesion((user) => setAuthUser(user || null)), []);

  // 2. Perfil en usuarios/{uid}. Se escucha en tiempo real porque al registrar
  //    un hotel el perfil se crea unos milisegundos después de la cuenta.
  useEffect(() => {
    if (!authUser) {
      setPerfil(authUser === null ? null : undefined);
      return;
    }
    setPerfil(undefined);
    return escucharPerfil(
      authUser.uid,
      (datos) => setPerfil(datos),
      () => setPerfil(null)
    );
  }, [authUser]);

  // 3. Hotel del usuario
  const perfilActivo = perfil && perfil.activo !== false && perfil.hotelId ? perfil : null;
  const hotelId = perfilActivo?.hotelId || null;
  setHotelActual(hotelId);

  useEffect(() => {
    if (!hotelId) { setHotel(null); return; }
    return escucharHotel(hotelId, setHotel);
  }, [hotelId]);

  const loading = authUser === undefined || (authUser && perfil === undefined);

  return (
    <AuthContext.Provider
      value={{
        usuario: perfilActivo,
        rol: perfilActivo?.rol || null,
        hotel,
        hotelId,
        // Sesión abierta pero sin perfil válido (cuenta desactivada o sin hotel)
        sinAcceso: Boolean(authUser && perfil !== undefined && !perfilActivo),
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
