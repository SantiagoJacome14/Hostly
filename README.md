# Hostly

Sistema de gestión hotelera para hoteles pequeños y medianos en Colombia: reservas, calendario de habitaciones, check-in y check-out, finanzas, auditoría y roles por empleado.

**Stack:** React 18 + Vite · Firebase Authentication · Cloud Firestore

## Puesta en marcha

1. Crea tu proyecto de Firebase siguiendo la guía de configuración (correo y contraseña activados, Firestore en modo producción).
2. Instala dependencias y configura las claves:
   ```bash
   npm install
   cp .env.example .env   # en Windows: copy .env.example .env
   ```
   Pega en `.env` los valores de *Configuración del proyecto → Tus apps*.
3. Sube las reglas de seguridad y los índices:
   ```bash
   npx firebase login
   npx firebase use --add      # elige tu proyecto, alias "default"
   npm run reglas:subir
   ```
4. Arranca la app y registra el hotel:
   ```bash
   npm run dev
   ```
   En la pantalla de ingreso usa **"Registrar mi hotel"**. Quedas como administrador y puedes crear habitaciones en **Configuración** y empleados en **Usuarios**.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Compila para producción en `dist/` |
| `npm test` | Pruebas de fechas y disponibilidad |
| `npm run test:reglas` | Pruebas de reglas de seguridad y flujos contra el emulador de Firestore (requiere Java 11+) |
| `npm run reglas:subir` | Sube `firestore.rules` y `firestore.indexes.json` a tu proyecto |

## Cómo están organizados los datos

```
usuarios/{uid}                 perfil: nombre, rol, hotelId, activo
hoteles/{hotelId}              nombre, NIT, RNT, plan
hoteles/{hotelId}/habitaciones
hoteles/{hotelId}/reservas
hoteles/{hotelId}/ocupacion    una noche ocupada por habitación (evita sobreventas)
hoteles/{hotelId}/clientes     id = número de documento (sin duplicados)
hoteles/{hotelId}/ingresos, egresos, pagos_empleados, comprobantes, auditoria, …
```

- **Roles:** `admin`, `recepcionista`, `servicio`, `contador`, `vigilante`. Los permisos se aplican en `firestore.rules`, no solo en la pantalla.
- **Disponibilidad:** una reserva bloquea cada noche en `ocupacion/{habitación}_{fecha}` dentro de una transacción. Dos recepcionistas no pueden vender la misma noche.
- **Finanzas:** los movimientos no se borran. Las ediciones quedan en `auditoria` y los comprobantes solo se anulan.
