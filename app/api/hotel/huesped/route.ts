import { NextResponse } from "next/server";
import { hayPms } from "@/lib/cloudbeds";
import { cargarFichaHuesped } from "@/lib/hotel-huesped";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lo que el sistema del hotel sabe del contacto que está abierto en Contactos:
// sus estadías, las notas del hotel, el canal por el que reservó y el saldo.
// Solo lectura y solo para el tenant del hotel.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "hotel") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  if (!hayPms()) {
    return NextResponse.json({ ok: true, resultado: { estado: "sin_sistema" } });
  }

  const q = new URL(req.url).searchParams;
  try {
    const resultado = await cargarFichaHuesped({
      telefono: q.get("telefono") ?? undefined,
      correo: q.get("correo") ?? undefined,
      nombre: q.get("nombre") ?? undefined,
    });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    console.error("hotel/huesped:", e);
    return NextResponse.json({
      ok: false,
      error: "No se pudo consultar el sistema del hotel en este momento.",
    });
  }
}
