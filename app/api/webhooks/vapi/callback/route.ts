import { NextResponse } from "next/server";
import { secretoVapiValido } from "@/lib/vapi-secreto";
import {
  buscarToolCall,
  confirmacion,
  cuandoLlamar,
  minutosPedidos,
} from "@/lib/callback-llamada";
import { fetchVapiAgentes, hayLlaveVapi, lanzarLlamadaVapi } from "@/lib/vapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// "Llámeme en dos minutos".
//
// Alguien que va manejando no es alguien que no quiere: es alguien a quien hay
// que marcarle después. El agente pide la herramienta, esto agenda la llamada
// de vuelta en Vapi y le contesta al instante para que pueda despedirse.
//
// QUIÉN devuelve la llamada sale de la llamada misma (assistantId y línea del
// payload), nunca de un agente escrito acá: con varios clientes en la misma
// cuenta, dejarlo fijo significaría que al prospecto de un cliente lo llame de
// vuelta el agente de otro.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores) y valida el secreto.
// Nunca responde 5xx: un error nuestro haría que Vapi reintente y la persona
// terminaría con dos llamadas.

interface CuerpoVapi {
  message?: {
    type?: string;
    call?: {
      id?: string;
      assistantId?: string;
      phoneNumberId?: string;
      customer?: { number?: string };
      assistantOverrides?: { variableValues?: Record<string, unknown> };
    };
    customer?: { number?: string };
  };
}

/** Cómo entra la de vuelta. Presentarse de cero después de hablar es delatarse. */
const SALUDO_DE_VUELTA =
  "{% if nombre and nombre != \"no disponible\" %}Buenas {{nombre}}, le saluda Sofía de CrediQ otra vez. " +
  "Le devuelvo la llamada como quedamos, ¿le queda bien ahora?{% else %}Buenas, le saluda Sofía de CrediQ. " +
  "Le devuelvo la llamada como quedamos, ¿le queda bien ahora?{% endif %}";

/** Solo texto: las variables de Vapi no aceptan otra cosa. */
function variablesDe(v: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!v) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === "string") out[k] = val;
    else if (typeof val === "number" || typeof val === "boolean") out[k] = String(val);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function respuesta(toolCallId: string, texto: string) {
  return NextResponse.json({ results: [{ toolCallId, result: texto }] });
}

export async function POST(req: Request) {
  if (!secretoVapiValido(req)) return NextResponse.json({ ok: false }, { status: 401 });

  let body: CuerpoVapi;
  try {
    body = (await req.json()) as CuerpoVapi;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const msg = body.message;
  const tool = buscarToolCall(msg);
  if (!tool) return NextResponse.json({ ok: true, ignorado: msg?.type ?? "sin tipo" });

  const minutos = minutosPedidos(tool.args.minutos);
  const numero = msg?.call?.customer?.number ?? msg?.customer?.number ?? "";
  const assistantId = msg?.call?.assistantId ?? "";

  // De acá para abajo nada tira: si algo falta, el agente tiene que poder
  // decírselo a la persona en vez de quedarse callado esperando.
  if (!numero || !assistantId) {
    console.error("[callback] falta número o agente en el payload de Vapi");
    return respuesta(tool.id, "No se pudo agendar la llamada de vuelta. Decile que te vuelva a marcar cuando pueda.");
  }
  if (!hayLlaveVapi()) {
    console.error("[callback] sin VAPI_PRIVATE_KEY: no se puede agendar");
    return respuesta(tool.id, "No se pudo agendar la llamada de vuelta. Decile que te vuelva a marcar cuando pueda.");
  }

  // La línea desde la que se devuelve: la misma de esta llamada. Si el payload
  // no la trae, cualquiera del agente, que es lo que hace el resto de la app.
  let phoneNumberId = msg?.call?.phoneNumberId ?? "";
  if (!phoneNumberId) {
    try {
      const agentes = await fetchVapiAgentes();
      phoneNumberId = agentes.find((a) => a.id === assistantId)?.numeros[0]?.id ?? "";
    } catch (err) {
      console.error("[callback] no se pudo resolver la línea:", err);
    }
  }
  if (!phoneNumberId) {
    return respuesta(tool.id, "No se pudo agendar la llamada de vuelta. Decile que te vuelva a marcar cuando pueda.");
  }

  const nota = typeof tool.args.nota === "string" ? tool.args.nota.trim() : "";
  try {
    const ll = await lanzarLlamadaVapi({
      assistantId,
      phoneNumberId,
      numero,
      programadaPara: cuandoLlamar(minutos),
      variables: variablesDe(msg?.call?.assistantOverrides?.variableValues),
      primerMensaje: SALUDO_DE_VUELTA,
    });
    console.log(
      `[callback] de vuelta en ${minutos} min a ${numero} (agente ${assistantId}, llamada ${ll.id})` +
        (nota ? ` — ${nota}` : ""),
    );
    return respuesta(tool.id, confirmacion(minutos));
  } catch (err) {
    console.error("[callback] Vapi no aceptó la llamada agendada:", err);
    return respuesta(tool.id, "No se pudo agendar la llamada de vuelta. Decile que te vuelva a marcar cuando pueda.");
  }
}
