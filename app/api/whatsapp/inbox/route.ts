import { getSince } from "@/lib/wa-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const dynamic = "force-dynamic";

// Lo que sondea el cliente: mensajes con seq mayor a su cursor. Filtra por el
// tenant del dashboard (cookie ccg_tenant), así cada cliente ve solo lo suyo.
export async function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");
  const tenant = tenantFromRequest(req);
  const mensajes = await getSince(Number.isFinite(after) ? after : 0, tenant);
  return Response.json({ mensajes });
}
