// Resolución del tenant en el SERVIDOR (route handlers).
//
// El tenant sale de la cookie de sesión FIRMADA (`lib/session.ts`), no de una
// cookie suelta: antes cualquiera podía escribir `ccg_tenant=hospital` en su
// navegador y leer los datos de otro cliente.
//
// INVARIANTE: estas funciones solo se llaman desde rutas bajo /api que NO están
// en la lista pública del middleware, y el middleware ya verificó la firma y la
// expiración antes de que el handler se ejecute. Por eso acá se puede leer el
// payload sin volver a validar (y así seguir siendo síncrono).
//
// El webhook de Meta NO usa esto: ese enruta por phone_number_id (ver
// resolveTenantByPhoneNumberId) y valida la firma de Meta por su cuenta.

import { DEFAULT_TENANT, isTenantId } from "./index";
import { SESSION_COOKIE } from "../session";
import type { TenantId } from "./types";

export function tenantFromCookieHeader(cookieHeader: string | null): TenantId {
  if (cookieHeader) {
    const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    if (m) {
      const tenant = m[1].split(".")[0];
      if (isTenantId(tenant)) return tenant;
    }
  }
  return DEFAULT_TENANT;
}

export function tenantFromRequest(req: Request): TenantId {
  return tenantFromCookieHeader(req.headers.get("cookie"));
}
