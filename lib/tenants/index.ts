// Registro central de tenants + credenciales demo.
// Sumar un cliente = agregar su TenantConfig aquí y una credencial en DEMO_LOGINS.

import type { TenantConfig, TenantId } from "./types";
import { hospitalTenant } from "./hospital";
import { grupoqTenant } from "./grupoq";

export type { TenantConfig, TenantId } from "./types";

export const TENANTS: Record<TenantId, TenantConfig> = {
  hospital: hospitalTenant,
  grupoq: grupoqTenant,
};

// Tenant por defecto (SSR / antes de login). No es visible: la UI se pinta tras
// login, ya con el tenant correcto leído de localStorage.
export const DEFAULT_TENANT: TenantId = "grupoq";

export function isTenantId(v: string | null | undefined): v is TenantId {
  return v === "hospital" || v === "grupoq";
}

export function getTenant(id: TenantId): TenantConfig {
  return TENANTS[id];
}

// --- Login demo (sin backend): cada credencial mapea a un tenant ---
export interface DemoLogin {
  email: string;
  password: string;
  tenant: TenantId;
}

export const DEMO_LOGINS: DemoLogin[] = [
  { email: "hospital@demo.com", password: "demo1234", tenant: "hospital" },
  { email: "grupoq@demo.com", password: "demo1234", tenant: "grupoq" },
];

// Devuelve el tenant si el correo + contraseña son válidos; null si no.
export function resolveTenantByLogin(email: string, password: string): TenantId | null {
  const e = email.trim().toLowerCase();
  const match = DEMO_LOGINS.find((l) => l.email === e && l.password === password);
  return match ? match.tenant : null;
}

// --- Ruteo de WhatsApp real (seam) ---
// El webhook de Meta trae value.metadata.phone_number_id; con eso se sabe qué
// número (y por tanto qué tenant) recibió el mensaje. En modo demo no hay
// phone_number_id configurado; se cae al tenant por defecto.
export function resolveTenantByPhoneNumberId(phoneNumberId: string | undefined): TenantId {
  if (phoneNumberId) {
    for (const id of Object.keys(TENANTS) as TenantId[]) {
      if (TENANTS[id].whatsapp?.phoneNumberId === phoneNumberId) return id;
    }
  }
  return DEFAULT_TENANT;
}
