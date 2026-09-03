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

/** El agente PRINCIPAL del tenant, o null si no tiene voz contratada. */
export function assistantIdDeTenant(tenant: TenantId): string | null {
  return TENANTS[tenant].voz?.assistantId ?? null;
}

/** TODOS los agentes del tenant. Un cliente puede tener mas de uno. */
export function assistantIdsDeTenant(tenant: TenantId): string[] {
  const voz = TENANTS[tenant].voz;
  if (!voz) return [];
  return [voz.assistantId, ...(voz.assistantIdsExtra ?? [])].filter(Boolean);
}

/**
 * Si ese agente es de este cliente. Es la pregunta que hay que hacerse ANTES de
 * dejar marcar o de devolver historial: con varios agentes por cliente, comparar
 * contra uno solo dejaba fuera a los demas, y aceptar lo que venga en el cuerpo
 * abriria la puerta a usar el agente de otro.
 */
export function esDelTenant(assistantId: string | null | undefined, tenant: TenantId): boolean {
  if (!assistantId) return false;
  if (esAgencia(tenant)) return true;
  return assistantIdsDeTenant(tenant).includes(assistantId);
}

/** true si al tenant le corresponde el módulo (agencia o con agente propio). */
export function veModuloVoz(tenant: TenantId): boolean {
  return esAgencia(tenant) || assistantIdsDeTenant(tenant).length > 0;
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
  const mios = assistantIdsDeTenant(tenant);
  if (mios.length === 0) return [];
  return items.filter((x) => x.assistantId != null && mios.includes(x.assistantId));
}
