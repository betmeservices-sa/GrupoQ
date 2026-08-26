// Persistencia de las conexiones OAuth de Meta (página de FB + IG + tokens)
// por tenant. Mismo patrón que wa-store: Supabase si hay credenciales, y un
// store en memoria como fallback (suficiente para dev local; en Vercel cada
// función serverless tiene memoria propia, ahí Supabase es obligatorio).
//
// Tabla: meta_connections (ver supabase/meta-connections.sql y la migración
// 20260826230000_meta_ig_login.sql para las columnas de Instagram directo).

import { getSupabase, todosLosClientes } from "./supabase";

export interface MetaConnection {
  tenant: string;
  pageId: string;
  pageName: string;
  pageToken: string;
  igId: string | null;
  userToken: string | null;
  /**
   * Instagram directo (API con inicio de sesión de Instagram).
   *
   * Token propio de la cuenta de IG, aparte del de la página. Existe porque
   * sin App Review los DMs de Instagram de gente sin rol en la app no llegan
   * por el camino de Facebook, y por este sí. Vence a los 60 días y se
   * refresca solo (ver lib/meta-ig-login.ts).
   */
  igToken?: string | null;
  igTokenVence?: string | null;
  igUsername?: string | null;
}

// Anclado en globalThis: en dev, cada ruta compila su propia instancia del
// módulo y un Map a nivel de módulo NO se comparte entre el callback y la ruta
// de stats (además el HMR lo borraría). En Vercel esto no aplica: ahí persiste
// Supabase.
const g = globalThis as unknown as { __metaConexiones?: Map<string, MetaConnection[]> };
const memoria: Map<string, MetaConnection[]> = (g.__metaConexiones ??= new Map());

// ¿La base ya tiene las columnas de Instagram directo?
//
// El deploy sale al aire apenas se hace push y la migración la corre una
// persona cuando puede. En el medio, pedir columnas que no existen haría
// fallar la consulta ENTERA y el panel se quedaría sin conexiones: ni
// Messenger, ni WhatsApp de Meta, nada. Al primer error se apaga y se sigue
// con las columnas de siempre.
const g2 = globalThis as unknown as { __metaColumnasIg?: { hay: boolean } };
const columnasIg = (g2.__metaColumnasIg ??= { hay: true });

const COLUMNAS_BASE = "tenant,page_id,page_name,page_token,ig_id,user_token";
const COLUMNAS_IG = `${COLUMNAS_BASE},ig_token,ig_token_vence,ig_username`;

function columnas(): string {
  return columnasIg.hay ? COLUMNAS_IG : COLUMNAS_BASE;
}

function faltanColumnasIg(mensaje: string | undefined): boolean {
  return Boolean(mensaje && /ig_token|ig_username/.test(mensaje));
}

interface Fila {
  tenant: string;
  page_id: string;
  page_name: string | null;
  page_token: string;
  ig_id: string | null;
  user_token: string | null;
  ig_token?: string | null;
  ig_token_vence?: string | null;
  ig_username?: string | null;
}

function deFila(r: Fila): MetaConnection {
  return {
    tenant: r.tenant,
    pageId: r.page_id,
    pageName: r.page_name ?? "",
    pageToken: r.page_token,
    igId: r.ig_id,
    userToken: r.user_token,
    igToken: r.ig_token ?? null,
    igTokenVence: r.ig_token_vence ?? null,
    igUsername: r.ig_username ?? null,
  };
}

/** Consulta con las columnas de IG y, si la base no las tiene, sin ellas. */
async function leer(
  sb: ReturnType<typeof getSupabase>,
  filtro: (q: ReturnType<NonNullable<ReturnType<typeof getSupabase>>["from"]>, cols: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<Fila[] | null> {
  if (!sb) return null;
  const r1 = await filtro(sb.from("meta_connections"), columnas());
  if (!r1.error) return (r1.data as Fila[]) ?? [];
  if (columnasIg.hay && faltanColumnasIg(r1.error.message)) {
    columnasIg.hay = false;
    console.error("[meta-store] faltan las columnas de Instagram directo. Corré la migración.");
    const r2 = await filtro(sb.from("meta_connections"), columnas());
    if (!r2.error) return (r2.data as Fila[]) ?? [];
    console.error("[meta-store] leer falló:", r2.error.message);
    return null;
  }
  console.error("[meta-store] leer falló:", r1.error.message);
  return null;
}

// Guarda (upsert) las conexiones de un tenant. No lanza: si Supabase falla,
// queda al menos en memoria y el flujo OAuth no se cae.
//
// No toca las columnas de Instagram directo: reconectar Facebook no puede
// borrar un login de Instagram que ya estaba.
export async function guardarConexiones(
  tenant: string,
  conexiones: MetaConnection[],
): Promise<"db" | "memoria"> {
  const previas = memoria.get(tenant) ?? [];
  const merged = [
    ...previas.filter((p) => !conexiones.some((c) => c.pageId === p.pageId)),
    ...conexiones.map((c) => {
      const antes = previas.find((p) => p.pageId === c.pageId);
      return antes?.igToken ? { ...c, igToken: antes.igToken, igTokenVence: antes.igTokenVence, igUsername: antes.igUsername } : c;
    }),
  ];
  memoria.set(tenant, merged);

  const sb = getSupabase(tenant);
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

/**
 * Guarda el login directo de una cuenta de Instagram.
 *
 * Si la cuenta ya está en una conexión del tenant (vinculada a una página),
 * el token va en esa misma fila. Si no, se crea una fila propia con el id de
 * Instagram como page_id y el token de página vacío: es una conexión solo de
 * Instagram.
 */
export async function guardarLoginIg(
  tenant: string,
  datos: { igId: string; igUsername: string | null; igToken: string; igTokenVence: string | null },
): Promise<"db" | "memoria"> {
  const lista = memoria.get(tenant) ?? [];
  const enMemoria = lista.find((c) => c.igId === datos.igId);
  if (enMemoria) {
    Object.assign(enMemoria, { igToken: datos.igToken, igTokenVence: datos.igTokenVence, igUsername: datos.igUsername });
  } else {
    lista.push({
      tenant,
      pageId: datos.igId,
      pageName: datos.igUsername ? `@${datos.igUsername}` : datos.igId,
      pageToken: "",
      userToken: null,
      ...datos,
    });
  }
  memoria.set(tenant, lista);

  const sb = getSupabase(tenant);
  if (!sb) return "memoria";

  const existentes = await leer(sb, (q, cols) => q.select(cols).eq("tenant", tenant).eq("ig_id", datos.igId).limit(1));
  const fila = existentes?.[0];
  const cambios = {
    ig_token: datos.igToken,
    ig_token_vence: datos.igTokenVence,
    ig_username: datos.igUsername,
  };
  const { error } = fila
    ? await sb.from("meta_connections").update(cambios).eq("tenant", tenant).eq("page_id", fila.page_id)
    : await sb.from("meta_connections").upsert(
        {
          tenant,
          page_id: datos.igId,
          page_name: datos.igUsername ? `@${datos.igUsername}` : datos.igId,
          page_token: "",
          ig_id: datos.igId,
          user_token: null,
          connected_at: new Date().toISOString(),
          ...cambios,
        },
        { onConflict: "tenant,page_id" },
      );
  if (error) {
    console.error("[meta-store] guardarLoginIg falló:", error.message);
    return "memoria";
  }
  return "db";
}

/** Actualiza solo el token de Instagram directo (lo usa el refresco). */
export async function actualizarTokenIg(cx: MetaConnection, igToken: string, igTokenVence: string | null): Promise<void> {
  cx.igToken = igToken;
  cx.igTokenVence = igTokenVence;
  const sb = getSupabase(cx.tenant);
  if (!sb) return;
  const { error } = await sb
    .from("meta_connections")
    .update({ ig_token: igToken, ig_token_vence: igTokenVence })
    .eq("tenant", cx.tenant)
    .eq("page_id", cx.pageId);
  if (error) console.error("[meta-store] actualizarTokenIg falló:", error.message);
}

// Resuelve una conexión por el id del ACTIVO (page_id de Facebook o ig_id de
// Instagram). Es el enrutador de los webhooks de Messenger/IG: Meta manda el id
// de la página o de la cuenta de IG y con esto sabemos a qué tenant pertenece
// (igual que WhatsApp enruta por phone_number_id).
export async function conexionPorActivo(id: string): Promise<MetaConnection | null> {
  if (!id) return null;
  // Se busca en todos los esquemas: averiguar de que cliente es la pagina es
  // justamente el motivo de esta consulta, asi que no se puede elegir uno.
  for (const sb of todosLosClientes()) {
    const filas = await leer(sb, (q, cols) => q.select(cols).or(`page_id.eq.${id},ig_id.eq.${id}`).limit(1));
    if (filas && filas.length) return deFila(filas[0]);
  }
  for (const lista of memoria.values()) {
    const hit = lista.find((c) => c.pageId === id || c.igId === id);
    if (hit) return hit;
  }
  return null;
}

// SOLO PARA DEV: siembra una conexión en el store en MEMORIA (sin tocar la
// base) para probar el webhook local sin pasar por el OAuth real.
export function seedConexionMemoria(c: MetaConnection): void {
  const previas = memoria.get(c.tenant) ?? [];
  memoria.set(c.tenant, [...previas.filter((p) => p.pageId !== c.pageId), c]);
}

export async function conexionesDe(tenant: string): Promise<MetaConnection[]> {
  const sb = getSupabase(tenant);
  if (sb) {
    const filas = await leer(sb, (q, cols) => q.select(cols).eq("tenant", tenant));
    if (filas && filas.length) return filas.map(deFila);
  }
  return memoria.get(tenant) ?? [];
}
