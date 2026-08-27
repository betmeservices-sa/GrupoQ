// Traer los mensajes de Messenger que el webhook no entrega.
//
// POR QUÉ EXISTE
// Sin acceso avanzado (App Review), Meta solo avisa por webhook de mensajes de
// personas con rol en la app. El de un cliente real de Yali queda en la bandeja
// de la página y a nosotros no nos llega nada: se comprobó el 2026-08-26 con
// una respuesta a historia que nunca generó aviso.
//
// La API de conversaciones de la página SÍ devuelve todo (el importador trajo
// 600 con ese mismo token), así que se le pregunta cada tanto qué hay nuevo.
// Es un puente: cuando salga el App Review, el webhook vuelve a ser el camino y
// esto solo deja de encontrar cosas nuevas, sin estorbar.
//
// Solo Messenger. Las conversaciones de Instagram por esta API contestan
// "Application does not have the capability", y los DMs de IG sí llegan por
// webhook.
//
// Se dispara desde el sondeo de la bandeja (cada 4 s) y se frena solo a una
// vuelta cada 30 s por cliente: una llamada a Meta por página cada 30 s.

import { addMetaLote } from "./meta-messages-store";
import { conexionesDe, type MetaConnection } from "./meta-store";
import { esRespuestaAComentario } from "./respuesta-a-comentario";

const GRAPH = "https://graph.facebook.com/v21.0";
const CADA_MS = 30_000;
const CONVERSACIONES = 15;
const MENSAJES_POR_CONVERSACION = 10;
// Margen al filtrar por fecha: el reloj de Meta y el nuestro no van iguales.
const MARGEN_MS = 10 * 60_000;
const ESPERA_META_MS = 8_000;

export interface MensajeGraph {
  id?: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
  attachments?: { data?: { mime_type?: string; name?: string }[] };
  sticker?: string;
  shares?: { data?: { link?: string; name?: string }[] };
}

export interface ConversacionGraph {
  updated_time?: string;
  participants?: { data?: { id?: string; name?: string }[] };
  messages?: { data?: MensajeGraph[] };
}

export interface FilaSondeo {
  mid: string;
  senderId: string;
  senderName?: string;
  texto: string;
  ts: string;
  direction: "in" | "out";
}

/**
 * Qué se guarda de un mensaje de la API de conversaciones.
 *
 * Mismas marcas entre corchetes que el webhook: son lo único que le dice a
 * quien atiende de qué le hablan cuando no hay texto.
 */
export function textoDeMensajeGraph(m: MensajeGraph): string | null {
  if (m.message) return m.message;
  if (m.sticker) return "[sticker]";
  const adj = m.attachments?.data?.[0];
  if (adj) {
    const mime = adj.mime_type ?? "";
    if (mime.startsWith("image/")) return "[imagen]";
    if (mime.startsWith("video/")) return "[video]";
    if (mime.startsWith("audio/")) return "[audio]";
    return "[archivo]";
  }
  if (m.shares?.data?.length) return "[compartió un enlace]";
  return null;
}

/**
 * Las filas a guardar, en orden cronológico.
 *
 * `casa` son los ids de la página y su Instagram: si el mensaje sale de uno
 * de esos, lo escribió el negocio. La conversación se identifica SIEMPRE por
 * la contraparte, en los dos sentidos, igual que hace el webhook.
 */
export function filasDeConversaciones(
  conversaciones: ConversacionGraph[],
  casa: Set<string>,
  desdeMs = 0,
): FilaSondeo[] {
  const filas: FilaSondeo[] = [];
  for (const conv of conversaciones) {
    if (desdeMs && conv.updated_time && Date.parse(conv.updated_time) < desdeMs) continue;
    const otro = (conv.participants?.data ?? []).find((p) => p.id && !casa.has(p.id));
    if (!otro?.id) continue; // sin contraparte no hay a quién asignarla

    for (const m of conv.messages?.data ?? []) {
      if (!m.id || !m.created_time) continue;
      if (desdeMs && Date.parse(m.created_time) < desdeMs) continue;
      const texto = textoDeMensajeGraph(m);
      if (!texto) continue;
      // Contestar un comentario en privado deja una nota de Meta en el hilo,
      // que no la escribió nadie. Eso es de Comentarios, no de la bandeja.
      if (esRespuestaAComentario(texto)) continue;
      filas.push({
        mid: m.id,
        senderId: otro.id,
        senderName: otro.name ?? undefined,
        texto,
        ts: new Date(m.created_time).toISOString(),
        direction: m.from?.id && casa.has(m.from.id) ? "out" : "in",
      });
    }
  }
  // La bandeja relee por id y el estado de cada conversación sale de quién
  // habló último: si entraran como las da Meta (la más nueva primero), el
  // último guardado sería el más viejo y el estado quedaría al revés.
  filas.sort((a, b) => a.ts.localeCompare(b.ts));
  return filas;
}

// Última vuelta por cliente. En globalThis para que en dev el inbox y el
// webhook compartan el reloj; en Vercel es por instancia, y si hay dos
// instancias despiertas cada una pregunta por su lado: el dedup por mid lo
// absorbe y solo cuesta una llamada de más.
const g = globalThis as unknown as { __metaSondeoUltimo?: Map<string, number> };
const ultimaVuelta = (g.__metaSondeoUltimo ??= new Map<string, number>());

async function conversacionesDePagina(cx: MetaConnection): Promise<ConversacionGraph[]> {
  const campos =
    `participants,updated_time,messages.limit(${MENSAJES_POR_CONVERSACION})` +
    `{id,message,from,created_time,attachments{mime_type,name},sticker,shares{link,name}}`;
  const url =
    `${GRAPH}/${cx.pageId}/conversations?platform=messenger&limit=${CONVERSACIONES}` +
    `&fields=${encodeURIComponent(campos)}&access_token=${encodeURIComponent(cx.pageToken)}`;
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ESPERA_META_MS) });
  const j = (await r.json()) as { data?: ConversacionGraph[]; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "Meta devolvió error");
  return j.data ?? [];
}

async function sincronizarPagina(cx: MetaConnection, desdeMs: number): Promise<number> {
  const casa = new Set([cx.pageId, cx.igId].filter(Boolean) as string[]);
  const filas = filasDeConversaciones(await conversacionesDePagina(cx), casa, desdeMs);
  // En un solo lote y en orden: el seq de la base es el orden de llegada.
  await addMetaLote(
    filas.map((f) => ({
      mid: f.mid,
      tenant: cx.tenant,
      canal: "facebook" as const,
      pageId: cx.pageId,
      senderId: f.senderId,
      senderName: f.senderName,
      texto: f.texto,
      ts: f.ts,
      direction: f.direction,
    })),
  );
  return filas.length;
}

/**
 * Una vuelta por las páginas del cliente, si ya pasaron 30 s de la anterior.
 *
 * Nunca lanza: si Meta falla, se anota y la bandeja sigue con lo que tiene.
 */
export async function sincronizarMessenger(tenant: string): Promise<void> {
  const ahora = Date.now();
  const antes = ultimaVuelta.get(tenant) ?? 0;
  if (ahora - antes < CADA_MS) return;
  ultimaVuelta.set(tenant, ahora);

  // Primera vuelta de la instancia: sin filtro de fecha, se toman las últimas
  // conversaciones enteras y el dedup descarta lo ya guardado.
  const desdeMs = antes ? antes - MARGEN_MS : 0;
  try {
    const conexiones = await conexionesDe(tenant);
    await Promise.all(
      conexiones.map((cx) =>
        sincronizarPagina(cx, desdeMs).catch((e) => {
          console.error(`[meta-sondeo] ${cx.pageName}:`, e instanceof Error ? e.message : e);
        }),
      ),
    );
  } catch (e) {
    console.error("[meta-sondeo] no se pudo sondear:", e instanceof Error ? e.message : e);
  }
}
