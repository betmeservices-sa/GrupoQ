import { resumenConsumo } from "@/lib/tokens-store";
import { tenantFromRequest } from "@/lib/tenants/server";
import { modeloActivo } from "@/lib/ai";
import { PRECIOS_POR_MILLON, tarifaDe } from "@/lib/tokens-precios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Consumo de la IA del cliente que tiene la sesión (cookie firmada). Cada
// dashboard ve SOLO lo suyo, igual que la bandeja.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const resumen = await resumenConsumo(tenant);
  const modelo = modeloActivo();
  return Response.json({
    ...resumen,
    // Tarifa vigente del modelo con el que responde HOY el agente. Los montos
    // del resumen NO salen de aquí: cada fila guardó su modelo y su costo.
    modeloActual: modelo,
    tarifaActual: tarifaDe(modelo),
    tarifas: PRECIOS_POR_MILLON,
  });
}
