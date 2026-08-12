import { NextResponse } from "next/server";
import { buscarPropiedad, cargarCartera } from "@/lib/inmobiliaria-cartera";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La cartera completa, o una ficha suelta con ?id=. Las alertas (publicada sin
// estar disponible, exclusiva vencida) vienen resueltas contra el día de hoy.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const propiedad = buscarPropiedad(id);
    if (!propiedad) {
      return NextResponse.json({ ok: false, error: "Esa propiedad no está en la cartera." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, propiedad });
  }

  return NextResponse.json({ ok: true, cartera: cargarCartera() });
}
