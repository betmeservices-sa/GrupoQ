// El manejador del webhook de memoria, compartido por los agentes de voz.
//
// Vive acá y no en la ruta porque cada agente necesita SU tenant y SU criterio
// de qué se guarda, pero el resto (autenticar, leer el teléfono, fundir,
// contestar) es idéntico. Duplicarlo terminaría en dos copias que se
// desincronizan a la primera corrección.

import { NextResponse } from "next/server";
import { contextoParaAgente, fundir, normalizarTelefono, type ExtractoLlamada } from "./memoria-llamadas";
import { diagnostico, guardarMemoria, leerMemoria } from "./memoria-store";

export interface CuerpoVapi {
  message?: {
    type?: string;
    call?: { id?: string; customer?: { number?: string } };
    customer?: { number?: string };
    toolCalls?: { id?: string; function?: { name?: string; arguments?: unknown } }[];
    toolCallList?: { id?: string; name?: string }[];
    analysis?: { structuredData?: Record<string, unknown>; summary?: string };
    transcript?: string;
  };
}

export interface OpcionesMemoria {
  tenant: string;
  /**
   * Qué se queda de la llamada.
   *
   * Es un gancho por tenant y no un mapeo fijo porque el criterio cambia: en un
   * concesionario conviene guardar todo lo que se habló; en un hospital, no.
   * Ver la ruta del gineco.
   */
  extraer: (d: Record<string, unknown>, resumen?: string) => ExtractoLlamada;
}

function secretoValido(req: Request): boolean {
  const esperado = process.env.VAPI_MEMORIA_SECRET || process.env.VAPI_WEBHOOK_SECRET;
  if (!esperado) return false;
  const recibido = req.headers.get("x-vapi-secret") ?? "";
  if (recibido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < recibido.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

function telefonoDe(msg: CuerpoVapi["message"]): string {
  return normalizarTelefono(msg?.call?.customer?.number ?? msg?.customer?.number ?? "");
}

/** Texto limpio, o nada. Nunca un "no especificado" que después se diga en voz alta. */
export function comoTexto(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s || /^(n\/?a|none|null|desconocido|no especificad)/i.test(s)) return undefined;
  return s;
}

export function comoLista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => comoTexto(x)).filter((x): x is string => !!x);
}

export async function diagnosticoMemoria(req: Request) {
  if (!secretoValido(req)) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await diagnostico()) });
}

export async function manejarMemoria(req: Request, op: OpcionesMemoria) {
  if (!secretoValido(req)) return NextResponse.json({ ok: false }, { status: 401 });

  let body: CuerpoVapi;
  try {
    body = (await req.json()) as CuerpoVapi;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const msg = body.message;

  // ── El agente pregunta a quién tiene del otro lado ──
  if (msg?.type === "tool-calls") {
    const id = msg.toolCalls?.[0]?.id ?? msg.toolCallList?.[0]?.id ?? "";
    const telefono = telefonoDe(msg);
    let texto: string;
    try {
      texto = contextoParaAgente(telefono ? await leerMemoria(op.tenant, telefono) : null);
    } catch (err) {
      // Nunca se rompe la llamada por esto. Sin memoria el agente atiende igual.
      console.error(`[memoria ${op.tenant}] fallo la consulta:`, err);
      texto = contextoParaAgente(null);
    }
    return NextResponse.json({ results: [{ toolCallId: id, result: texto }] });
  }

  // ── La llamada terminó ──
  if (msg?.type === "end-of-call-report") {
    const telefono = telefonoDe(msg);
    if (!telefono) return NextResponse.json({ ok: true, ignorado: "sin número" });

    const extracto = op.extraer(msg.analysis?.structuredData ?? {}, msg.analysis?.summary);
    const vacio =
      !extracto.nombre && !extracto.modelos?.length && !extracto.uso && !extracto.pago && !extracto.resumen;
    if (vacio) return NextResponse.json({ ok: true, ignorado: "sin nada que recordar" });

    try {
      const previo = await leerMemoria(op.tenant, telefono);
      const r = await guardarMemoria(
        fundir(previo, extracto, { tenant: op.tenant, telefono, callId: msg.call?.id }),
      );
      return NextResponse.json({ ok: true, guardado: r.ok, donde: r.donde, ...(r.error ? { error: r.error } : {}) });
    } catch (err) {
      // Un 5xx haría que Vapi reintentara y contáramos la llamada dos veces.
      console.error(`[memoria ${op.tenant}] fallo al guardar:`, err);
      return NextResponse.json({ ok: true, guardado: false });
    }
  }

  return NextResponse.json({ ok: true, ignorado: msg?.type ?? "sin tipo" });
}
