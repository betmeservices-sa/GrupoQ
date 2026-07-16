import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { statsReales } from "@/lib/meta-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/stats: estadísticas reales de las cuentas conectadas del
// tenant logueado (cookie ccg_tenant). demo:true = sin conexión de Meta; la
// UI cae al seed del tenant.
export async function GET(req: Request) {
  try {
    const stats = await statsReales(tenantFromRequest(req));
    if (!stats) return NextResponse.json({ ok: true, demo: true, stats: [] });
    return NextResponse.json({ ok: true, demo: false, stats });
  } catch (e) {
    console.error("[meta-stats] error:", e);
    return NextResponse.json({ ok: true, demo: true, stats: [] });
  }
}
