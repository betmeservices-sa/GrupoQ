// Envío a la WhatsApp Cloud API (texto e indicador "escribiendo"). Lo usan
// tanto la respuesta manual del staff como la respuesta automática de la IA.

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export async function enviarTextoWa(
  to: string,
  text: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID" };
  }

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
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID" };
  }
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
export async function mostrarEscribiendo(messageId: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
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
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: "Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID" };
  }

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
export async function enviarReaccion(to: string, messageId: string, emoji: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
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
