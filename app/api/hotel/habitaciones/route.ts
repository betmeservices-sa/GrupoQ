import { NextResponse } from "next/server";
import { hayPms } from "@/lib/cloudbeds";
import { cargarHabitaciones } from "@/lib/hotel-habitaciones";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado de cada habitación para un rango de fechas. Lectura del sistema del
// hotel, siempre del lado servidor: la llave no sale de aquí.
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
    const vista = await cargarHabitaciones({
      desde: q.get("desde") ?? undefined,
      hasta: q.get("hasta") ?? undefined,
      huespedes: Number(q.get("huespedes")) || 1,
    });
    return NextResponse.json({ ok: true, vista });
  } catch (e) {
    console.error("hotel/habitaciones:", e);
    return NextResponse.json({
      ok: false,
      error: "No se pudo leer el estado de las habitaciones en este momento.",
    });
  }
}
