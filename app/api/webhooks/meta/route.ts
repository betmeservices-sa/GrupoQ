import crypto from "node:crypto";
import { addMetaInbound, addMetaOutbound, type MetaCanal } from "@/lib/meta-messages-store";
import { esRespuestaAComentario } from "@/lib/respuesta-a-comentario";
import { textoDelMensaje } from "@/lib/meta-texto-mensaje";
import { guardarEventoMeta } from "@/lib/meta-webhook-log";
import { conexionPorActivo } from "@/lib/meta-store";
import { nombreDelRemitente } from "@/lib/meta-perfil";

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
    /**
     * A qué está contestando.
     *
     * Cuando alguien responde una historia, Meta manda el texto normal y
     * aparte este bloque con la historia. Sin leerlo, en la bandeja aparecía
     * "cuánto vale?" suelto y sin contexto: quien lo atiende no tenía forma de
     * saber que hablaba de la historia de ayer.
     */
    reply_to?: { story?: { url?: string; id?: string }; mid?: string };
  };
}

interface MetaEntry {
  id?: string; // object=page: page id | object=instagram: ig business id
  messaging?: MetaMessagingEvent[];
  /**
   * Lo mismo que `messaging`, pero cuando el hilo lo tiene agarrado otra app.
   *
   * ASI FUNCIONA META Y NO ES OBVIO. Una conversación tiene un dueño a la vez.
   * Mientras nadie la toca, es nuestra y los mensajes llegan en `messaging`.
   * Pero apenas alguien del hotel contesta desde la app de Meta, esa app se
   * queda con el hilo, y a nosotros los mensajes siguientes nos llegan acá, en
   * `standby`, que es la fila de los que están mirando sin poder contestar.
   *
   * Leer solo `messaging` era, entonces, recibir SOLO las conversaciones que
   * nadie más atendió. Justo las que ya estaban atendiendo desde el celular
   * desaparecían del panel a mitad de camino, que es lo que se veía: el
   * mensaje del cliente en el teléfono, y en el panel nada.
   */
  standby?: MetaMessagingEvent[];
}

// 2) Recepción: Meta hace POST con los mensajes entrantes.
export async function POST(req: Request) {
  const raw = await req.text();

  // Valida la firma con el App Secret. Sin secret (seam FAKE / prueba local)
  // se acepta con un aviso en el log.
  // Dos secretos posibles: los avisos de una cuenta con login de Instagram
  // vienen firmados con el secret de Instagram, no con el de la app.
  const secretos = [process.env.META_APP_SECRET, process.env.IG_APP_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (secretos.length) {
    const firma = req.headers.get("x-hub-signature-256");
    if (!secretos.some((s) => firmaValida(raw, firma, s))) {
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

  // Queda anotado SIEMPRE, aunque no haya nada que guardar.
  //
  // Sin esto no hay forma de distinguir "Meta no nos avisa" de "nos avisa y lo
  // estamos tirando", y son dos problemas con arreglos opuestos. Pasó con los
  // mensajes de Instagram: se veian en el celular, no en el panel, y la unica
  // forma de saber de que lado estaba el hueco fue mirar si el aviso llegaba.
  console.log(
    `[meta-webhook] llego object=${body.object ?? "?"} entradas=${body.entry?.length ?? 0}`,
  );
  // El aviso ENTERO, tal cual vino. Meta no documenta bien la forma de cada
  // cosa (una respuesta a historia de Facebook no viene igual que una de
  // Instagram) y sin ver el crudo se adivina. Recortado para no reventar el
  // log; lo que importa cabe.
  console.log(`[meta-webhook-crudo] ${raw.slice(0, 3500)}`);
  // Y en la base, entero. Se espera a que termine: en Vercel lo que queda
  // pendiente cuando la respuesta ya salio puede no correr nunca.
  await guardarEventoMeta(body.object, payload);

  if (body.object !== "page" && body.object !== "instagram") {
    // Otros objetos (permissions, etc.): 200 para que Meta no reintente.
    return new Response("IGNORED", { status: 200 });
  }
  const canal: MetaCanal = body.object === "instagram" ? "instagram" : "facebook";

  try {
    for (const entry of body.entry ?? []) {
      const activoId = String(entry.id ?? "");
      // Los dos, y en el mismo saco: para la bandeja da igual quién tenga
      // agarrado el hilo, el mensaje del huésped hay que verlo igual.
      const eventos = [...(entry.messaging ?? []), ...(entry.standby ?? [])];
      if (entry.standby?.length) {
        console.log(`[meta-webhook] ${entry.standby.length} en standby (el hilo lo tiene otra app)`);
      }

      for (const ev of eventos) {
        const msg = ev.message;
        if (!msg) continue;

        // Echo = lo que salio DESDE la pagina. Puede ser nuestro (ya lo
        // guardamos al enviar, y el dedup por mid lo descarta) o puede ser una
        // persona contestando desde la bandeja de Facebook o desde el celular.
        //
        // Ese segundo caso hay que guardarlo: si no, el panel muestra la
        // pregunta del huesped y nunca la respuesta, el hilo parece abandonado
        // y alguien lo contesta dos veces.
        //
        // En un echo los papeles se invierten: sender es la pagina y recipient
        // es la persona, asi que la conversacion se identifica por recipient.
        const esEco = Boolean(msg.is_echo);
        const senderId = esEco ? ev.recipient?.id : ev.sender?.id;
        if (!senderId) continue;

        // Enrutar: el id del entry (page id o ig id) o, en su defecto, el otro
        // extremo del evento → tenant dueño.
        const otroExtremo = esEco ? ev.sender?.id : ev.recipient?.id;
        const cx =
          (await conexionPorActivo(activoId)) ??
          (otroExtremo ? await conexionPorActivo(otroExtremo) : null);
        if (!cx) {
          console.warn(`[meta-webhook] sin conexión para activo ${activoId} (${canal}), se ignora`);
          continue;
        }

        // Qué se guarda: texto, marca de adjunto, o marca de historia.
        const texto = textoDelMensaje(msg);
        if (!texto) continue;
        // Contestar un comentario en privado deja una nota de Meta en el hilo,
        // que no la escribió nadie. Eso es de Comentarios, no de la bandeja.
        if (esRespuestaAComentario(texto)) continue;

        const ts = ev.timestamp
          ? new Date(Number(ev.timestamp)).toISOString()
          : new Date().toISOString();

        // Meta no manda el nombre en el evento, solo el id. Se pide aparte con
        // el token de la pagina; si no viene, la bandeja cae al canal mas el
        // final del id, que es lo que hacia antes.
        const senderName =
          (await nombreDelRemitente(senderId, canal, cx.pageToken, Date.now(), cx.pageId, cx.igToken)) ??
          undefined;

        const guardar = esEco ? addMetaOutbound : addMetaInbound;
        await guardar({
          mid: msg.mid ?? `${canal}-${senderId}-${ev.timestamp ?? Date.now()}`,
          senderName,
          tenant: cx.tenant,
          canal,
          // Guardamos SIEMPRE el page_id de la conexión: Instagram también se
          // responde por el endpoint de mensajes de la página.
          pageId: cx.pageId,
          senderId,
          texto,
          ts,
          // La historia que contestaron, para poder mostrarla al lado del
          // rótulo. Meta solo la manda en ese caso.
          historiaUrl: msg.reply_to?.story?.url,
        });
      }
    }
  } catch (e) {
    // No reventamos: respondemos 200 igual para que Meta no reintente en bucle.
    console.error("[meta-webhook] error procesando payload:", e);
  }

  return new Response("OK", { status: 200 });
}
