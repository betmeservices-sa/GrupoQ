import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe } from "@/lib/meta-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/connections: páginas conectadas del tenant logueado, SIN
// tokens (esto lo consume el navegador; los tokens nunca salen del servidor).
export async function GET(req: Request) {
  const conexiones = await conexionesDe(tenantFromRequest(req));
  return NextResponse.json({
    ok: true,
    conexiones: conexiones.map((c) => ({
      pageId: c.pageId,
      nombre: c.pageName,
      instagram: Boolean(c.igId),
    })),
  });
}
