import { getSince, mensajesAnteriores, ultimoPorConversacion } from "@/lib/wa-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const dynamic = "force-dynamic";

// La bandeja de WhatsApp, en tres modos según lo que se pida:
//
//   ?resumen=1            el último mensaje de cada conversación y el cursor.
//                         Es lo primero que pide el navegador al abrir: con eso
//                         arma la lista de una, sin releer el historial.
//   ?de=NUMERO[&antes=TS] los mensajes de un hilo, del más nuevo al más viejo,
//                         de a `limite`. Sin `antes` son los últimos; con
//                         `antes` (la fecha del más viejo que ya se tiene) son
//                         los anteriores. Así el hilo crece al subir.
//   ?after=SEQ            lo que llegó después del cursor. Es el sondeo de cada
//                         cuatro segundos, igual que siempre.
//
// Filtra por el tenant del dashboard (cookie ccg_tenant), así cada cliente ve
// solo lo suyo.
const TOPE = 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tenant = tenantFromRequest(req);
  const pedido = Number(url.searchParams.get("limite") ?? "100");
  const limite = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 1), TOPE) : 100;

  if (url.searchParams.get("resumen") === "1") {
    const r = await ultimoPorConversacion(tenant);
    return Response.json({ ultimos: r.ultimos, cursor: r.cursor, sinVista: r.sinVista === true });
  }

  const de = url.searchParams.get("de");
  if (de) {
    const antes = url.searchParams.get("antes");
    const r = await mensajesAnteriores(de, antes || null, Math.min(limite, 200), tenant);
    return Response.json(r);
  }

  const after = Number(url.searchParams.get("after") ?? "0");
  const mensajes = await getSince(Number.isFinite(after) ? after : 0, tenant, limite);
  // Una página llena casi siempre significa que queda más. Puede errar por uno
  // (cuando lo que falta es exactamente el tamaño de la página) y el costo de
  // errar es un pedido de más que vuelve vacío.
  return Response.json({ mensajes, hayMas: mensajes.length >= limite });
}
