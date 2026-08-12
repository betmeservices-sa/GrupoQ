import { NextResponse } from "next/server";
import { hayPms } from "@/lib/cloudbeds";
import { cargarCapacidades } from "@/lib/hotel-capacidades";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Medidas de la cuenta real del hotel para la sección de lo que todavía no está
// encendido. Lectura, como todo lo demás.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "hotel") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  if (!hayPms()) {
    return NextResponse.json({ ok: false, error: "Sin conexión al sistema del hotel." });
  }
  try {
    return NextResponse.json({ ok: true, capacidades: await cargarCapacidades() });
  } catch (e) {
    console.error("hotel/capacidades:", e);
    return NextResponse.json({ ok: false, error: "No se pudo consultar el sistema del hotel." });
  }
}
