// Resolución del tenant en el SERVIDOR (route handlers).
// El login fija una cookie `ccg_tenant`; las rutas de la plataforma que dispara
// el usuario logueado (p. ej. plantillas) leen esa cookie para saber a qué
// cliente pertenece la acción. El webhook de Meta NO usa esto: ese enruta por
// phone_number_id (ver resolveTenantByPhoneNumberId).

import { DEFAULT_TENANT, isTenantId } from "./index";
import type { TenantId } from "./types";

export const TENANT_COOKIE = "ccg_tenant";

export function tenantFromCookieHeader(cookieHeader: string | null): TenantId {
  if (cookieHeader) {
    const m = cookieHeader.match(/(?:^|;\s*)ccg_tenant=([^;]+)/);
    if (m && isTenantId(m[1])) return m[1];
  }
  return DEFAULT_TENANT;
}

export function tenantFromRequest(req: Request): TenantId {
  return tenantFromCookieHeader(req.headers.get("cookie"));
}
