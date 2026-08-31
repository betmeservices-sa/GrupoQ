// Envío a la WhatsApp Cloud API (texto e indicador "escribiendo"). Lo usan
// tanto la respuesta manual del staff como la respuesta automática de la IA.
//
// Cada función recibe el cliente en nombre del que habla. Con eso se manda
// desde SU número (lib/wa-credenciales.ts). Sin cliente, habla el número de la
// demo, que es lo que hacía siempre.

import { credencialesWa } from "./wa-credenciales";

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export interface OpcionesEnvio {
  tenant?: string;
}

const SIN_NUMERO = "Este cliente no tiene un número de WhatsApp conectado.";

export async function enviarTextoWa(
  to: string,
  text: string,
  opts: OpcionesEnvio = {},
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = await credencialesWa(opts.tenant);
  if (!c) return { ok: false, error: SIN_NUMERO };
  const { token, phoneId } = c;

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      (data as { error?: { message?: string } })?.error?.message ?? `Graph respondió ${res.status}`;
    return { ok: false, error };
  }
  const id = (data as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id;
  return { ok: true, id };
}

// Bloquea un número con la Block Users API: deja de recibir sus mensajes en el
// webhook (no vuelve a aparecer en la bandeja). Idempotente: si ya estaba
// bloqueado, Graph responde ok igual.
export async function bloquearNumeroWa(
  waId: string,
  opts: OpcionesEnvio = {},
): Promise<{ ok: boolean; error?: string }> {
  const c = await credencialesWa(opts.tenant);
  if (!c) return { ok: false, error: SIN_NUMERO };
  const { token, phoneId } = c;
  const res = await fetch(`${GRAPH}/${phoneId}/block_users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", block_users: [{ user: waId }] }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      (data as { error?: { message?: string } })?.error?.message ?? `Graph respondió ${res.status}`;
    return { ok: false, error };
  }
  return { ok: true };
}

// Muestra "escribiendo..." en el WhatsApp del cliente (y marca leído) usando el
// wamid del último mensaje recibido. Dura hasta 25s o hasta que llegue la respuesta.
export async function mostrarEscribiendo(messageId: string, opts: OpcionesEnvio = {}): Promise<void> {
  const c = await credencialesWa(opts.tenant);
  if (!c) return;
  const { token, phoneId } = c;
  await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
  }).catch(() => {});
}

// Envía una PLANTILLA aprobada (template message). Es el único texto permitido
// fuera de la ventana de 24h, y sirve para iniciar conversación. Los `variables`
// rellenan los {{1}}, {{2}}, ... del cuerpo en orden.
export async function enviarPlantilla(
  to: string,
  name: string,
  language: string,
  variables: string[] = [],
  opts: OpcionesEnvio = {},
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = await credencialesWa(opts.tenant);
  if (!c) return { ok: false, error: SIN_NUMERO };
  const { token, phoneId } = c;

  const components = variables.length
    ? [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) }]
    : [];

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(components.length ? { components } : {}),
      },
    }),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      (data as { error?: { message?: string } })?.error?.message ?? `Graph respondió ${res.status}`;
    return { ok: false, error };
  }
  const id = (data as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id;
  return { ok: true, id };
}

// Reacciona a un mensaje del cliente con un emoji.
export async function enviarReaccion(
  to: string,
  messageId: string,
  emoji: string,
  opts: OpcionesEnvio = {},
): Promise<void> {
  const c = await credencialesWa(opts.tenant);
  if (!c) return;
  const { token, phoneId } = c;
  await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "reaction",
      reaction: { message_id: messageId, emoji },
    }),
  }).catch(() => {});
}
