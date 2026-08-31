import crypto from "node:crypto";
import { after } from "next/server";
import { addInbound } from "@/lib/wa-store";
import { addAdjunto } from "@/lib/contacts-store";
import { programarRespuestaIA } from "@/lib/ai-reply";
import { getWaTenant } from "@/lib/wa-routing";
import { conexionPorPhoneNumberId } from "@/lib/wa-conexiones-store";
import { phoneNumberIdDe } from "@/lib/wa-webhook-numero";
import { isTenantId } from "@/lib/tenants";
import { TENANTS } from "@/lib/tenants";
import { origenDelContacto, type ReferralWa } from "@/lib/origen-sede";
import { getEstadoSucursal, guardarSucursal } from "@/lib/sucursal-store";
import { pasarAPersona } from "@/lib/pasar-a-persona";
import { registrarConsumo } from "@/lib/tokens-store";
import { USO_CERO } from "@/lib/tokens-precios";

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
  // Solo llega cuando el clic vino de un anuncio de click to WhatsApp: trae el
  // id del anuncio, su titular y su cuerpo. Con eso se sabe de qué hotel viene
  // sin preguntárselo (ver lib/origen-sede.ts).
  referral?: ReferralWa;
}

// 2) Recepción: Meta hace POST con los mensajes entrantes.
export async function POST(req: Request) {
  const raw = await req.text();

  // Valida la firma contra las apps que pueden mandar acá. Son dos: la app de
  // la demo (WHATSAPP_APP_SECRET, el número de siempre) y la app MiAgentIA
  // (META_APP_SECRET), que es por donde entran los números que cada cliente
  // conecta desde su panel. Con una sola, los mensajes de la otra volvían 401
  // sin que nadie se enterara. Sin ningún secreto configurado (prueba local)
  // se acepta todo.
  const secretos = [process.env.WHATSAPP_APP_SECRET, process.env.META_APP_SECRET].filter(
    (x): x is string => Boolean(x),
  );
  if (secretos.length > 0) {
    const firma = req.headers.get("x-hub-signature-256");
    if (!secretos.some((sec) => firmaValida(raw, firma, sec))) {
      return new Response("Invalid signature", { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // De qué cliente es el número al que llegó esto. Si es un número que un
  // cliente conectó desde su panel, es de ese cliente. Si no (el número de la
  // demo), decide el interruptor global, como siempre.
  const numeroDestino = phoneNumberIdDe(payload);
  const conexion = numeroDestino ? await conexionPorPhoneNumberId(numeroDestino) : null;
  const tenantActivo =
    conexion && isTenantId(conexion.tenant) ? conexion.tenant : await getWaTenant();
  // Si el agente de este cliente ve fotos, una imagen también dispara la IA
  // (se la baja y se la manda al modelo en lib/ai-reply). Si no, la imagen se
  // guarda y la atiende una persona, como siempre.
  const veImagenes = TENANTS[tenantActivo].ai.imagenes === true;

  let entrantes: Array<{ from: string; wamid: string }> = [];
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
        // Los números que mandaron una nota de voz en este lote. Se pasan a
        // una persona después de guardar, no en medio del bucle: si el
        // traspaso falla, el mensaje ya quedó guardado igual.
        const audiosParaPersona = new Set<string>();

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
            // UNA NOTA DE VOZ LA ATIENDE UNA PERSONA, SIEMPRE.
            //
            // Antes se pasaba a texto y el agente contestaba sobre esa
            // transcripción. El problema no es que fallara: es que cuando fallaba
            // a medias nadie se enteraba. Una fecha mal entendida, un nombre
            // cambiado, un "no" que se oyó como "dos", y el agente contestaba con
            // total seguridad sobre algo que el huésped no dijo.
            //
            // Ahora el audio queda tal cual, se apaga el agente en ese chat y se
            // le asigna a reservas. La persona lo escucha y contesta.
            audiosParaPersona.add(m.from);
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

          // De dónde viene: si el mensaje trae el referral de un anuncio, o si
          // el texto prellenado del link de la bio nombra un hotel, la sede se
          // guarda ACÁ y el agente ya no la pregunta. Solo la primera vez: si el
          // contacto ya eligió sede, no se le pisa por un anuncio nuevo.
          const sucursalesTenant = TENANTS[tenantActivo].sucursales;
          if (sucursalesTenant && texto) {
            const yaTiene = (await getEstadoSucursal(m.from)).sucursalId;
            if (!yaTiene) {
              const origen = origenDelContacto({ texto, referral: m.referral }, sucursalesTenant);
              if (origen) {
                await guardarSucursal(
                  m.from,
                  tenantActivo,
                  origen.sede.id,
                  origen.sede.nombre,
                  origen.enlace?.codigo ?? null,
                );
              }
            }
          }

          // Qué dispara a la IA: el TEXTO siempre, y la IMAGEN cuando el
          // cliente tiene la visión encendida. PDF, audios y stickers los sigue
          // atendiendo un humano (el agente no puede abrirlos ni escucharlos).
          if (m.type === "text" || (m.type === "image" && veImagenes)) {
            entrantes.push({ from: m.from, wamid: m.id });
          }
        }

        // Las notas de voz, a una persona. Va acá, cuando los mensajes del lote
        // ya se guardaron: si el traspaso falla, el audio igual quedó en el
        // hilo y alguien lo va a ver.
        for (const numero of audiosParaPersona) {
          const r = await pasarAPersona(numero, "audio", "reservas");
          if (!r.ok) console.error("[whatsapp] no se pudo pasar el audio a una persona:", r.error);
          // Y no se le contesta con el agente aunque en el mismo lote haya
          // llegado texto: quien manda un audio y un texto seguidos espera que
          // le respondan las dos cosas juntas, no media.
          entrantes = entrantes.filter((t) => t.from !== numero);
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
