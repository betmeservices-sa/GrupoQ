// Estado del Modo IA, respaldado en Supabase para que el webhook (always-on,
// server-side) lo lea. Si no hay Supabase, cae a memoria (solo sirve en local).
import { getSupabase } from "./supabase";

let memEnabled = false;
const memOverride = new Map<string, boolean>(); // true=ON, false=OFF; ausente=seguir global

// Interruptor global on/off (default para chats sin override explicito).
export async function getAiEnabled(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return memEnabled;
  const { data, error } = await sb.from("ai_config").select("enabled").eq("id", 1).maybeSingle();
  if (error) {
    console.error("ai_config select:", error.message);
    return false;
  }
  return Boolean(data?.enabled);
}

export async function setAiEnabled(enabled: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    memEnabled = enabled;
    return;
  }
  const { error } = await sb
    .from("ai_config")
    .upsert({ id: 1, enabled, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("ai_config upsert:", error.message);
}

// Override por conversacion: true = IA forzada ON, false = OFF, null = seguir el global.
export async function getChatOverride(from: string): Promise<boolean | null> {
  const sb = getSupabase();
  if (!sb) return memOverride.has(from) ? (memOverride.get(from) as boolean) : null;
  const { data, error } = await sb
    .from("ai_paused")
    .select("activa")
    .eq("wa_from", from)
    .maybeSingle();
  if (error) {
    console.error("ai_paused select:", error.message);
    return null;
  }
  if (!data) return null;
  return Boolean((data as { activa?: boolean }).activa);
}

export async function setChatOverride(from: string, activa: boolean): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    memOverride.set(from, activa);
    return;
  }
  const { error } = await sb
    .from("ai_paused")
    .upsert({ wa_from: from, activa }, { onConflict: "wa_from" });
  if (error) console.error("ai_paused upsert:", error.message);
}

// La IA esta activa para este chat? Usa el override si existe; si no, el global.
export async function getChatAiActiva(from: string): Promise<boolean> {
  const ov = await getChatOverride(from);
  return ov !== null ? ov : getAiEnabled();
}
