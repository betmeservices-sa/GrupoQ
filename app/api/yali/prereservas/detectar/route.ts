// Sacar la reserva de un chat que atendió una persona.
//
// POST { clave }      → lee ESE chat y deja/actualiza la tarjeta
// GET  ?dias=7        → barre los chats con foto del huésped en el periodo
//                       (los que no tienen tarjeta viva) y detecta en cada uno

import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { chatsConFotoReciente, detectarReservaEnChat } from "@/lib/yali-detectar-reserva";
import { preReservaViva, listarPreReservas } from "@/lib/yali-prereservas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { clave?: string };
  const clave = (body.clave ?? "").trim();
  if (!clave) return NextResponse.json({ ok: false, error: "Falta el chat." }, { status: 400 });
  try {
    return NextResponse.json(await detectarReservaEnChat(tenant, clave));
  } catch (e) {
    console.error("yali/prereservas/detectar:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No se pudo leer el chat." });
  }
}

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const dias = Math.min(30, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 7));
  const claves = await chatsConFotoReciente(tenant, dias);
  const resultados: { clave: string; reserva: string | null; estado?: string; motivo?: string }[] = [];
  for (const clave of claves) {
    // Con tarjeta viva no se toca: la hizo Sofía o ya se detectó.
    if (await preReservaViva(tenant, clave)) {
      resultados.push({ clave, reserva: null, motivo: "ya tiene tarjeta" });
      continue;
    }
    const cerradas = await listarPreReservas(tenant, clave);
    if (cerradas.some((p) => p.estado === "confirmada")) {
      resultados.push({ clave, reserva: cerradas.find((p) => p.estado === "confirmada")!.id, estado: "confirmada", motivo: "ya estaba" });
      continue;
    }
    try {
      const r = await detectarReservaEnChat(tenant, clave);
      resultados.push({ clave, reserva: r.reserva?.id ?? null, estado: r.reserva?.estado, motivo: r.motivo });
    } catch (e) {
      resultados.push({ clave, reserva: null, motivo: e instanceof Error ? e.message : "falló" });
    }
  }
  return NextResponse.json({ ok: true, dias, chats: claves.length, resultados });
}
