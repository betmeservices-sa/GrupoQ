// Persistencia de las conexiones OAuth de Meta (página de FB + IG + tokens)
// por tenant. Mismo patrón que wa-store: Supabase si hay credenciales, y un
// store en memoria como fallback (suficiente para dev local; en Vercel cada
// función serverless tiene memoria propia, ahí Supabase es obligatorio).
//
// Tabla: meta_connections (ver supabase/meta-connections.sql).

import { getSupabase } from "./supabase";

export interface MetaConnection {
  tenant: string;
  pageId: string;
  pageName: string;
  pageToken: string;
  igId: string | null;
  userToken: string | null;
}

// Anclado en globalThis: en dev, cada ruta compila su propia instancia del
// módulo y un Map a nivel de módulo NO se comparte entre el callback y la ruta
// de stats (además el HMR lo borraría). En Vercel esto no aplica: ahí persiste
// Supabase.
const g = globalThis as unknown as { __metaConexiones?: Map<string, MetaConnection[]> };
const memoria: Map<string, MetaConnection[]> = (g.__metaConexiones ??= new Map());

// Guarda (upsert) las conexiones de un tenant. No lanza: si Supabase falla,
// queda al menos en memoria y el flujo OAuth no se cae.
export async function guardarConexiones(
  tenant: string,
  conexiones: MetaConnection[],
): Promise<"db" | "memoria"> {
  const previas = memoria.get(tenant) ?? [];
  const merged = [
    ...previas.filter((p) => !conexiones.some((c) => c.pageId === p.pageId)),
    ...conexiones,
  ];
  memoria.set(tenant, merged);

  const sb = getSupabase();
  if (!sb) return "memoria";
  const { error } = await sb.from("meta_connections").upsert(
    conexiones.map((c) => ({
      tenant: c.tenant,
      page_id: c.pageId,
      page_name: c.pageName,
      page_token: c.pageToken,
      ig_id: c.igId,
      user_token: c.userToken,
      connected_at: new Date().toISOString(),
    })),
    { onConflict: "tenant,page_id" },
  );
  if (error) {
    console.error("[meta-store] upsert falló:", error.message);
    return "memoria";
  }
  return "db";
}

export async function conexionesDe(tenant: string): Promise<MetaConnection[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("meta_connections")
      .select("tenant,page_id,page_name,page_token,ig_id,user_token")
      .eq("tenant", tenant);
    if (!error && data && data.length) {
      return data.map((r) => ({
        tenant: r.tenant,
        pageId: r.page_id,
        pageName: r.page_name ?? "",
        pageToken: r.page_token,
        igId: r.ig_id,
        userToken: r.user_token,
      }));
    }
  }
  return memoria.get(tenant) ?? [];
}
