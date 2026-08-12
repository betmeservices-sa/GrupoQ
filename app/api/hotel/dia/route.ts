import { NextResponse } from "next/server";
import { hayPms } from "@/lib/cloudbeds";
import { cargarDia } from "@/lib/hotel-dia";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El día de recepción leído del sistema del hotel. Todo pasa por el servidor: la
// llave nunca sale de aquí. Solo responde al tenant del hotel.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "hotel") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  if (!hayPms()) {
    return NextResponse.json({
      ok: false,
      error:
        "Sin conexión al sistema del hotel. Configura CLOUDBEDS_API_KEY y CLOUDBEDS_PROPERTY_ID.",
    });
  }

  const ventana = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get("ventana")) || 14));
  try {
    const panel = await cargarDia(ventana);
    return NextResponse.json({ ok: true, panel });
  } catch (e) {
    console.error("hotel/dia:", e);
    return NextResponse.json({ ok: false, error: "No se pudo leer el día en este momento." });
  }
}
