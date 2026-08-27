// Sondeo de los mensajes directos de Instagram, cuenta por cuenta.
//
// El webhook avisa de lo nuevo, pero no de lo que ya estaba: una cuenta que
// recién hizo su login de Instagram tiene conversaciones de meses que nadie
// vio en el panel. Con el token del login (graph.instagram.com) sí se puede
// listar el historial, igual que hace lib/meta-sondeo-messenger.ts con la
// API de páginas para Messenger. Misma forma de fila, mismo dedup por mid.
//
// Se dispara desde la bandeja junto con el de Messenger y se frena solo a una
// vuelta cada 30 s por cliente.

import { addMetaLote, midsExistentes } from "./meta-messages-store";
import { temaDe } from "./tema";
import { programarRespuestaIAMeta } from "./meta-ai-reply";
import { TENANTS } from "./tenants";
import type { TenantId } from "./tenants/types";
import { conexionesDe, type MetaConnection } from "./meta-store";
import { filasDeConversaciones, type ConversacionGraph, type MensajeGraph } from "./meta-sondeo-messenger";

const IG_GRAPH = "https://graph.instagram.com/v21.0";
const CADA_MS = 30_000;
const CONVERSACIONES = 15;
const MENSAJES_POR_CONVERSACION = 10;
const MARGEN_MS = 10 * 60_000;
const ESPERA_META_MS = 8_000;

const ultimaVuelta = new Map<string, number>();
const ultimaVueltaPorCuenta = new Map<string, number>();

/** Lo que devuelve la API de Instagram: usuarios con `username`, adjuntos por tipo. */
export interface ConversacionIg {
  updated_time?: string;
  participants?: { data?: { id?: string; username?: string; name?: string }[] };
  messages?: {
    data?: (Omit<MensajeGraph, "attachments"> & {
      attachments?: { data?: { image_data?: unknown; video_data?: unknown; audio_data?: unknown; file_url?: string }[] };
    })[];
  };
}

/**
 * A la forma que ya entiende filasDeConversaciones: el nombre del participante
 * es su usuario de Instagram, y los adjuntos se traducen a un mime aproximado
 * para que salgan las mismas marcas ([imagen], [video], [audio]).
 */
export function normalizarConversacionIg(c: ConversacionIg): ConversacionGraph {
  return {
    updated_time: c.updated_time,
    participants: {
      data: (c.participants?.data ?? []).map((p) => ({ id: p.id, name: p.name ?? p.username })),
    },
    messages: {
      data: (c.messages?.data ?? []).map((m) => {
        const a = m.attachments?.data?.[0];
        const mime = !a ? undefined : a.image_data ? "image/jpeg" : a.video_data ? "video/mp4" : a.audio_data ? "audio/mp4" : "application/octet-stream";
        return { ...m, attachments: mime ? { data: [{ mime_type: mime }] } : undefined };
      }),
    },
  };
}

async function conversacionesDeCuenta(cx: MetaConnection): Promise<ConversacionGraph[]> {
  const campos =
    `participants,updated_time,messages.limit(${MENSAJES_POR_CONVERSACION})` +
    `{id,message,from,created_time,attachments}`;
  const url =
    `${IG_GRAPH}/me/conversations?platform=instagram&limit=${CONVERSACIONES}` +
    `&fields=${encodeURIComponent(campos)}&access_token=${encodeURIComponent(cx.igToken!)}`;
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ESPERA_META_MS) });
  const j = (await r.json()) as { data?: ConversacionIg[]; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "Instagram devolvió error");
  return (j.data ?? []).map(normalizarConversacionIg);
}

async function sincronizarCuenta(cx: MetaConnection, desdeMs: number): Promise<number> {
  const casa = new Set([cx.igId, cx.pageId].filter(Boolean) as string[]);
  const filas = filasDeConversaciones(await conversacionesDeCuenta(cx), casa, desdeMs);
  const yaEstaban = await midsExistentes(cx.tenant, filas.map((f) => f.mid));
  const nuevas = filas.filter((f) => !yaEstaban.has(f.mid));
  await addMetaLote(
    nuevas.map((f) => ({
      mid: f.mid,
      tenant: cx.tenant,
      canal: "instagram" as const,
      pageId: cx.pageId,
      senderId: f.senderId,
      senderName: f.senderName,
      texto: f.texto,
      ts: f.ts,
      direction: f.direction,
      tema: f.direction === "in" ? temaDe(f.texto) : undefined,
      staffNombre: f.direction === "out" ? "Equipo" : undefined,
    })),
  );
  // Lo mismo que el webhook: si lo último de una persona es un mensaje nuevo
  // entrante, Sofía lo contesta (si la IA está encendida para ese chat).
  if (TENANTS[cx.tenant as TenantId]?.ai?.systemPrompt) {
    const ultimoPorPersona = new Map<string, (typeof filas)[number]>();
    for (const f of filas) ultimoPorPersona.set(f.senderId, f);
    for (const f of nuevas) {
      if (f.direction !== "in" || f.texto.startsWith("[audio]")) continue;
      if (ultimoPorPersona.get(f.senderId)?.mid !== f.mid) continue;
      await programarRespuestaIAMeta({
        tenant: cx.tenant as TenantId,
        canal: "instagram",
        pageId: cx.pageId,
        senderId: f.senderId,
        mid: f.mid,
      });
    }
  }
  return nuevas.length;
}

/** Una vuelta por las cuentas de Instagram con login del cliente, si ya pasaron 30 s. */
export async function sincronizarInstagram(tenant: string): Promise<void> {
  const ahora = Date.now();
  const antes = ultimaVuelta.get(tenant) ?? 0;
  if (ahora - antes < CADA_MS) return;
  ultimaVuelta.set(tenant, ahora);
  try {
    const cuentas = (await conexionesDe(tenant)).filter((c) => c.igToken && c.igId);
    await Promise.all(
      cuentas.map((cx) => {
        // Reloj por cuenta: la recién conectada baja todo su historial.
        const antesCuenta = ultimaVueltaPorCuenta.get(cx.igId!) ?? 0;
        ultimaVueltaPorCuenta.set(cx.igId!, ahora);
        const desdeMs = antesCuenta ? antesCuenta - MARGEN_MS : 0;
        return sincronizarCuenta(cx, desdeMs).catch((e) => {
          console.error(`[ig-sondeo] ${cx.pageName}:`, e instanceof Error ? e.message : e);
        });
      }),
    );
  } catch (e) {
    console.error("[ig-sondeo] no se pudo sondear:", e instanceof Error ? e.message : e);
  }
}
