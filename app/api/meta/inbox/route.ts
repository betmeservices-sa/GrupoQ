// `after` de Next, con otro nombre: acá `after` ya es el cursor del sondeo.
import { after as alTerminar } from "next/server";
import {
  getMetaSince,
  mensajesAnteriores,
  metaEnMemoria,
  ultimoPorConversacion,
  type MetaCanal,
} from "@/lib/meta-messages-store";
import { tenantFromRequest } from "@/lib/tenants/server";
import { tocarSesion } from "@/lib/accesos-sesion";
import { conexionesDe } from "@/lib/meta-store";
import { sincronizarMessenger } from "@/lib/meta-sondeo-messenger";
import { sincronizarInstagram } from "@/lib/meta-sondeo-instagram";

export const dynamic = "force-dynamic";
// El sondeo de Messenger corre despues de la respuesta y puede disparar a la
// IA (silencio + Claude): hasta 60 s.
export const maxDuration = 60;

// Lo que sondea el cliente: mensajes de Messenger/Instagram con seq mayor a su
// cursor. Filtra por el tenant del dashboard (cookie ccg_tenant), así cada
// cliente ve solo lo suyo. Mismo contrato que /api/whatsapp/inbox.
const TOPE = 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") ?? "0");
  const pedido = Number(url.searchParams.get("limite") ?? "100");
  const limite = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 1), TOPE) : 100;

  const tenant = tenantFromRequest(req);

  // Mismos tres modos que /api/whatsapp/inbox: resumen, hilo, sondeo.
  if (url.searchParams.get("resumen") === "1") {
    const r = await ultimoPorConversacion(tenant);
    const paginas: Record<string, string> = {};
    for (const c of await conexionesDe(tenant)) paginas[c.pageId] = c.pageName;
    return Response.json({
      ultimos: r.ultimos,
      cursor: r.cursor,
      paginas,
      sinVista: r.sinVista === true,
      enMemoria: metaEnMemoria(),
    });
  }

  const senderId = url.searchParams.get("de");
  const pageId = url.searchParams.get("pagina");
  const canal = url.searchParams.get("canal");
  if (senderId && pageId && (canal === "facebook" || canal === "instagram")) {
    const antes = url.searchParams.get("antes");
    const r = await mensajesAnteriores(
      { canal: canal as MetaCanal, pageId, senderId },
      antes || null,
      Math.min(limite, 200),
      tenant,
    );
    return Response.json(r);
  }

  // Después de contestar, ver si Meta tiene mensajes de Messenger que el
  // webhook no entregó (sin App Review no avisa de gente sin rol en la app).
  // Va después de la respuesta para no frenar este tick: lo que encuentre sale
  // en el que sigue, cuatro segundos más tarde. Se frena solo a una vuelta
  // cada 30 s.
  alTerminar(() => Promise.all([sincronizarMessenger(tenant), sincronizarInstagram(tenant), tocarSesion(req)]).then(() => {}));

  const mensajes = await getMetaSince(Number.isFinite(after) ? after : 0, tenant, limite);

  // El nombre de cada pagina, para que la bandeja pueda decir por cual entro
  // cada conversacion. El mensaje solo trae el id, que no le dice nada a nadie.
  const paginas: Record<string, string> = {};
  for (const c of await conexionesDe(tenant)) paginas[c.pageId] = c.pageName;
  // enMemoria = falta la tabla meta_messages y los mensajes se estan
  // guardando en la memoria del proceso, que en Vercel se borra sola.
  return Response.json({
    mensajes,
    paginas,
    // Página llena = casi seguro queda más. Con esto el navegador encadena en
    // vez de esperar el próximo tick.
    hayMas: mensajes.length >= limite,
    enMemoria: metaEnMemoria(),
  });
}
