import { NextResponse } from "next/server";
import { cerrarItem } from "@/lib/cobros-campanas";
import { hoyEnSv } from "@/lib/cobros-cartera";
import {
  analizarLlamada,
  aplicarAnalisis,
  aplicarSinContacto,
  resultadoDeEndedReason,
} from "@/lib/cobros-ia";
import {
  actualizarItem,
  buscarDeudor,
  deudorPorTelefono,
  guardarDeudor,
  itemPorCallId,
} from "@/lib/cobros-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Webhook de Vapi: la llamada terminó.
//
// Este es el camino de PRODUCCIÓN. El tick de la campaña también cierra
// llamadas (consultando a Vapi), pero eso sirve mientras alguien tiene la
// pantalla abierta. El webhook llega siempre, aunque nadie esté mirando, que es
// lo que hace falta cuando una base de 10,000 corre toda la tarde.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores, ver middleware.ts).
// Por eso valida un secreto compartido: sin él, cualquiera podría inventar
// llamadas y mover fichas de clientes.

interface CuerpoVapi {
  message?: {
    type?: string;
    call?: {
      id?: string;
      customer?: { number?: string };
      startedAt?: string;
      endedAt?: string;
    };
    endedReason?: string;
    transcript?: string;
    recordingUrl?: string;
    durationSeconds?: number;
    cost?: number;
  };
}

function secretoValido(req: Request): boolean {
  const esperado = process.env.VAPI_WEBHOOK_SECRET;
  // Sin secreto configurado el webhook queda cerrado a propósito: prefiero que
  // no entren llamadas a que entre cualquiera. Se configura el mismo valor en
  // el panel de Vapi (Server URL → headers: x-vapi-secret).
  if (!esperado) return false;
  const recibido = req.headers.get("x-vapi-secret") ?? "";
  if (recibido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < recibido.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

export async function POST(req: Request) {
  if (!secretoValido(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: CuerpoVapi;
  try {
    body = (await req.json()) as CuerpoVapi;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const msg = body.message;
  // Vapi manda varios tipos de mensaje al mismo servidor. Solo interesa el
  // reporte final, que es el único que trae la transcripción completa.
  if (msg?.type !== "end-of-call-report") {
    return NextResponse.json({ ok: true, ignorado: msg?.type ?? "sin tipo" });
  }

  const callId = msg.call?.id ?? "";
  const transcript = (msg.transcript ?? "").trim();
  const endedReason = msg.endedReason;
  const duracionSeg =
    msg.durationSeconds ??
    (msg.call?.startedAt && msg.call?.endedAt
      ? Math.max(
          0,
          Math.round((Date.parse(msg.call.endedAt) - Date.parse(msg.call.startedAt)) / 1000),
        )
      : 0);

  // Se busca primero por la llamada (viene de una campaña) y si no, por el
  // teléfono (llamada suelta o entrante).
  const enCampana = callId ? itemPorCallId(callId) : null;
  const deudor = enCampana
    ? buscarDeudor(enCampana.item.deudorId)
    : deudorPorTelefono(msg.call?.customer?.number ?? "");

  if (!deudor) {
    return NextResponse.json({ ok: true, ignorado: "ninguna cuenta con ese número" });
  }

  const ahora = new Date();
  const sinContacto = resultadoDeEndedReason(endedReason);

  // Sin transcripción no se llama al modelo: solo se anota el intento.
  if (!transcript) {
    const resultado = sinContacto ?? "no_contesto";
    guardarDeudor(
      aplicarSinContacto(deudor, resultado, {
        ahora,
        callId,
        campanaId: enCampana?.campana.id,
        motivo: endedReason,
      }),
    );
    if (enCampana) {
      actualizarItem(
        enCampana.campana.id,
        cerrarItem(enCampana.item, { resultado, duracionSeg: 0, costo: msg.cost }, enCampana.campana, ahora),
      );
    }
    return NextResponse.json({ ok: true, resultado });
  }

  let analisis;
  try {
    analisis = await analizarLlamada({ deudor, transcript, duracionSeg, endedReason });
  } catch (err) {
    // Nunca se devuelve un 5xx: Vapi reintentaría y volveríamos a pagar el
    // análisis de la misma llamada. Se registra el intento y se sigue.
    console.error("[cobros] no se pudo analizar la llamada:", err);
    if (enCampana) {
      actualizarItem(
        enCampana.campana.id,
        cerrarItem(
          enCampana.item,
          {
            duracionSeg,
            costo: msg.cost,
            error: err instanceof Error ? err.message : "Fallo el análisis.",
          },
          enCampana.campana,
          ahora,
        ),
      );
    }
    return NextResponse.json({ ok: true, analizado: false });
  }

  if (!analisis) {
    return NextResponse.json({ ok: true, analizado: false, motivo: "transcripción muy corta" });
  }

  guardarDeudor(
    aplicarAnalisis(deudor, analisis, {
      ahora,
      hoy: hoyEnSv(ahora),
      callId,
      campanaId: enCampana?.campana.id,
      duracionSeg,
      transcript,
      grabacionUrl: msg.recordingUrl,
    }),
  );

  if (enCampana) {
    actualizarItem(
      enCampana.campana.id,
      cerrarItem(
        enCampana.item,
        { resultado: analisis.resultado, duracionSeg, costo: msg.cost },
        enCampana.campana,
        ahora,
      ),
    );
  }

  return NextResponse.json({ ok: true, resultado: analisis.resultado });
}
