// Reservar a mano desde el panel (una llamada, alguien que llegó a recepción,
// una reserva que entró por otro lado).
//
// GET  ?sede=a&llegada=AAAA-MM-DD&salida=AAAA-MM-DD&adultos=2&ninos=0
//      → las habitaciones libres con su tarifa (Cloudbeds si la sede está en vivo)
// POST { sede, llegada, salida, adultos, ninos, habitacion, nombre, correo?, telefono?, notas? }
//      → la reserva confirmada de una vez (a Cloudbeds si la escritura está encendida)

import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { quienResponde } from "@/lib/staff-de-sesion";
import { consultarDisponibilidadYali } from "@/lib/yali-agente";
import { reservarManualYali } from "@/lib/yali-prereservas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const p = new URL(req.url).searchParams;
  const r = await consultarDisponibilidadYali(
    {
      llegada: p.get("llegada") ?? undefined,
      salida: p.get("salida") ?? undefined,
      adultos: Number(p.get("adultos")) || 1,
      ninos: Number(p.get("ninos")) || 0,
    },
    p.get("sede") || null,
  );
  return NextResponse.json(r);
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    sede?: string;
    llegada?: string;
    salida?: string;
    adultos?: number;
    ninos?: number;
    habitacion?: string;
    nombre?: string;
    correo?: string;
    telefono?: string;
    notas?: string;
    clave?: string;
  };
  const quien = await quienResponde(req, tenant);
  try {
    const r = await reservarManualYali(tenant, body, body.sede ?? null, quien, body.clave ?? null);
    return NextResponse.json(r);
  } catch (e) {
    console.error("yali/reservas POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo tomar la reserva." });
  }
}
