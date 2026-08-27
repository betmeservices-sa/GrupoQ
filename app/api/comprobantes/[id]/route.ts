// Sirve un comprobante guardado, para VERLO (inline), no para descargarlo.

import { tenantFromRequest } from "@/lib/tenants/server";
import { leerComprobante } from "@/lib/comprobantes-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = tenantFromRequest(req);
  const c = await leerComprobante(tenant, id);
  if (!c) return new Response("No existe", { status: 404 });
  return new Response(new Uint8Array(c.bytes), {
    headers: {
      "Content-Type": c.mime,
      "Content-Length": String(c.bytes.byteLength),
      "Content-Disposition": `inline; filename="${c.nombre}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
