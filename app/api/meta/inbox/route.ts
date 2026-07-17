import { getMetaSince } from "@/lib/meta-messages-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const dynamic = "force-dynamic";

// Lo que sondea el cliente: mensajes de Messenger/Instagram con seq mayor a su
// cursor. Filtra por el tenant del dashboard (cookie ccg_tenant), así cada
// cliente ve solo lo suyo. Mismo contrato que /api/whatsapp/inbox.
export async function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");
  const tenant = tenantFromRequest(req);
  const mensajes = await getMetaSince(Number.isFinite(after) ? after : 0, tenant);
  return Response.json({ mensajes });
}
