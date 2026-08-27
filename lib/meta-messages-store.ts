// Persistencia de mensajes de Messenger e Instagram (recibidos y enviados).
// Mismo patrón que wa-store: Supabase si hay credenciales (tabla meta_messages,
// ver supabase/meta-messages.sql) y un store EN MEMORIA como fallback. Si el
// insert/select en Supabase falla (p. ej. la tabla aún no existe), cae a
// memoria para que el flujo no se rompa en dev.
//
// Cada mensaje lleva tenant (lo resuelve el webhook por page_id/ig_id) y un
// `mid` (id del mensaje en Meta) que sirve de dedup: Meta reintenta webhooks y
// el upsert por mid evita duplicados.

import { getSupabase } from "./supabase";

export type MetaCanal = "facebook" | "instagram";
export type MetaDireccion = "in" | "out"; // in = del cliente, out = de la empresa

export interface MetaMensaje {
  seq: number; // cursor monotónico (id de la fila, o contador en memoria)
  mid: string; // id del mensaje en Meta (dedup)
  tenant: string;
  canal: MetaCanal;
  pageId: string; // página de FB dueña de la conversación (IG también envía por ella)
  senderId: string; // PSID (Messenger) o IGSID (Instagram): clave de la conversación
  senderName?: string;
  texto: string;
  ts: string; // ISO 8601
  direction: MetaDireccion;
  /**
   * Enlace a la historia que esta persona contestó, si contestó una.
   *
   * Lo sirve Meta y vence en unas horas: pasado ese rato la miniatura deja de
   * cargar y queda solo el rótulo. Está bien así, una historia se contesta
   * mientras está publicada.
   */
  historiaUrl?: string;
  /**
   * Portada y video de un reel o publicación que metieron en el chat. Los
   * sirve Meta y vencen en unas horas, igual que la historia.
   */
  adjuntoMiniatura?: string;
  adjuntoVideo?: string;
  /** Quién lo mandó: ficha del equipo (s2...), "ia", o nada si no se sabe. */
  staffId?: string;
  /** Para pintar cuando no hay ficha (cuenta de la agencia, app de Facebook). */
  staffNombre?: string;
  /** De qué habla (solo entrantes): day_pass, reserva, precio... */
  tema?: string;
}

// Fallback en memoria, anclado en globalThis: en dev cada ruta compila su
// propia instancia del módulo y un array a nivel de módulo NO se comparte
// entre el webhook y el inbox (además el HMR lo borraría).
const g = globalThis as unknown as {
  __metaMensajes?: { rows: MetaMensaje[]; seq: number };
};
const mem = (g.__metaMensajes ??= { rows: [], seq: 0 });
const MAX = 500;

// Se acuerda de si alguna vez hubo que caer a memoria.
//
// Sin esto el fallback es una trampa: en Vercel cada instancia tiene su propia
// memoria y se recicla sola, asi que el mensaje aparece en la bandeja y al rato
// desaparece, sin un solo error a la vista. Preferible que el panel lo diga.
const estado = ((globalThis as unknown as { __metaEnMemoria?: { si: boolean } })
  .__metaEnMemoria ??= { si: false });

/** ¿Los mensajes de Meta se estan guardando solo en memoria? */
// ¿La base ya tiene la columna `historia_url`?
//
// Existe porque el código y el SQL no llegan juntos: el deploy sale al aire
// apenas se hace push, y la migración la corre una persona cuando puede. En el
// medio, pedir una columna que no existe hacía fallar la consulta ENTERA, y el
// panel se quedaba sin un solo mensaje de Meta. Una función de más no puede
// apagar las que ya andaban.
//
// Empieza asumiendo que sí está. Al primer error se apaga y no se vuelve a
// intentar, así no se paga un viaje perdido por consulta.
const g2 = globalThis as unknown as { __metaHistoriaUrl?: { hay: boolean } };
const columnaHistoria = (g2.__metaHistoriaUrl ??= { hay: true });

/** El error dice que falta esa columna, no otra cosa. */
function faltaLaColumna(mensaje: string | undefined): boolean {
  return Boolean(mensaje && /historia_url|adjunto_miniatura|adjunto_video|staff_id|staff_nombre|tema/.test(mensaje));
}

/** Para las pruebas: volver a asumir que la columna está. */
export function olvidarColumnaHistoria(): void {
  columnaHistoria.hay = true;
}

export function metaEnMemoria(): boolean {
  return estado.si;
}

function guardarEnMemoria(m: Omit<MetaMensaje, "seq">): void {
  if (mem.rows.some((x) => x.mid === m.mid)) return; // dedup
  mem.rows.push({ ...m, seq: ++mem.seq });
  if (mem.rows.length > MAX) mem.rows.splice(0, mem.rows.length - MAX);
}

async function guardar(m: Omit<MetaMensaje, "seq">): Promise<void> {
  const sb = getSupabase(m.tenant);
  if (sb) {
    const base = {
      mid: m.mid,
      tenant: m.tenant,
      canal: m.canal,
      page_id: m.pageId,
      sender_id: m.senderId,
      sender_name: m.senderName ?? null,
      texto: m.texto,
      ts: m.ts,
      direction: m.direction,
    };
    const fila = columnaHistoria.hay
      ? {
          ...base,
          historia_url: m.historiaUrl ?? null,
          adjunto_miniatura: m.adjuntoMiniatura ?? null,
          adjunto_video: m.adjuntoVideo ?? null,
          staff_id: m.staffId ?? null,
          staff_nombre: m.staffNombre ?? null,
          tema: m.tema ?? null,
        }
      : base;

    const { error } = await sb
      .from("meta_messages")
      .upsert(fila, { onConflict: "mid", ignoreDuplicates: true });
    if (!error) return;

    // Falta la columna: se apunta y se guarda igual, sin ella. Perder de qué
    // historia hablaban es molesto; perder el mensaje es inaceptable.
    if (faltaLaColumna(error.message)) {
      columnaHistoria.hay = false;
      console.error("[meta-messages] falta historia_url: se guarda sin ella. Corré la migración.");
      const { error: e2 } = await sb
        .from("meta_messages")
        .upsert(base, { onConflict: "mid", ignoreDuplicates: true });
      if (!e2) return;
    }
    console.error("[meta-messages] insert falló, cae a memoria:", error.message);
  }
  estado.si = true;
  guardarEnMemoria(m);
}

// Mensaje recibido del cliente (webhook).
export async function addMetaInbound(
  m: Omit<MetaMensaje, "seq" | "direction">,
): Promise<void> {
  return guardar({ ...m, direction: "in" });
}

// Mensaje que la empresa envió (para que persista la conversación).
export async function addMetaOutbound(
  m: Omit<MetaMensaje, "seq" | "direction">,
): Promise<void> {
  return guardar({ ...m, direction: "out" });
}

function deFila(r: Record<string, unknown>): MetaMensaje {
  return {
    seq: Number(r.id),
    mid: (r.mid as string | null) ?? `meta-fila-${r.id}`,
    tenant: r.tenant as string,
    canal: (r.canal as MetaCanal) ?? "facebook",
    pageId: r.page_id as string,
    senderId: r.sender_id as string,
    senderName: (r.sender_name as string | null) ?? undefined,
    texto: r.texto as string,
    ts: r.ts as string,
    direction: ((r.direction as string | null) ?? "in") as MetaDireccion,
    historiaUrl: (r.historia_url as string | null) ?? undefined,
    adjuntoMiniatura: (r.adjunto_miniatura as string | null) ?? undefined,
    adjuntoVideo: (r.adjunto_video as string | null) ?? undefined,
    staffId: (r.staff_id as string | null) ?? undefined,
    staffNombre: (r.staff_nombre as string | null) ?? undefined,
    tema: (r.tema as string | null) ?? undefined,
  };
}

/** De estos mids, cuáles ya están guardados. Para saber qué es nuevo de verdad. */
/** Reemplaza la miniatura de un mensaje (el enlace temporal de Meta por el nuestro). */
export async function actualizarAdjuntoMeta(tenant: string, mid: string, adjuntoMiniatura: string): Promise<void> {
  const sb = getSupabase(tenant);
  if (!sb || !columnaHistoria.hay) return;
  const { error } = await sb.from("meta_messages").update({ adjunto_miniatura: adjuntoMiniatura }).eq("mid", mid);
  if (error) console.error("[meta-store] no se pudo actualizar el adjunto:", error.message);
}

export async function midsExistentes(tenant: string, mids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (mids.length === 0) return out;
  const sb = getSupabase(tenant);
  if (!sb) {
    for (const m of mem.rows) if (mids.includes(m.mid)) out.add(m.mid);
    return out;
  }
  for (let i = 0; i < mids.length; i += 200) {
    const { data, error } = await sb.from("meta_messages").select("mid").in("mid", mids.slice(i, i + 200));
    if (error) {
      console.error("[meta-messages] midsExistentes:", error.message);
      return out;
    }
    for (const r of (data ?? []) as { mid: string }[]) out.add(r.mid);
  }
  return out;
}

/** Las columnas a pedir, con o sin la de historias según lo que haya en la base. */
function columnasMeta(): string {
  const base = "id, mid, tenant, canal, page_id, sender_id, sender_name, texto, ts, direction";
  return columnaHistoria.hay
    ? `${base}, historia_url, adjunto_miniatura, adjunto_video, staff_id, staff_nombre, tema`
    : base;
}

export interface ResumenMeta {
  ultimos: MetaMensaje[];
  cursor: number;
  sinVista?: boolean;
}

/**
 * El último mensaje de cada conversación. Mismo motivo que en WhatsApp: la
 * lista se arma de una fila por conversación, no releyendo todo.
 */
export async function ultimoPorConversacion(tenant?: string): Promise<ResumenMeta> {
  const sb = getSupabase(tenant);
  if (!sb) {
    const por = new Map<string, MetaMensaje>();
    for (const m of mem.rows) {
      if (!tenant || m.tenant === tenant) por.set(`${m.canal}|${m.pageId}|${m.senderId}`, m);
    }
    return { ultimos: [...por.values()], cursor: mem.seq };
  }
  const ultimos: MetaMensaje[] = [];
  for (let desde = 0; ; desde += 1000) {
    let q = sb.from("meta_ultimo_por_conversacion").select(columnasMeta());
    if (tenant) q = q.eq("tenant", tenant);
    let { data, error } = await q.order("id", { ascending: false }).range(desde, desde + 999);
    if (error && faltaLaColumna(error.message)) {
      columnaHistoria.hay = false;
      let q2 = sb.from("meta_ultimo_por_conversacion").select(columnasMeta());
      if (tenant) q2 = q2.eq("tenant", tenant);
      ({ data, error } = await q2.order("id", { ascending: false }).range(desde, desde + 999));
    }
    if (error) {
      console.error("[meta-messages] resumen:", error.message);
      return { ultimos: [], cursor: 0, sinVista: true };
    }
    const filas = (data ?? []) as unknown as Record<string, unknown>[];
    ultimos.push(...filas.map(deFila));
    if (filas.length < 1000) break;
  }
  // El último mensaje suele ser nuestro y no trae el nombre de la persona;
  // sin esto la bandeja muestra "IG 381463" hasta que alguien abre el chat.
  const sinNombre = ultimos.filter((m) => !m.senderName);
  if (sinNombre.length) {
    let qn = sb.from("meta_nombre_por_conversacion").select("canal, page_id, sender_id, sender_name");
    if (tenant) qn = qn.eq("tenant", tenant);
    const { data: nombres } = await qn.limit(5000);
    const porClave = new Map<string, string>();
    for (const n of (nombres ?? []) as { canal: string; page_id: string; sender_id: string; sender_name: string }[]) {
      porClave.set(`${n.canal}|${n.page_id}|${n.sender_id}`, n.sender_name);
    }
    for (const m of sinNombre) {
      const nombre = porClave.get(`${m.canal}|${m.pageId}|${m.senderId}`);
      if (nombre) m.senderName = nombre;
    }
  }
  return { ultimos, cursor: ultimos.reduce((max, m) => Math.max(max, m.seq), 0) };
}

/** Los mensajes de una conversación anteriores a una fecha, del más nuevo al más viejo. */
export async function mensajesAnteriores(
  clave: { canal: MetaCanal; pageId: string; senderId: string },
  antes: string | null,
  limite: number,
  tenant?: string,
): Promise<{ mensajes: MetaMensaje[]; hayMas: boolean }> {
  const sb = getSupabase(tenant);
  const tope = Math.min(Math.max(limite, 1), 200);
  const esDeLaConv = (m: MetaMensaje) =>
    m.canal === clave.canal && m.pageId === clave.pageId && m.senderId === clave.senderId;
  if (!sb) {
    const todos = mem.rows
      .filter((m) => esDeLaConv(m) && (!tenant || m.tenant === tenant) && (!antes || m.ts < antes))
      .sort((a, b) => b.ts.localeCompare(a.ts));
    return { mensajes: todos.slice(0, tope), hayMas: todos.length > tope };
  }
  const armar = () => {
    let q = sb
      .from("meta_messages")
      .select(columnasMeta())
      .eq("canal", clave.canal)
      .eq("page_id", clave.pageId)
      .eq("sender_id", clave.senderId);
    if (tenant) q = q.eq("tenant", tenant);
    if (antes) q = q.lt("ts", antes);
    return q.order("ts", { ascending: false }).limit(tope + 1);
  };
  let { data, error } = await armar();
  if (error && faltaLaColumna(error.message)) {
    columnaHistoria.hay = false;
    ({ data, error } = await armar());
  }
  if (error) {
    console.error("[meta-messages] hilo:", error.message);
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
 * `limite` por lo mismo que en WhatsApp: la misma consulta sirve al sondeo de
 * cada cuatro segundos y a la carga inicial, que tras importar el historial de
 * Facebook son miles. Mil es el techo de PostgREST.
 */
export async function getMetaSince(after: number, tenant?: string, limite = 100): Promise<MetaMensaje[]> {
  const sb = getSupabase(tenant);
  if (sb) {
    // Las dos listas escritas enteras y no armadas con una plantilla: el
    // cliente de Supabase lee el texto del select para tipar la respuesta, y
    // con una plantilla no puede.
    async function traer(conHistoria: boolean) {
      let q = sb!
        .from("meta_messages")
        .select(
          conHistoria
            ? "id, mid, tenant, canal, page_id, sender_id, sender_name, texto, ts, direction, historia_url, adjunto_miniatura, adjunto_video, staff_id, staff_nombre, tema"
            : "id, mid, tenant, canal, page_id, sender_id, sender_name, texto, ts, direction",
        )
        .gt("id", after);
      if (tenant) q = q.eq("tenant", tenant);
      return q.order("id", { ascending: true }).limit(Math.min(limite, 1000));
    }

    let { data, error } = await traer(columnaHistoria.hay);

    // La migración de `historia_url` todavía no se corrió. Se vuelve a pedir
    // sin ella: quedarse sin saber a qué historia contestaron es un detalle,
    // quedarse sin NINGÚN mensaje de Meta no lo es.
    if (error && faltaLaColumna(error.message)) {
      columnaHistoria.hay = false;
      console.error("[meta-messages] falta historia_url: se lee sin ella. Corré la migración.");
      ({ data, error } = await traer(false));
    }

    if (!error) {
      // Se lee como filas sueltas: son dos consultas con distinto juego de
      // columnas y el tipado del cliente no puede con las dos a la vez.
      const filas = (data ?? []) as unknown as Record<string, unknown>[];
      return filas.map((r) => ({
        seq: Number(r.id),
        mid: (r.mid as string | null) ?? `meta-fila-${r.id}`,
        tenant: r.tenant as string,
        canal: (r.canal as MetaCanal) ?? "facebook",
        pageId: r.page_id as string,
        senderId: r.sender_id as string,
        senderName: (r.sender_name as string | null) ?? undefined,
        texto: r.texto as string,
        ts: r.ts as string,
        direction: ((r.direction as string | null) ?? "in") as MetaDireccion,
        historiaUrl: (r.historia_url as string | null) ?? undefined,
        adjuntoMiniatura: (r.adjunto_miniatura as string | null) ?? undefined,
        adjuntoVideo: (r.adjunto_video as string | null) ?? undefined,
        staffId: (r.staff_id as string | null) ?? undefined,
        staffNombre: (r.staff_nombre as string | null) ?? undefined,
        tema: (r.tema as string | null) ?? undefined,
      }));
    }
    console.error("[meta-messages] select falló, cae a memoria:", error.message);
  }
  return mem.rows.filter((m) => m.seq > after && (!tenant || m.tenant === tenant));
}

/**
 * Varios mensajes de una vez, en el orden en que vienen.
 *
 * Lo usa el sondeo de Messenger: la primera vuelta de una instancia trae hasta
 * 150 mensajes por página, y guardarlos de a uno tardaba 14 segundos, que era
 * lo que esperaba la bandeja. Un solo upsert los deja en menos de uno. Postgres
 * los inserta en el orden del arreglo, así que el seq respeta la cronología
 * igual que guardándolos de a uno.
 *
 * Si el lote falla por lo que sea, cae al camino de a uno, que ya sabe
 * arreglárselas (columna que falta, memoria).
 */
export async function addMetaLote(mensajes: Omit<MetaMensaje, "seq">[]): Promise<void> {
  if (mensajes.length === 0) return;
  const sb = getSupabase(mensajes[0].tenant);
  if (sb) {
    const filas = mensajes.map((m) => {
      const base = {
        mid: m.mid,
        tenant: m.tenant,
        canal: m.canal,
        page_id: m.pageId,
        sender_id: m.senderId,
        sender_name: m.senderName ?? null,
        texto: m.texto,
        ts: m.ts,
        direction: m.direction,
      };
      return columnaHistoria.hay
        ? {
            ...base,
            historia_url: m.historiaUrl ?? null,
            adjunto_miniatura: m.adjuntoMiniatura ?? null,
            adjunto_video: m.adjuntoVideo ?? null,
            staff_id: m.staffId ?? null,
            staff_nombre: m.staffNombre ?? null,
            tema: m.tema ?? null,
          }
        : base;
    });
    const { error } = await sb
      .from("meta_messages")
      .upsert(filas, { onConflict: "mid", ignoreDuplicates: true });
    if (!error) return;
    console.error("[meta-messages] lote falló, se guarda de a uno:", error.message);
  }
  for (const m of mensajes) await guardar(m);
}
