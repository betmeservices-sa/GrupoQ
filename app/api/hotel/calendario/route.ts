import { NextResponse } from "next/server";
import { hayPms } from "@/lib/cloudbeds";
import { cargarMes } from "@/lib/hotel-calendario";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Disponibilidad noche por noche de un mes. Lectura del sistema del hotel,
// siempre del lado servidor: la llave no sale de aquí.
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

  const q = new URL(req.url).searchParams;
  try {
    const mes = await cargarMes({
      anio: Number(q.get("anio")) || undefined,
      mes: Number(q.get("mes")) || undefined,
      huespedes: Number(q.get("huespedes")) || 1,
    });
    return NextResponse.json({ ok: true, mes });
  } catch (e) {
    console.error("hotel/calendario:", e);
    return NextResponse.json({
      ok: false,
      error: "No se pudo leer la disponibilidad del mes en este momento.",
    });
  }
}
