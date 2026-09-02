// El manejador del webhook de memoria, compartido por los agentes de voz.
//
// Vive acá y no en la ruta porque cada agente necesita SU tenant y SU criterio
// de qué se guarda, pero el resto (autenticar, leer el teléfono, fundir,
// contestar) es idéntico. Duplicarlo terminaría en dos copias que se
// desincronizan a la primera corrección.

import { NextResponse } from "next/server";
import {
  contextoParaAgente,
  FRASES_AUTO,
  fundir,
  normalizarTelefono,
  type ExtractoLlamada,
  type FrasesMemoria,
} from "./memoria-llamadas";
import { diagnostico, guardarMemoria, leerMemoria } from "./memoria-store";
import { getContacto, upsertContacto } from "./contacts-store";

// Marca de las notas que escribió el agente. Sirve para saber cuáles puede
// volver a pisar: lo que escribió una persona no se toca nunca.
const MARCA_AUTO = "Sofía anotó: ";

/** La nota de la ficha: qué vehículo mira y para qué lo quiere. */
function notaDeLlamada(e: ExtractoLlamada): string | undefined {
  const partes: string[] = [];
  if (e.modelos?.length) partes.push(e.modelos.join(", "));
  if (e.uso) partes.push(`lo quiere para ${e.uso}`);
  if (e.pago) partes.push(`pensaba pagarlo ${e.pago}`);
  // Sin datos sueltos, sirve el resumen de la llamada antes que nada.
  if (partes.length === 0 && e.resumen) partes.push(e.resumen);
  if (partes.length === 0) return undefined;
  const texto = partes.join(", ");
  return MARCA_AUTO + texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
}

// La ficha se crea con que haya número, aunque la llamada no deje nada más:
// alguien que llamó y colgó igual es un prospecto, y sin esto no existiría en
// Contactos ni en el pipeline. El nombre y la nota se llenan si la llamada los
// dio.
//
// Nunca tumba la llamada: si la ficha falla, se registra y se sigue.
async function crearOActualizarFicha(
  tenant: string,
  telefono: string,
  e: ExtractoLlamada,
): Promise<void> {
  try {
    const previo = await getContacto(telefono);
    const nota = notaDeLlamada(e);
    // Solo se pisa la nota si está vacía o si la anterior también es del
    // agente. Lo que escribió el staff a mano manda.
    const escribirNota = Boolean(nota) && (!previo?.notas || previo.notas.startsWith(MARCA_AUTO));

    const partes = (e.nombre ?? "").trim().split(/\s+/).filter(Boolean);
    await upsertContacto({
      from: telefono,
      tenant,
      ...(partes.length > 0 ? { nombre: partes[0], apellido: partes.slice(1).join(" ") } : {}),
      ...(escribirNota ? { notas: nota } : {}),
    });
  } catch (err) {
    console.error(`[memoria ${tenant}] no se pudo crear la ficha del contacto:`, err);
  }
}

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
   * Es un gancho por tenant y no un mapeo fijo porque los mismos campos
   * significan cosas distintas: en el concesionario son modelos, uso y forma de
   * pago; en el hospital son temas, motivo de consulta y con qué doctora se
   * atiende.
   */
  extraer: (d: Record<string, unknown>, resumen?: string) => ExtractoLlamada;
  /** Cómo se redacta el párrafo. Por defecto, el vocabulario del concesionario. */
  frases?: FrasesMemoria;
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
      texto = contextoParaAgente(
        telefono ? await leerMemoria(op.tenant, telefono) : null,
        Date.now(),
        op.frases ?? FRASES_AUTO,
      );
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

    // Primero la ficha, y a propósito ANTES del corte por "nada que recordar":
    // el contacto se crea aunque la llamada no haya dejado dato alguno.
    await crearOActualizarFicha(op.tenant, telefono, extracto);

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
