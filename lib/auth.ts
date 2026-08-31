"use client";

import { useEffect, useState } from "react";
import { setActiveTenant, clearActiveTenant } from "./tenants/active";
import { isTenantId } from "./tenants";

// Login REAL: la contraseña se valida en el SERVIDOR (`/api/auth/login`), que
// devuelve una cookie de sesión HttpOnly firmada. El navegador ya no decide si
// está autenticado, solo guarda estado de UI (tenant activo, rol) para pintar.
//
// Antes esto validaba en el cliente y guardaba un flag en localStorage: se podía
// entrar escribiendo una variable en la consola, y las rutas de API servían
// datos reales a cualquiera de internet.

const SESION_KEY = "ccg.sesion";
const ROL_KEY = "ccg.rol";

// Resultado del intento de login. "necesita2fa" = la contraseña es correcta pero
// falta (o falló) el código del segundo factor; la UI muestra el paso del código.
// Si trae `enrolar`, es la PRIMERA vez del usuario: la UI muestra el QR para que
// configure su app de autenticación antes de ingresar el código.
export interface Enrolamiento2FA {
  qr: string; // data URL de la imagen del QR
  secret: string; // clave Base32, por si no puede escanear
}
export type LoginResult =
  | { tipo: "ok" }
  | { tipo: "necesita2fa"; enrolar?: Enrolamiento2FA; codigoInvalido?: boolean }
  | { tipo: "error" };

export function useAuth() {
  // null = todavía verificando. El SERVIDOR decide si hay sesión, no localStorage:
  // un estado viejo del navegador (sin cookie válida) ya no muestra un dashboard
  // roto que dispara 401 en cada request.
  const [sesion, setSesion] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelado = false;
    // /sesion y no /me: ademas de "hay sesion", dice DE QUE cliente es. El
    // navegador guarda el cliente activo en localStorage y solo lo escribia la
    // pantalla de login; entrar por otra puerta (entrar-como en local) dejaba
    // la sesion de un cliente con la pintura de otro: el panel salia azul de
    // Grupo Q con los datos de Yali, y sin los modulos que dependen del tenant.
    // Ahora manda la sesion: si el navegador tiene otro cliente guardado, se
    // corrige y se recarga una vez (los modulos leen el tenant al evaluarse).
    fetch("/api/auth/sesion")
      .then(async (r) => {
        if (cancelado) return;
        if (r.ok) {
          const d = (await r.json().catch(() => ({}))) as { tenant?: string };
          if (d.tenant && isTenantId(d.tenant) && d.tenant !== window.localStorage.getItem("ccg.tenant")) {
            setActiveTenant(d.tenant);
            window.location.reload();
            return;
          }
          setSesion(true);
        } else {
          // Sesión del servidor inválida o expirada: limpiar el estado stale del
          // cliente y mandar al login.
          window.localStorage.removeItem(SESION_KEY);
          setSesion(false);
        }
      })
      .catch(() => {
        if (!cancelado) setSesion(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // token: código del segundo factor (2FA). Se manda solo cuando el servidor ya
  // pidió el código; en el primer intento va vacío.
  async function login(
    usuario: string,
    password: string,
    token?: string,
  ): Promise<LoginResult> {
    let tenant: string | undefined;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password, token }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        tenant?: string;
        need2fa?: boolean;
        error?: string;
        enrolar?: { qr: string; secret: string };
      };
      // Contraseña correcta pero falta el segundo factor (o falló el código).
      if (data.need2fa) {
        return {
          tipo: "necesita2fa",
          enrolar: data.enrolar,
          codigoInvalido: Boolean(data.error),
        };
      }
      if (!res.ok || !data.ok || !data.tenant) return { tipo: "error" };
      tenant = data.tenant;
    } catch {
      return { tipo: "error" };
    }

    if (!isTenantId(tenant)) return { tipo: "error" };

    window.localStorage.setItem(SESION_KEY, usuario.trim().toLowerCase());
    // El demo abre como Gerente de Marketing (acceso total).
    window.localStorage.setItem(ROL_KEY, "gerente_marketing");
    setActiveTenant(tenant);
    // Recarga para que el tenant activo aplique en toda la app.
    window.location.assign("/");
    return { tipo: "ok" };
  }

  async function logout() {
    window.localStorage.removeItem(SESION_KEY);
    window.localStorage.removeItem(ROL_KEY);
    clearActiveTenant();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Aunque falle el borrado en el servidor, limpiamos el cliente y salimos.
    }
    window.location.assign("/");
  }

  return { sesion, login, logout };
}
