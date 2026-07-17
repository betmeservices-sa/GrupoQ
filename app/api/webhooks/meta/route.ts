import crypto from "node:crypto";
import { addMetaInbound, type MetaCanal } from "@/lib/meta-messages-store";
import { conexionPorActivo } from "@/lib/meta-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook de Messenger e Instagram (productos Messenger + Instagram de la app
// MiAgentIA). UNA URL sirve a todos los clientes: el tenant se resuelve por el
// page_id / ig_id que Meta manda en cada evento, buscándolo en las conexiones
// que dejó el OAuth (meta_connections), igual que WhatsApp enruta por
// phone_number_id.

// 1) Verificación: Meta hace un GET al configurar la Callback URL.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function firmaValida(raw: string, firma: string | null, secret: string): boolean {
  if (!firma) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(firma);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Shape común de Messenger e Instagram: entry[].messaging[] con sender,
// recipient, timestamp (en MILISEGUNDOS, a diferencia de WhatsApp) y message.
interface MetaMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type?: string }>;
  };
}

interface MetaEntry {
  id?: string; // object=page: page id | object=instagram: ig business id
  messaging?: MetaMessagingEvent[];
}

// 2) Recepción: Meta hace POST con los mensajes entrantes.
export async function POST(req: Request) {
  const raw = await req.text();

  // Valida la firma con el App Secret. Sin secret (seam FAKE / prueba local)
  // se acepta con un aviso en el log.
  const secret = process.env.META_APP_SECRET;
  if (secret) {
    const firma = req.headers.get("x-hub-signature-256");
    if (!firmaValida(raw, firma, secret)) {
      return new Response("Invalid signature", { status: 401 });
    }
  } else {
    console.warn("[meta-webhook] META_APP_SECRET vacío: se acepta sin validar firma");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const body = payload as { object?: string; entry?: MetaEntry[] };
  if (body.object !== "page" && body.object !== "instagram") {
    // Otros objetos (permissions, etc.): 200 para que Meta no reintente.
    return new Response("IGNORED", { status: 200 });
  }
  const canal: MetaCanal = body.object === "instagram" ? "instagram" : "facebook";

  try {
    for (const entry of body.entry ?? []) {
      const activoId = String(entry.id ?? "");
      for (const ev of entry.messaging ?? []) {
        const msg = ev.message;
        // Echo = copia de lo que la página envió (ya lo persistimos al enviar).
        if (!msg || msg.is_echo) continue;
        const senderId = ev.sender?.id;
        if (!senderId) continue;

        // Enrutar: el id del entry (page id o ig id) o, en su defecto, el
        // recipient (en entrantes también es el activo) → tenant dueño.
        const cx =
          (await conexionPorActivo(activoId)) ??
          (ev.recipient?.id ? await conexionPorActivo(ev.recipient.id) : null);
        if (!cx) {
          console.warn(`[meta-webhook] sin conexión para activo ${activoId} (${canal}), se ignora`);
          continue;
        }

        // Texto vs adjunto: por ahora el adjunto se muestra como marca en el hilo.
        const texto =
          msg.text ??
          (msg.attachments?.length ? `[${msg.attachments[0]?.type ?? "adjunto"}]` : null);
        if (!texto) continue;

        const ts = ev.timestamp
          ? new Date(Number(ev.timestamp)).toISOString()
          : new Date().toISOString();

        await addMetaInbound({
          mid: msg.mid ?? `${canal}-${senderId}-${ev.timestamp ?? Date.now()}`,
          tenant: cx.tenant,
          canal,
          // Guardamos SIEMPRE el page_id de la conexión: Instagram también se
          // responde por el endpoint de mensajes de la página.
          pageId: cx.pageId,
          senderId,
          texto,
          ts,
        });
      }
    }
  } catch (e) {
    // No reventamos: respondemos 200 igual para que Meta no reintente en bucle.
    console.error("[meta-webhook] error procesando payload:", e);
  }

  return new Response("OK", { status: 200 });
}
