// Barrido diario de los plazos del embudo de ventas.
//
// La lógica vive en lib/ventas-plazos (la comparte con la pantalla de
// reportería, que la dispara en segundo plano al abrirse). Acá solo se decide
// a qué clientes se les corre y se cuida la puerta.
//
// Vercel llama con Authorization: Bearer <CRON_SECRET>. Sin eso, 401.

import { NextResponse } from "next/server";
import { TENANTS } from "@/lib/tenants";
import type { TenantId } from "@/lib/tenants/types";
import { vendedoresDe } from "@/lib/ventas-equipo";
import { revisarPlazos } from "@/lib/ventas-plazos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const pedido = new URL(req.url).searchParams.get("tenant");
  const tenants = (pedido ? [pedido as TenantId] : (Object.keys(TENANTS) as TenantId[])).filter(
    (t) => vendedoresDe(t).length > 0,
  );

  const resumen = [];
  for (const tenant of tenants) resumen.push(await revisarPlazos(tenant));
  return NextResponse.json({ ok: true, resumen });
}
