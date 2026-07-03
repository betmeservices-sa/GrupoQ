// Resolución del tenant ACTIVO.
// Cliente: se lee de localStorage (lo fija el login). Servidor/SSR: cae al
// tenant por defecto (la UI real se pinta en el cliente, ya con el correcto).
//
// El login guarda el tenant y RECARGA la página, así todos los módulos que leen
// el seed/marca al evaluarse (p. ej. lib/data/seed) lo hacen con el tenant ya
// fijado. Cambiar de tenant siempre implica una recarga (login/logout).

import { DEFAULT_TENANT, TENANTS, isTenantId } from "./index";
import type { TenantConfig, TenantId } from "./types";

export const TENANT_STORAGE_KEY = "ccg.tenant";

export function activeTenantId(): TenantId {
  if (typeof window !== "undefined") {
    const v = window.localStorage.getItem(TENANT_STORAGE_KEY);
    if (isTenantId(v)) return v;
  }
  return DEFAULT_TENANT;
}

export function activeTenant(): TenantConfig {
  return TENANTS[activeTenantId()];
}

// Fija el tenant activo (lo llama el login antes de recargar).
export function setActiveTenant(id: TenantId): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TENANT_STORAGE_KEY, id);
  }
}

export function clearActiveTenant(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TENANT_STORAGE_KEY);
  }
}
