import { NextResponse } from "next/server";
import { seedConexionMemoria } from "@/lib/meta-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SOLO PARA DEV: siembra una conexión Meta en el store en MEMORIA (no toca la
// base) para probar el webhook local sin pasar por el OAuth real.
// En producción responde 404. Body: { tenant?, pageId?, igId?, pageToken? }.
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tenant = String(body.tenant ?? "miagentia");
  const pageId = String(body.pageId ?? "111111111111111");
  seedConexionMemoria({
    tenant,
    pageId,
    pageName: String(body.pageName ?? "Página de prueba"),
    pageToken: String(body.pageToken ?? "token-dev"),
    igId: body.igId ? String(body.igId) : null,
    userToken: null,
  });
  return NextResponse.json({ ok: true, tenant, pageId });
}
