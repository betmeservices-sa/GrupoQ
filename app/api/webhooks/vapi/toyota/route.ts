import { NextResponse } from "next/server";
import { contextoParaAgente, fundir, normalizarTelefono, type ExtractoLlamada } from "@/lib/memoria-llamadas";
import { guardarMemoria, leerMemoria } from "@/lib/memoria-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Webhook del agente de voz de Toyota: la memoria entre llamadas.
//
// Atiende dos momentos de la misma llamada:
//   1. "tool-calls" -> el agente pregunta qué sabemos de quien está llamando.
//      Se responde con un párrafo en prosa (ver lib/memoria-llamadas.ts).
//   2. "end-of-call-report" -> la llamada terminó. Vapi ya extrajo los datos
//      con su analysisPlan, así que acá solo se funden con lo que había.
//
// Va aparte del webhook de /api/webhooks/vapi, que es del banco: mezclarlos
// haría que un cambio en la cobranza pudiera romper la memoria del concesionario.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores, ver middleware.ts) y
// por eso valida el secreto compartido.

const TENANT = "toyota";

interface CuerpoVapi {
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

function secretoValido(req: Request): boolean {
  const esperado = process.env.VAPI_WEBHOOK_SECRET;
  // Sin secreto configurado queda cerrado a propósito: prefiero que el agente
  // se quede sin memoria a que cualquiera pueda leer o escribir el historial de
  // los clientes.
  if (!esperado) return false;
  const recibido = req.headers.get("x-vapi-secret") ?? "";
  if (recibido.length !== esperado.length) return false;
  let dif = 0;
  for (let i = 0; i < recibido.length; i++) dif |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  return dif === 0;
}

/** El teléfono de quien llama, venga donde venga dentro del mensaje. */
function telefonoDe(msg: CuerpoVapi["message"]): string {
  return normalizarTelefono(msg?.call?.customer?.number ?? msg?.customer?.number ?? "");
}

function comoTexto(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  // El extractor a veces devuelve estos en vez de omitir el campo. Tomarlos como
  // valor haría que el agente dijera "la quería para no especificado".
  if (!s || /^(n\/?a|none|null|desconocido|no especificad)/i.test(s)) return undefined;
  return s;
}

function comoLista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => comoTexto(x)).filter((x): x is string => !!x);
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

  // ── 1. El agente pregunta a quién tiene del otro lado ──
  if (msg?.type === "tool-calls") {
    const llamada = msg.toolCalls?.[0];
    const id = llamada?.id ?? msg.toolCallList?.[0]?.id ?? "";
    const telefono = telefonoDe(msg);

    let texto: string;
    try {
      texto = contextoParaAgente(telefono ? await leerMemoria(TENANT, telefono) : null);
    } catch (err) {
      // Nunca se rompe la llamada por esto. Sin memoria, el agente atiende
      // igual, solo que sin acordarse de nada.
      console.error("[memoria toyota] fallo la consulta:", err);
      texto = contextoParaAgente(null);
    }

    return NextResponse.json({ results: [{ toolCallId: id, result: texto }] });
  }

  // ── 2. La llamada terminó: se guarda lo que dejó ──
  if (msg?.type === "end-of-call-report") {
    const telefono = telefonoDe(msg);
    if (!telefono) return NextResponse.json({ ok: true, ignorado: "sin número" });

    const d = msg.analysis?.structuredData ?? {};
    const extracto: ExtractoLlamada = {
      nombre: comoTexto(d.nombre),
      modelos: comoLista(d.modelos),
      uso: comoTexto(d.uso),
      pago: comoTexto(d.pago),
      agendo: d.agendo === true,
      resumen: comoTexto(d.resumen) ?? comoTexto(msg.analysis?.summary),
    };

    // Una llamada de la que no quedó ni un dato no cuenta como visita: si
    // colgaron al primer tono, el agente no tiene por qué "acordarse" de eso.
    const vacio =
      !extracto.nombre && !extracto.modelos?.length && !extracto.uso && !extracto.pago && !extracto.resumen;
    if (vacio) return NextResponse.json({ ok: true, ignorado: "sin nada que recordar" });

    try {
      const previo = await leerMemoria(TENANT, telefono);
      await guardarMemoria(fundir(previo, extracto, { tenant: TENANT, telefono, callId: msg.call?.id }));
    } catch (err) {
      // Un 5xx haría que Vapi reintentara y termináramos contando la misma
      // llamada dos veces.
      console.error("[memoria toyota] fallo al guardar:", err);
      return NextResponse.json({ ok: true, guardado: false });
    }
    return NextResponse.json({ ok: true, guardado: true });
  }

  return NextResponse.json({ ok: true, ignorado: msg?.type ?? "sin tipo" });
}
