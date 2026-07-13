// Registro central de tenants + credenciales demo.
// Sumar un cliente = agregar su TenantConfig aquí y una credencial en DEMO_LOGINS.

import type { TenantConfig, TenantId } from "./types";
import { hospitalTenant } from "./hospital";
import { grupoqTenant } from "./grupoq";
import { excelTenant } from "./excel";
import { miagentiaTenant } from "./miagentia";

export type { TenantConfig, TenantId } from "./types";

export const TENANTS: Record<TenantId, TenantConfig> = {
  hospital: hospitalTenant,
  grupoq: grupoqTenant,
  excel: excelTenant,
  miagentia: miagentiaTenant,
};

// Tenant por defecto (SSR / antes de login). No es visible: la UI se pinta tras
// login, ya con el tenant correcto leído de localStorage.
export const DEFAULT_TENANT: TenantId = "grupoq";

export function isTenantId(v: string | null | undefined): v is TenantId {
  return v === "hospital" || v === "grupoq" || v === "excel" || v === "miagentia";
}

export function getTenant(id: TenantId): TenantConfig {
  return TENANTS[id];
}

// --- Login demo (sin backend): cada credencial mapea a un tenant ---
// `usuario` puede ser un nombre de usuario o un correo (se compara en minúsculas).
export interface DemoLogin {
  usuario: string;
  password: string;
  tenant: TenantId;
}

// ESTRUCTURA: un solo usuario ("demoagentia") y la CONTRASEÑA decide a qué
// dashboard entra. Para sumar un dashboard futuro: crea su TenantConfig y agrega
// aquí una línea con la misma cuenta y una contraseña nueva:
//   { usuario: "demoagentia", password: "demoX", tenant: "nuevoTenant" }
export const DEMO_LOGINS: DemoLogin[] = [
  { usuario: "demoagentia", password: "demoh", tenant: "hospital" },
  { usuario: "demoagentia", password: "demoi", tenant: "grupoq" },
  { usuario: "demoagentia", password: "demoj", tenant: "excel" },
  { usuario: "demoagentia", password: "demok", tenant: "miagentia" },

  // Aliases previos (siguen funcionando).
  { usuario: "hospital@demo.com", password: "demo1234", tenant: "hospital" },
  { usuario: "grupoq@demo.com", password: "demo1234", tenant: "grupoq" },
  { usuario: "excel@demo.com", password: "demo1234", tenant: "excel" },
  { usuario: "miagentia@demo.com", password: "demo1234", tenant: "miagentia" },
];

// Devuelve el tenant si el usuario + contraseña son válidos; null si no. El
// usuario no distingue mayúsculas; la contraseña sí.
export function resolveTenantByLogin(usuario: string, password: string): TenantId | null {
  const u = usuario.trim().toLowerCase();
  const match = DEMO_LOGINS.find((l) => l.usuario.toLowerCase() === u && l.password === password);
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
