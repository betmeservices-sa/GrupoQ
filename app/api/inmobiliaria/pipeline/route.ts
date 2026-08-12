import { NextResponse } from "next/server";
import { cargarPipeline } from "@/lib/inmobiliaria-pipeline";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Leads del agente inmobiliario, por etapa y por forma de pago. Los días sin
// contacto se calculan contra el día de hoy en El Salvador, así que el tablero
// no envejece entre demos.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, pipeline: cargarPipeline() });
}
