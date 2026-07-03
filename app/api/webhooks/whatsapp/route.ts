import crypto from "node:crypto";
import { after } from "next/server";
import { addInbound } from "@/lib/wa-store";
import { addAdjunto } from "@/lib/contacts-store";
import { programarRespuestaIA } from "@/lib/ai-reply";
import { getWaTenant } from "@/lib/wa-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La respuesta de la IA corre en `after` (después de responder 200 a Meta). En
// Vercel usa waitUntil; subimos el límite para que quepa el debounce + Claude.
export const maxDuration = 60;

// 1) Verificación: Meta hace un GET al configurar la Callback URL.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
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

interface WaMedia {
  id?: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
}

interface WaMessage {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body: string };
  image?: WaMedia;
  document?: WaMedia;
  audio?: WaMedia;
  sticker?: WaMedia;
  video?: WaMedia;
}

// 2) Recepción: Meta hace POST con los mensajes entrantes.
export async function POST(req: Request) {
  const raw = await req.text();

  // Valida la firma solo si configuraste el App Secret (en prueba local puede ir vacío).
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (secret) {
    const firma = req.headers.get("x-hub-signature-256");
    if (!firmaValida(raw, firma, secret)) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // A qué cliente entra el número en vivo (switch global). Etiqueta cada mensaje
  // y decide con qué guion responde la IA.
  const tenantActivo = await getWaTenant();

  const entrantes: Array<{ from: string; wamid: string }> = [];
  try {
    const entries = (payload as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] })?.changes ?? [];
      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> })?.value ?? {};
        const nombrePorWaId = new Map<string, string>();
        for (const c of (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }>) ?? []) {
          if (c?.wa_id) nombrePorWaId.set(c.wa_id, c?.profile?.name ?? "");
        }
        for (const m of (value.messages as WaMessage[]) ?? []) {
          const ts = m.timestamp
            ? new Date(Number(m.timestamp) * 1000).toISOString()
            : new Date().toISOString();

          // Texto vs archivo. El archivo se guarda como adjunto en la ficha y se
          // muestra como una marca en el hilo (la IA no puede abrirlo).
          let texto: string | null = null;
          let adjunto: { tipo: string; media?: WaMedia } | null = null;
          if (m.type === "text" && m.text?.body) {
            texto = m.text.body;
          } else if (m.type === "image") {
            texto = m.image?.caption ? `[imagen] ${m.image.caption}` : "[imagen]";
            adjunto = { tipo: "image", media: m.image };
          } else if (m.type === "document") {
            texto = `[documento: ${m.document?.filename ?? "archivo"}]`;
            adjunto = { tipo: "document", media: m.document };
          } else if (m.type === "audio") {
            texto = "[audio]";
            adjunto = { tipo: "audio", media: m.audio };
          } else if (m.type === "sticker") {
            texto = "[sticker]";
            adjunto = { tipo: "sticker", media: m.sticker };
          } else if (m.type === "video") {
            texto = m.video?.caption ? `[video] ${m.video.caption}` : "[video]";
            adjunto = { tipo: "video", media: m.video };
          } else {
            continue; // tipos no soportados aún (ubicación, contactos, etc.)
          }

          await addInbound({
            waId: m.id,
            from: m.from,
            nombre: nombrePorWaId.get(m.from) || undefined,
            texto,
            ts,
            tenant: tenantActivo,
            media:
              adjunto && adjunto.media?.id
                ? {
                    id: adjunto.media.id,
                    tipo: adjunto.tipo,
                    mime: adjunto.media.mime_type,
                    filename: adjunto.media.filename,
                  }
                : undefined,
          });

          if (adjunto) {
            await addAdjunto({
              from: m.from,
              tipo: adjunto.tipo,
              mediaId: adjunto.media?.id,
              mime: adjunto.media?.mime_type,
              filename: adjunto.media?.filename,
              caption: adjunto.media?.caption,
              ts,
            });
          }

          // Solo el TEXTO dispara a la IA. Imágenes, PDF, audios y stickers los
          // atiende un humano (la IA no puede verlos ni escucharlos).
          if (m.type === "text") {
            entrantes.push({ from: m.from, wamid: m.id });
          }
        }
      }
    }
  } catch {
    // No reventamos: respondemos 200 igual para que Meta no reintente en bucle.
  }

  // Modo IA: respondemos automáticamente DESPUÉS de devolver 200 a Meta.
  if (entrantes.length > 0) {
    after(async () => {
      await Promise.all(
        entrantes.map((t) =>
          programarRespuestaIA({ from: t.from, triggerWamid: t.wamid, tenant: tenantActivo }),
        ),
      );
    });
  }

  return new Response("OK", { status: 200 });
}
