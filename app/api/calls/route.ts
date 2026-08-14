import { NextResponse } from "next/server";
import { fetchVapiCalls, hayLlaveVapi } from "@/lib/vapi";
import { guardarLlamadas, haySupabase, leerLlamadas } from "@/lib/calls-store";
import { resumirLlamadas } from "@/lib/calls-metrics";
import { tenantFromRequest } from "@/lib/tenants/server";
import { soloDelTenant, veModuloVoz } from "@/lib/tenants/voz";
import type { TenantId } from "@/lib/tenants/types";
import type { CallRecord } from "@/lib/data/types";

export const dynamic = "force-dynamic";

// USD por minuto que cobra el carrier. Vapi no lo incluye (transport llega en 0
// con trunk propio). Si vale 0, la UI oculta el costo real.
function tarifaCarrier(): number {
  const v = Number(process.env.CARRIER_RATE_PER_MINUTE);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Sincroniza contra Vapi y devuelve el estado actual.
 * Si Vapi falla pero hay historial en Supabase, se sirve el historial con un
 * aviso: preferimos datos viejos antes que una pantalla rota.
 */
async function armarRespuesta(tenant: TenantId) {
  const tarifa = tarifaCarrier();
  let calls: CallRecord[] = [];
  // Se separan a proposito: un fallo de la BASE no es un fallo de VAPI, y
  // mezclarlos hace que el usuario persiga el problema equivocado.
  let errorVapi: string | undefined;
  let errorBase: string | undefined;
  let persistido = false;

  // 1) Traer de Vapi. Si falla, seguimos: puede haber historial en la base.
  let frescas: CallRecord[] = [];
  try {
    frescas = await fetchVapiCalls();
    calls = frescas;
  } catch (err) {
    errorVapi = err instanceof Error ? err.message : "Error desconocido";
  }

  // 2) Persistir y leer el historial. Si la base falla (tipico: la migracion
  // todavia no se corrio en ese entorno), NO perdemos lo que ya trajimos de
  // Vapi: mostrar datos frescos sin historial es mejor que una pantalla vacia.
  if (haySupabase()) {
    try {
      if (frescas.length > 0) await guardarLlamadas(frescas);
      calls = await leerLlamadas();
      persistido = true;
    } catch (err) {
      errorBase = err instanceof Error ? err.message : "Error desconocido";
      calls = frescas;
    }
  }

  // 3) Recortar a lo que es del cliente. Se guarda TODO el historial (arriba),
  // pero se responde solo lo del agente del tenant: la cuenta de voz tiene
  // agentes de varios clientes y nadie debe ver el trafico de otro. Las
  // metricas se recalculan sobre lo ya recortado, no sobre el total.
  const mias = soloDelTenant(calls, tenant);

  return {
    source: hayLlaveVapi() ? "vapi" : "demo",
    persistido,
    tarifaCarrier: tarifa,
    metrics: resumirLlamadas(mias, tarifa),
    calls: mias,
    sincronizadaEn: new Date().toISOString(),
    ...(errorVapi ? { errorVapi } : {}),
    ...(errorBase ? { errorBase } : {}),
  };
}

async function responder(req: Request) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ error: "Este módulo no está habilitado." }, { status: 403 });
  }
  const body = await armarRespuesta(tenant);
  return NextResponse.json(body, { status: body.errorVapi && body.calls.length === 0 ? 502 : 200 });
}

export async function GET(req: Request) {
  return responder(req);
}

// Mismo trabajo que GET. Existe para que el boton "Sincronizar" exprese
// intencion de escritura y no quede cacheado por ningun intermediario.
export async function POST(req: Request) {
  return responder(req);
}
