import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de Supabase (server-side). Usa la publishable key. Si no hay env de
// Supabase, devuelve null y el resto del código cae al store en memoria.
let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  cached = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return cached;
}
