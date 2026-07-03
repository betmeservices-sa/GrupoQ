"use client";

import { useEffect, useState } from "react";
import { resolveTenantByLogin } from "./tenants";
import { setActiveTenant, clearActiveTenant } from "./tenants/active";

// Login DEMO (sin backend): las credenciales viven en lib/tenants (DEMO_LOGINS)
// y cada una mapea a un cliente/tenant. La sesión se guarda en localStorage.
//
// Al entrar, se fija el tenant y se RECARGA la página: así todos los módulos que
// leen el seed/marca al evaluarse lo hacen ya con el tenant correcto.

const SESION_KEY = "ccg.sesion";
const ROL_KEY = "ccg.rol";

export function useAuth() {
  // null = todavía no se leyó localStorage (evita parpadeo e hidratación).
  const [sesion, setSesion] = useState<boolean | null>(null);

  useEffect(() => {
    setSesion(Boolean(window.localStorage.getItem(SESION_KEY)));
  }, []);

  function login(email: string, password: string): boolean {
    const tenant = resolveTenantByLogin(email, password);
    if (!tenant) return false;
    window.localStorage.setItem(SESION_KEY, email.trim().toLowerCase());
    // El demo abre con acceso total (perfil Dirección).
    window.localStorage.setItem(ROL_KEY, "admin");
    setActiveTenant(tenant);
    // Cookie para que el servidor (p. ej. plantillas de WhatsApp) sepa el tenant.
    document.cookie = `ccg_tenant=${tenant};path=/;max-age=31536000;samesite=lax`;
    // Recarga para que el tenant activo aplique en toda la app.
    window.location.assign("/");
    return true;
  }

  function logout() {
    window.localStorage.removeItem(SESION_KEY);
    window.localStorage.removeItem(ROL_KEY);
    clearActiveTenant();
    document.cookie = "ccg_tenant=;path=/;max-age=0";
    window.location.assign("/");
  }

  return { sesion, login, logout };
}
