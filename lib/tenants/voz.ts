// Quién ve el módulo de voz y, sobre todo, QUÉ ve.
//
// La cuenta de voz es una sola y tiene agentes de varios clientes adentro. Por
// eso el módulo estuvo restringido: sin frontera, un cliente veía el historial
// de otro. La frontera es el assistantId declarado en cada TenantConfig, y se
// aplica EN EL SERVIDOR (los route handlers), no en la pantalla: manipular el
// cliente no alcanza para ver llamadas ajenas.
//
// La agencia (miagentia) es la excepción: es la dueña de la cuenta y ve todo.

import { TENANTS } from "./index";
import type { TenantId } from "./types";

export const TENANT_AGENCIA: TenantId = "miagentia";

export function esAgencia(tenant: TenantId): boolean {
  return tenant === TENANT_AGENCIA;
}

/** El agente del tenant, o null si es la agencia o si no tiene voz contratada. */
export function assistantIdDeTenant(tenant: TenantId): string | null {
  return TENANTS[tenant].voz?.assistantId ?? null;
}

/** true si al tenant le corresponde el módulo (agencia o con agente propio). */
export function veModuloVoz(tenant: TenantId): boolean {
  return esAgencia(tenant) || assistantIdDeTenant(tenant) !== null;
}

/**
 * Deja solo lo que le pertenece al tenant. La agencia recibe la lista intacta;
 * un tenant sin agente recibe vacío (no "todo", que es el fallo peligroso).
 */
export function soloDelTenant<T extends { assistantId?: string | null }>(
  items: T[],
  tenant: TenantId,
): T[] {
  if (esAgencia(tenant)) return items;
  const mio = assistantIdDeTenant(tenant);
  if (!mio) return [];
  return items.filter((x) => x.assistantId === mio);
}
