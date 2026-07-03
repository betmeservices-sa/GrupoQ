// Enrutamiento del número de WhatsApp en vivo a un cliente (tenant).
// Hoy hay UN solo número: un switch global decide a qué cliente entran sus
// mensajes. Se etiquetan con ese tenant, cada dashboard muestra lo suyo y la IA
// responde con el guion de ese cliente. Respaldado en Supabase para que el
// webhook (server-side, always-on) lo lea. Si no hay Supabase, cae a memoria.
//
// Cuando haya un segundo número, esto se reemplaza por enrutar según el
// phone_number_id del webhook (resolveTenantByPhoneNumberId).
import { getSupabase } from "./supabase";
import { isTenantId } from "./tenants";
import type { TenantId } from "./tenants/types";

// El número arranca sirviendo al hospital (el cliente que se está mostrando).
const DEFAULT_WA_TENANT: TenantId = "hospital";
let mem: TenantId = DEFAULT_WA_TENANT;

export async function getWaTenant(): Promise<TenantId> {
  const sb = getSupabase();
  if (!sb) return mem;
  const { data, error } = await sb
    .from("wa_routing")
    .select("tenant")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("wa_routing select:", error.message);
    return DEFAULT_WA_TENANT;
  }
  const t = data?.tenant as string | undefined;
  return t && isTenantId(t) ? t : DEFAULT_WA_TENANT;
}

export async function setWaTenant(tenant: TenantId): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    mem = tenant;
    return;
  }
  const { error } = await sb
    .from("wa_routing")
    .upsert({ id: 1, tenant, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("wa_routing upsert:", error.message);
}
