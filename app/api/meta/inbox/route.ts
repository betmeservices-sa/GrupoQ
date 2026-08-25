import { getMetaSince, metaEnMemoria } from "@/lib/meta-messages-store";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe } from "@/lib/meta-store";

export const dynamic = "force-dynamic";

// Lo que sondea el cliente: mensajes de Messenger/Instagram con seq mayor a su
// cursor. Filtra por el tenant del dashboard (cookie ccg_tenant), así cada
// cliente ve solo lo suyo. Mismo contrato que /api/whatsapp/inbox.
export async function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");
  const tenant = tenantFromRequest(req);
  const mensajes = await getMetaSince(Number.isFinite(after) ? after : 0, tenant);

  // El nombre de cada pagina, para que la bandeja pueda decir por cual entro
  // cada conversacion. El mensaje solo trae el id, que no le dice nada a nadie.
  const paginas: Record<string, string> = {};
  for (const c of await conexionesDe(tenant)) paginas[c.pageId] = c.pageName;
  // enMemoria = falta la tabla meta_messages y los mensajes se estan
  // guardando en la memoria del proceso, que en Vercel se borra sola.
  return Response.json({ mensajes, paginas, enMemoria: metaEnMemoria() });
}
