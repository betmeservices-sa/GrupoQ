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

export function useAuth() {
  // null = todavía verificando. El SERVIDOR decide si hay sesión, no localStorage:
  // un estado viejo del navegador (sin cookie válida) ya no muestra un dashboard
  // roto que dispara 401 en cada request.
  const [sesion, setSesion] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/auth/me")
      .then((r) => {
        if (cancelado) return;
        if (r.ok) {
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

  async function login(usuario: string, password: string): Promise<boolean> {
    let tenant: string | undefined;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { ok?: boolean; tenant?: string };
      if (!data.ok || !data.tenant) return false;
      tenant = data.tenant;
    } catch {
      return false;
    }

    if (!isTenantId(tenant)) return false;

    window.localStorage.setItem(SESION_KEY, usuario.trim().toLowerCase());
    // El demo abre como Gerente de Marketing (acceso total).
    window.localStorage.setItem(ROL_KEY, "gerente_marketing");
    setActiveTenant(tenant);
    // Recarga para que el tenant activo aplique en toda la app.
    window.location.assign("/");
    return true;
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
