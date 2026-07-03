import { NextResponse } from "next/server";
import { getWaTenant, setWaTenant } from "@/lib/wa-routing";
import { isTenantId } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A qué cliente entra el número de WhatsApp en vivo (lo lee el switch).
export async function GET() {
  return NextResponse.json({ tenant: await getWaTenant() });
}

// Cambia el enrutamiento del número al cliente indicado. Los mensajes NUEVOS
// entran a ese dashboard y la IA responde con su guion.
export async function POST(req: Request) {
  let body: { tenant?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  if (!body.tenant || !isTenantId(body.tenant)) {
    return NextResponse.json({ ok: false, error: "Cliente inválido." }, { status: 400 });
  }
  await setWaTenant(body.tenant);
  return NextResponse.json({ ok: true, tenant: body.tenant });
}
