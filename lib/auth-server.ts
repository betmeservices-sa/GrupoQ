// Validación de credenciales. SOLO servidor (lo importa /api/auth/login).
//
// El repo es público, así que las contraseñas que viven en lib/tenants
// (DEMO_LOGINS) son visibles para cualquiera en GitHub. Como los dashboards
// muestran datos de clientes reales, eso no puede ser la única puerta.
//
// Si existe la variable LOGIN_PASSWORDS, manda ella y las del código dejan de
// funcionar. Formato: "tenant:clave,tenant:clave"
//   LOGIN_PASSWORDS="hospital:xK9...,grupoq:mP2...,excel:vB7...,miagentia:qL4..."
//
// Si NO existe, se cae a DEMO_LOGINS para no dejar el demo inservible de golpe.
// En producción eso se avisa por consola: hay que configurarla.

import { DEMO_LOGINS, isTenantId } from "./tenants";
import type { TenantId } from "./tenants/types";

let avisado = false;

function desdeEnv(): Map<string, TenantId> | null {
  const raw = process.env.LOGIN_PASSWORDS;
  if (!raw) return null;
  const mapa = new Map<string, TenantId>();
  for (const par of raw.split(",")) {
    const i = par.indexOf(":");
    if (i <= 0) continue;
    const tenant = par.slice(0, i).trim();
    const clave = par.slice(i + 1).trim();
    if (isTenantId(tenant) && clave) mapa.set(clave, tenant);
  }
  return mapa.size > 0 ? mapa : null;
}

// Comparación en tiempo constante para no filtrar la clave carácter a carácter.
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export function validarCredenciales(usuario: string, password: string): TenantId | null {
  const u = usuario.trim().toLowerCase();
  if (!u || !password) return null;

  const env = desdeEnv();
  if (env) {
    for (const [clave, tenant] of env) {
      if (iguales(password, clave)) return tenant;
    }
    return null;
  }

  if (!avisado && process.env.NODE_ENV === "production") {
    avisado = true;
    console.error(
      "[auth] LOGIN_PASSWORDS no está configurada: se están usando las contraseñas del repo, que es público.",
    );
  }

  const match = DEMO_LOGINS.find(
    (l) => l.usuario.toLowerCase() === u && iguales(password, l.password),
  );
  return match ? match.tenant : null;
}
