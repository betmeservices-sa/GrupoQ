import { NextResponse } from "next/server";
import { cargarPanelYali } from "@/lib/yali-pms";
import { borrarReservasYali } from "@/lib/yali-reservas";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ocupación, ingresos y llegadas de las tres sedes de Yali Hospitality.
// Solo responde al tenant del cliente: el middleware ya validó la firma de la
// sesión y aquí se comprueba que sea la del cliente correcto, para que ningún
// otro dashboard vea su operación.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  const dias = Math.min(21, Math.max(7, Number(new URL(req.url).searchParams.get("dias")) || 14));
  try {
    return NextResponse.json({ ok: true, panel: cargarPanelYali(dias) });
  } catch (e) {
    console.error("yali/panel:", e);
    return NextResponse.json({ ok: false, error: "No se pudo armar el panel en este momento." });
  }
}

// Vacía las reservas que cerró el agente en el demo. El libro de ocupación no
// se toca: es determinista y se vuelve a generar igual.
export async function DELETE(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  borrarReservasYali();
  return NextResponse.json({ ok: true });
}
