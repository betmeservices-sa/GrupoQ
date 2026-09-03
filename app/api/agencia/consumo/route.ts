// Consumo de la IA de UN cliente en un periodo, para el tablero de la agencia.
//
// GET ?cliente=<tenant>&periodo=hoy|ayer|semana|semana_pasada|7d|mes|mes_pasado|30d|rango&desde=AAAA-MM-DD&hasta=AAAA-MM-DD
//
// Solo para la cuenta de la agencia. Lee todas las filas del cliente y las
// agrega en hora de El Salvador (ver lib/agencia-consumo).

import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { TENANTS } from "@/lib/tenants";
import type { TenantId } from "@/lib/tenants/types";
import { detalleConsumo } from "@/lib/tokens-store";
import { esPeriodo, rangoDePeriodo, reporteConsumo } from "@/lib/agencia-consumo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Alcanza para ~2 meses del cliente más activo; si un día se queda corto, el
// periodo más viejo sale incompleto, no roto.
const TOPE_FILAS = 5000;

export async function GET(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  if (!sesion.todos && sesion.tenant !== "miagentia") {
    return NextResponse.json({ ok: false, error: "Solo para la agencia" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams;
  const cliente = q.get("cliente") ?? "";
  if (!(cliente in TENANTS)) {
    return NextResponse.json({ ok: false, error: "Cliente desconocido" }, { status: 400 });
  }
  const periodo = q.get("periodo");
  const rango = rangoDePeriodo(esPeriodo(periodo) ? periodo : "7d", new Date(), q.get("desde"), q.get("hasta"));

  const filas = await detalleConsumo(cliente, TOPE_FILAS).catch((e) => {
    console.error("[agencia/consumo]", cliente, e instanceof Error ? e.message : e);
    return [];
  });
  const reporte = reporteConsumo(filas, rango);

  return NextResponse.json({
    ok: true,
    cliente: { id: cliente, nombre: TENANTS[cliente as TenantId].brand.nombreCorto },
    filasLeidas: filas.length,
    ...reporte,
  });
}
