import { NextResponse } from "next/server";
import { clearHistory } from "@/lib/wa-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Borra el historial de WhatsApp del cliente que pide (para reiniciar el demo).
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  await clearHistory(tenant);
  return NextResponse.json({ ok: true, tenant });
}
