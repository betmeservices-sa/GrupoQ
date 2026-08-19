import { NextResponse } from "next/server";
import { TENANTS } from "@/lib/tenants";
import { tenantFromRequest } from "@/lib/tenants/server";
import { enlacesDe } from "@/lib/enlaces";
import { clicsEnMemoria, resumenClics } from "@/lib/clics-store";
import { conversacionesPorOrigen } from "@/lib/sucursal-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// De dónde llegan los que escriben: un renglón por link rastreable, con los
// clics que recibió y cuántos de esos terminaron en conversación. Los dos
// números vienen de lados distintos a propósito: el clic lo registra nuestro
// redirect (/ir/<codigo>) y la conversación la marca el webhook al reconocer el
// mensaje. Ver lib/enlaces.ts.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const dias = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("dias")) || 30));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();

  try {
    const [clics, conversaciones] = await Promise.all([
      resumenClics(tenant, desde),
      conversacionesPorOrigen(tenant),
    ]);
    const porCodigo = new Map(clics.map((c) => [c.codigo, c]));

    const enlaces = enlacesDe(TENANTS.yaly.sucursales).map((e) => ({
      codigo: e.codigo,
      sedeId: e.sedeId,
      canal: e.canal,
      frase: e.frase,
      utm: e.utm,
      clics: porCodigo.get(e.codigo)?.clics ?? 0,
      ultimoClic: porCodigo.get(e.codigo)?.ultimo ?? null,
      campanas: porCodigo.get(e.codigo)?.campanas ?? [],
      conversaciones: conversaciones[e.codigo] ?? 0,
    }));

    return NextResponse.json({ ok: true, dias, enlaces, enMemoria: clicsEnMemoria() });
  } catch (e) {
    console.error("yali/origenes:", e);
    return NextResponse.json({ ok: false, error: "No se pudieron leer los orígenes." });
  }
}
