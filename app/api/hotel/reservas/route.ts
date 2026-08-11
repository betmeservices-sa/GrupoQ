import { NextResponse } from "next/server";
import { reservarHabitacionSimulada } from "@/lib/hotel-agente";
import { borrarReservasSimuladas } from "@/lib/hotel-reservas";
import { invalidarCachePanel } from "@/lib/hotel-panel";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reservas SIMULADAS del demo. Corren exactamente el mismo camino que usa el
// agente de IA cuando el huésped cierra por WhatsApp: se valida contra la
// disponibilidad REAL del PMS y se guarda en el demo, sin escribir en el PMS.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "hotel") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  let body: {
    nombre?: string;
    habitacion?: string;
    llegada?: string;
    salida?: string;
    adultos?: number;
    ninos?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const r = await reservarHabitacionSimulada({ ...body, origen: "panel" });
  return NextResponse.json(r);
}

// Limpia las reservas simuladas para volver a mostrar el demo desde cero.
export async function DELETE(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "hotel") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  borrarReservasSimuladas();
  invalidarCachePanel();
  return NextResponse.json({ ok: true });
}
