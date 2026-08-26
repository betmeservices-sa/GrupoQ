import { getSince } from "@/lib/wa-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const dynamic = "force-dynamic";

// Lo que sondea el cliente: mensajes con seq mayor a su cursor. Filtra por el
// tenant del dashboard (cookie ccg_tenant), así cada cliente ve solo lo suyo.
//
// `limite` lo manda el navegador: pide páginas grandes mientras se pone al día
// con el historial y pequeñas cuando ya solo espera lo nuevo. Se devuelve
// `hayMas` para que sepa si tiene que volver a pedir enseguida en vez de
// esperar el próximo tick, que es lo que hacía que seis meses de conversaciones
// tardaran diez minutos en terminar de aparecer.
const TOPE = 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const after = Number(url.searchParams.get("after") ?? "0");
  const pedido = Number(url.searchParams.get("limite") ?? "100");
  const limite = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 1), TOPE) : 100;

  const tenant = tenantFromRequest(req);
  const mensajes = await getSince(Number.isFinite(after) ? after : 0, tenant, limite);

  // Una página llena casi siempre significa que queda más. Puede errar por uno
  // (cuando lo que falta es exactamente el tamaño de la página) y el costo de
  // errar es un pedido de más que vuelve vacío.
  return Response.json({ mensajes, hayMas: mensajes.length >= limite });
}
