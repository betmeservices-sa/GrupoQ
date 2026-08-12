import { NextResponse } from "next/server";
import { interpretarDictado } from "@/lib/inmobiliaria-ia";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Convierte lo que el agente dictó en campos del formulario. Corre el lector de
// reglas siempre; el modelo solo rellena huecos cuando hay llave con saldo y
// está encendido (INMO_DICTADO_MODELO=1). Ver lib/inmobiliaria-ia.ts.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  let texto = "";
  try {
    const body = (await req.json()) as { texto?: string };
    texto = (body.texto ?? "").slice(0, 4000);
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió el dictado." }, { status: 400 });
  }

  const { extraccion, fuente, aviso } = await interpretarDictado(texto);
  return NextResponse.json({ ok: true, extraccion, fuente, aviso });
}
