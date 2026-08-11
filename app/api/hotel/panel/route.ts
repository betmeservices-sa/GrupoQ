import { NextResponse } from "next/server";
import { hayPms } from "@/lib/cloudbeds";
import { cargarPanel } from "@/lib/hotel-panel";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ocupación, tarifas y reservas del hotel, leídas del PMS. Todo pasa por el
// servidor: la API key nunca sale de aquí (por eso el panel del dashboard pide
// estos datos en vez de hablar con el PMS desde el navegador).
//
// Solo responde al tenant del hotel: el middleware ya validó la firma de la
// sesión, y aquí se comprueba que sea la del cliente correcto.
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

  const dias = Math.min(21, Math.max(7, Number(new URL(req.url).searchParams.get("dias")) || 14));
  try {
    const panel = await cargarPanel(dias);
    return NextResponse.json({ ok: true, panel });
  } catch (e) {
    console.error("hotel/panel:", e);
    return NextResponse.json({
      ok: false,
      error: "No se pudo leer la ocupación en este momento.",
    });
  }
}
