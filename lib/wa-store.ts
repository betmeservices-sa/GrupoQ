// Persistencia de mensajes de WhatsApp (recibidos y enviados).
// Si hay Supabase configurado, guarda/lee de la tabla `wa_messages` (persiste,
// sobrevive reinicios, sirve desplegado). Si no, cae a un store EN MEMORIA.
//
// Cada mensaje lleva un `tenant` (hospital | grupoq): como hay UN solo número en
// vivo, un switch global decide a qué cliente entran los mensajes. Así cada
// dashboard filtra y muestra solo lo suyo, y la IA usa el guion de ese cliente.
import { getSupabase } from "./supabase";
import { borrarConsumo } from "./tokens-store";

export type Direccion = "in" | "out"; // in = del cliente, out = de la empresa

export interface WaMedia {
  id: string; // media_id de Meta (para descargar el archivo por el proxy)
  tipo: string; // image | document | audio | sticker | video
  mime?: string;
  filename?: string;
}

export interface WaInbound {
  seq: number; // cursor monotónico (id de la fila, o contador en memoria)
  waId: string; // id del mensaje en WhatsApp (dedup)
  from: string; // número del cliente (clave de la conversación)
  nombre?: string;
  texto: string;
  ts: string; // ISO 8601
  direccion: Direccion;
  tenant?: string; // cliente al que entró el número en vivo (hospital | grupoq)
  media?: WaMedia;
}

// Fallback en memoria.
const mem: WaInbound[] = [];
let memSeq = 0;
const MAX = 500;

async function guardar(m: Omit<WaInbound, "seq">): Promise<void> {
  const sb = getSupabase(m.tenant);
  if (sb) {
    const { error } = await sb.from("wa_messages").upsert(
      {
        wa_id: m.waId,
        wa_from: m.from,
        nombre: m.nombre ?? null,
        texto: m.texto,
        ts: m.ts,
        direccion: m.direccion,
        tenant: m.tenant ?? "hospital",
        media_id: m.media?.id ?? null,
        media_tipo: m.media?.tipo ?? null,
        media_mime: m.media?.mime ?? null,
        media_filename: m.media?.filename ?? null,
      },
      { onConflict: "wa_id", ignoreDuplicates: true },
    );
    if (error) console.error("Supabase insert WA:", error.message);
    return;
  }
  if (mem.some((x) => x.waId === m.waId)) return; // dedup
  mem.push({ ...m, seq: ++memSeq });
  if (mem.length > MAX) mem.splice(0, mem.length - MAX);
}

// Mensaje recibido del cliente.
export async function addInbound(
  m: Omit<WaInbound, "seq" | "direccion">,
): Promise<void> {
  return guardar({ ...m, direccion: "in" });
}

// Mensaje que la empresa envió al cliente (para que persista la conversación).
export async function addOutbound(m: {
  waId: string;
  to: string; // número del cliente (clave de la conversación)
  texto: string;
  ts: string;
  tenant?: string;
}): Promise<void> {
  return guardar({
    waId: m.waId,
    from: m.to,
    texto: m.texto,
    ts: m.ts,
    direccion: "out",
    tenant: m.tenant,
  });
}

const COLUMNAS_WA =
  "id, wa_id, wa_from, nombre, texto, ts, direccion, tenant, media_id, media_tipo, media_mime, media_filename";

function deFila(r: Record<string, unknown>): WaInbound {
  return {
    seq: Number(r.id),
    waId: r.wa_id as string,
    from: r.wa_from as string,
    nombre: (r.nombre as string | null) ?? undefined,
    texto: r.texto as string,
    ts: r.ts as string,
    direccion: ((r.direccion as string | null) ?? "in") as Direccion,
    tenant: (r.tenant as string | null) ?? undefined,
    media: r.media_id
      ? {
          id: r.media_id as string,
          tipo: (r.media_tipo as string | null) ?? "document",
          mime: (r.media_mime as string | null) ?? undefined,
          filename: (r.media_filename as string | null) ?? undefined,
        }
      : undefined,
  };
}

export interface Resumen {
  /** El último mensaje de cada conversación. */
  ultimos: WaInbound[];
  /** Hasta dónde llegó la base; el sondeo arranca de acá. */
  cursor: number;
  /** La vista de la base no existe todavía: quien llama tiene que caer al camino viejo. */
  sinVista?: boolean;
}

/**
 * El último mensaje de cada conversación, para armar la lista de una.
 *
 * Es una fila por conversación en vez de todos los mensajes: con seis meses
 * importados, 1,720 filas en vez de 16,131. La lista aparece al instante y los
 * mensajes de cada hilo se traen recién cuando alguien lo abre.
 *
 * Si la vista todavía no está en la base (la migración la corre una persona,
 * el deploy sale solo), se avisa con `sinVista` en vez de devolver una lista
 * vacía: vacía se leería como "no hay conversaciones", que es mentira.
 */
export async function ultimoPorConversacion(tenant?: string): Promise<Resumen> {
  const sb = getSupabase(tenant);
  if (!sb) {
    // En memoria: la última fila por número.
    const porFrom = new Map<string, WaInbound>();
    for (const m of mem) if (!tenant || m.tenant === tenant) porFrom.set(m.from, m);
    return { ultimos: [...porFrom.values()], cursor: memSeq };
  }
  let q = sb.from("wa_ultimo_por_conversacion").select(COLUMNAS_WA);
  if (tenant) q = q.eq("tenant", tenant);
  // El tope de PostgREST es 1000 por pedido: con más conversaciones que eso
  // hay que pedir en tandas.
  const ultimos: WaInbound[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await q.order("id", { ascending: false }).range(desde, desde + 999);
    if (error) {
      console.error("Supabase resumen WA:", error.message);
      return { ultimos: [], cursor: 0, sinVista: true };
    }
    const filas = (data ?? []) as unknown as Record<string, unknown>[];
    ultimos.push(...filas.map(deFila));
    if (filas.length < 1000) break;
  }
  const cursor = ultimos.reduce((max, m) => Math.max(max, m.seq), 0);
  return { ultimos, cursor };
}

/**
 * Los mensajes de UNA conversación anteriores a una fecha, del más nuevo al
 * más viejo. Es lo que se pide al abrir un hilo (sin `antes`) y al subir
 * (con la fecha del más viejo que ya se tiene).
 */
export async function mensajesAnteriores(
  from: string,
  antes: string | null,
  limite: number,
  tenant?: string,
): Promise<{ mensajes: WaInbound[]; hayMas: boolean }> {
  const sb = getSupabase(tenant);
  const tope = Math.min(Math.max(limite, 1), 200);
  if (!sb) {
    const todos = mem
      .filter((m) => m.from === from && (!tenant || m.tenant === tenant) && (!antes || m.ts < antes))
      .sort((a, b) => b.ts.localeCompare(a.ts));
    return { mensajes: todos.slice(0, tope), hayMas: todos.length > tope };
  }
  let q = sb.from("wa_messages").select(COLUMNAS_WA).eq("wa_from", from);
  if (tenant) q = q.eq("tenant", tenant);
  if (antes) q = q.lt("ts", antes);
  // Uno de más, solo para saber si queda algo detrás.
  const { data, error } = await q.order("ts", { ascending: false }).limit(tope + 1);
  if (error) {
    console.error("Supabase hilo WA:", error.message);
    return { mensajes: [], hayMas: false };
  }
  const filas = (data ?? []) as unknown as Record<string, unknown>[];
  return { mensajes: filas.slice(0, tope).map(deFila), hayMas: filas.length > tope };
}

// Devuelve los mensajes con cursor (seq/id) mayor al del cliente. Si se pasa
// `tenant`, solo los de ese cliente (así cada dashboard ve lo suyo).
/**
 * Los mensajes con id mayor a `after`.
 *
 * `limite` existe porque esto hace dos trabajos distintos con la misma
 * consulta: el sondeo de cada cuatro segundos, que trae dos o tres mensajes, y
 * la carga inicial del historial, que con seis meses importados son dieciseis
 * mil. Con paginas de cien, esa carga tardaba mas de diez minutos en aparecer
 * completa, y volvia a empezar en cada recarga.
 *
 * Mil es el techo de PostgREST; pedir mas no trae mas.
 */
export async function getSince(
  after: number,
  tenant?: string,
  limite = 100,
): Promise<WaInbound[]> {
  const sb = getSupabase(tenant);
  if (sb) {
    let q = sb
      .from("wa_messages")
      .select(
        "id, wa_id, wa_from, nombre, texto, ts, direccion, tenant, media_id, media_tipo, media_mime, media_filename",
      )
      .gt("id", after);
    if (tenant) q = q.eq("tenant", tenant);
    const { data, error } = await q.order("id", { ascending: true }).limit(Math.min(limite, 1000));
    if (error) {
      console.error("Supabase select WA:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      seq: Number(r.id),
      waId: r.wa_id as string,
      from: r.wa_from as string,
      nombre: (r.nombre as string | null) ?? undefined,
      texto: r.texto as string,
      ts: r.ts as string,
      direccion: ((r.direccion as string | null) ?? "in") as Direccion,
      tenant: (r.tenant as string | null) ?? undefined,
      media: r.media_id
        ? {
            id: r.media_id as string,
            tipo: (r.media_tipo as string | null) ?? "document",
            mime: (r.media_mime as string | null) ?? undefined,
            filename: (r.media_filename as string | null) ?? undefined,
          }
        : undefined,
    }));
  }
  return mem.filter((m) => m.seq > after && (!tenant || m.tenant === tenant));
}

// Borra el historial de conversaciones (para reiniciar el demo). Si se pasa
// `tenant`, solo el de ese cliente.
//
// Se lleva también el CONSUMO de la IA de ese cliente: es el botón de reiniciar
// el demo, y dejar el panel de costos con cifras de conversaciones que ya no
// están en la bandeja confunde más de lo que informa.
export async function clearHistory(tenant?: string): Promise<void> {
  const sb = getSupabase(tenant);
  if (!sb) {
    for (let i = mem.length - 1; i >= 0; i--) {
      if (!tenant || mem[i].tenant === tenant) mem.splice(i, 1);
    }
    await borrarConsumo(tenant);
    return;
  }
  const base = sb.from("wa_messages").delete();
  const { error } = await (tenant ? base.eq("tenant", tenant) : base.neq("id", 0));
  if (error) console.error("Supabase clear WA:", error.message);

  const sucursales = sb.from("wa_sucursal").delete();
  const { error: errSuc } = await (tenant
    ? sucursales.eq("tenant", tenant)
    : sucursales.neq("wa_from", ""));
  if (errSuc) console.error("Supabase clear wa_sucursal:", errSuc.message);

  await borrarConsumo(tenant);
}

// Borra TODO lo de UN número (mensajes, adjuntos, contacto, metadatos y estado
// de IA). Lo usa "Borrar y bloquear"; el bloqueo real (que no vuelva a escribir)
// lo hace la Block Users API en lib/wa-send.
export async function borrarConversacionCompleta(from: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    for (let i = mem.length - 1; i >= 0; i--) {
      if (mem[i].from === from) mem.splice(i, 1);
    }
    return;
  }
  const tablas = [
    "wa_messages",
    "wa_adjuntos",
    "wa_contacts",
    "wa_conversaciones",
    "ai_paused",
    "wa_sucursal", // la sede que había elegido: si vuelve, se le pregunta de nuevo
    "ai_uso_tokens", // su consumo de IA
  ];
  for (const t of tablas) {
    const { error } = await sb.from(t).delete().eq("wa_from", from);
    if (error) console.error(`Supabase borrar ${t} de ${from}:`, error.message);
  }
}
