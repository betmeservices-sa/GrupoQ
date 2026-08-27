// Mandar un texto por Messenger o Instagram y dejarlo en el hilo con su autor.
//
// Un solo lugar para las tres cosas que mandan mensajes: la persona desde el
// panel, la IA, y los textos fijos del agente (pregunta de sede, cierres). Así
// todos salen por la misma puerta (la cuenta de Instagram si tiene login
// propio, si no la página) y todos quedan guardados con quién los escribió.

import { GRAPH } from "./meta-oauth";
import { enviarDmIg } from "./meta-ig-login";
import { addMetaOutbound, type MetaCanal } from "./meta-messages-store";
import type { MetaConnection } from "./meta-store";

export interface QuienResponde {
  /** Ficha del equipo (s2, s3...), "ia", o undefined si no hay ficha. */
  staffId?: string;
  /** Para pintar cuando no hay ficha (cuenta de la agencia, app de Facebook). */
  nombre?: string;
}

export const IA_STAFF_ID = "ia";

export async function enviarTextoMeta(
  cx: MetaConnection,
  canal: MetaCanal,
  recipientId: string,
  texto: string,
): Promise<{ ok: true; mid: string } | { ok: false; error: string }> {
  try {
    // Instagram con login propio: sale por graph.instagram.com con el token de
    // la cuenta. Es el camino que sirve sin App Review para gente sin rol.
    if (canal === "instagram" && cx.igToken) {
      const mid = await enviarDmIg(cx, recipientId, texto);
      return { ok: true, mid: mid ?? `out-instagram-${recipientId}-${Date.now()}` };
    }
    const r = await fetch(`${GRAPH}/${cx.pageId}/messages?access_token=${encodeURIComponent(cx.pageToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_type: "RESPONSE",
        recipient: { id: recipientId },
        message: { text: texto },
      }),
    });
    const d = (await r.json().catch(() => ({}))) as { message_id?: string; error?: { message?: string } };
    if (!r.ok || d.error) return { ok: false, error: d.error?.message ?? `HTTP ${r.status}` };
    return { ok: true, mid: d.message_id ?? `out-${canal}-${recipientId}-${Date.now()}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error de red" };
  }
}

/** Manda y guarda. Devuelve el mid, o null si no salió. */
export async function enviarYGuardarMeta(
  cx: MetaConnection,
  canal: MetaCanal,
  recipientId: string,
  texto: string,
  quien: QuienResponde,
): Promise<string | null> {
  const env = await enviarTextoMeta(cx, canal, recipientId, texto);
  if (!env.ok) {
    console.error(`[meta-enviar] ${canal} a ${recipientId.slice(-6)} falló:`, env.error);
    return null;
  }
  // Se guarda con sender_id = destinatario: es la clave de la conversación.
  await addMetaOutbound({
    mid: env.mid,
    tenant: cx.tenant,
    canal,
    pageId: cx.pageId,
    senderId: recipientId,
    texto,
    ts: new Date().toISOString(),
    staffId: quien.staffId,
    staffNombre: quien.nombre,
  });
  return env.mid;
}
