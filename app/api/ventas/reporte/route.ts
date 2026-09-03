// La reportería del gerente de ventas.
//
// GET ?periodo=hoy|ayer|semana|semana_pasada|7d|mes|mes_pasado|30d|rango&desde=&hasta=
//
// Devuelve dos cosas distintas a propósito: la FOTO de ahora (cuántos hay en
// cada etapa, qué documento debe cada quien, qué se venció) y el MOVIMIENTO del
// periodo (cuántos entraron, cuántos completaron, cuánto se cerró). Mezclarlas
// es lo que hace que un tablero de ventas mienta.

import { NextResponse, after } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { esPeriodo, rangoDePeriodo } from "@/lib/periodos";
import { gerenteDe, vendedoresDe } from "@/lib/ventas-equipo";
import { reporteVentas } from "@/lib/ventas-pipeline";
import { listarSolicitudes } from "@/lib/ventas-store";
import { sembrarVentasSiVacio } from "@/lib/ventas-seed";
import { revisarPlazos } from "@/lib/ventas-plazos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const q = new URL(req.url).searchParams;
  const periodo = q.get("periodo");
  const rango = rangoDePeriodo(esPeriodo(periodo) ? periodo : "7d", new Date(), q.get("desde"), q.get("hasta"));

  try {
    await sembrarVentasSiVacio(tenant);
    const solicitudes = await listarSolicitudes(tenant);
    const reporte = reporteVentas(solicitudes, vendedoresDe(tenant), rango);

    // Los avisos al gerente no dependen de que el cron haya corrido: abrir el
    // reporte también los dispara, en segundo plano y una sola vez por caso.
    after(async () => {
      try {
        await revisarPlazos(tenant);
      } catch (e) {
        console.error("[ventas-plazos]", tenant, e instanceof Error ? e.message : e);
      }
    });

    return NextResponse.json({ ok: true, gerente: gerenteDe(tenant), ...reporte });
  } catch (e) {
    console.error("ventas reporte:", e);
    return NextResponse.json({ ok: false, error: "No se pudo armar el reporte." }, { status: 500 });
  }
}
