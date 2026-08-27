// Lo que se le hace a un mensaje sin escribir otro: reaccionar, marcarlo
// como visto, avisar que se está escribiendo.
//
// Sale por dos puertas, igual que enviar: por la cuenta de Instagram (login
// propio) cuando la hay, y si no por la página. Con una diferencia que no es
// nuestra: por la página, Meta solo acepta la reacción "love"; por la cuenta
// de Instagram acepta cualquier emoji. Se devuelve cuál quedó aplicada para
// que la pantalla no mienta.

import { IG_GRAPH, tokenIgVigente } from "./meta-ig-login";
import { GRAPH } from "./meta-oauth";
import type { MetaConnection } from "./meta-store";
import type { MetaCanal } from "./meta-messages-store";

export type AccionMensaje =
  | { accion: "reaccionar"; mid: string; emoji: string }
  | { accion: "quitar_reaccion"; mid: string }
  | { accion: "visto" }
  | { accion: "escribiendo" };

/** El cuerpo que se le manda a Meta, y qué reacción queda si aplica. */
export function cuerpoDeAccion(
  recipientId: string,
  a: AccionMensaje,
  cuentaDirecta: boolean,
): { cuerpo: Record<string, unknown>; aplicada?: string } {
  const recipient = { id: recipientId };
  switch (a.accion) {
    case "reaccionar": {
      // Sin el selector de variante (U+FE0F): "❤️" tal cual lo manda el
      // teclado Meta lo rechaza con "Invalid reaction"; "❤" pelado lo acepta.
      const reaction = cuentaDirecta ? a.emoji.replace(/️/g, "") : "love";
      return {
        cuerpo: { recipient, sender_action: "react", payload: { message_id: a.mid, reaction } },
        aplicada: cuentaDirecta ? a.emoji : "❤️",
      };
    }
    case "quitar_reaccion":
      return { cuerpo: { recipient, sender_action: "unreact", payload: { message_id: a.mid } } };
    case "visto":
      return { cuerpo: { recipient, sender_action: "mark_seen" } };
    case "escribiendo":
      return { cuerpo: { recipient, sender_action: "typing_on" } };
  }
}

export async function accionEnMensaje(
  cx: MetaConnection,
  canal: MetaCanal,
  recipientId: string,
  a: AccionMensaje,
): Promise<{ aplicada?: string }> {
  const tokenIg = canal === "instagram" ? await tokenIgVigente(cx) : null;
  const { cuerpo, aplicada } = cuerpoDeAccion(recipientId, a, Boolean(tokenIg));

  const r = tokenIg
    ? await fetch(`${IG_GRAPH}/${cx.igId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenIg}` },
        body: JSON.stringify(cuerpo),
      })
    : await fetch(`${GRAPH}/${cx.pageId}/messages?access_token=${encodeURIComponent(cx.pageToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!r.ok || j.error) throw new Error(j.error?.message ?? `Meta no aceptó la acción (HTTP ${r.status}).`);
  return { aplicada };
}
