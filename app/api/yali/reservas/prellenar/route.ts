// Prellenar el formulario de Nueva reserva con lo que dice un chat.
// POST { clave } → { sede, llegada, salida, adultos, ninos, habitacion, nombre, correo, telefono, notas }
// No guarda nada: es para que la persona revise y confirme.

import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { prellenarDesdeChat } from "@/lib/yali-detectar-reserva";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { clave?: string };
  const clave = (body.clave ?? "").trim();
  if (!clave) return NextResponse.json({ ok: false, error: "Falta el chat." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, datos: await prellenarDesdeChat(tenant, clave) });
  } catch (e) {
    console.error("yali/reservas/prellenar:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No se pudo leer el chat." });
  }
}
