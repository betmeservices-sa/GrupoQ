import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { columnaFaltante, latchDeTabla, tablaFaltante } from "@/lib/tabla-faltante";
import { esCliente, LIMITE_BYTES, limpiar, type EnvioOnboarding } from "@/lib/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recibe los formularios de onboarding que llena el cliente.
//
// La ruta es PÚBLICA porque la llama el sitio de miagentia.com, que no tiene
// sesión ni backend. Por eso NO alcanza con que sea pública y ya: valida que el
// cliente esté en una lista cerrada, limita el tamaño y limita cuántos envíos
// acepta por IP. Un secreto compartido no serviría: viajaría dentro del
// JavaScript de una página abierta, o sea que no sería secreto.

const ORIGENES = new Set([
  "https://www.miagentia.com",
  "https://miagentia.com",
  "http://localhost:4200",
]);

function cors(origen: string | null) {
  const permitido = origen && ORIGENES.has(origen) ? origen : "https://www.miagentia.com";
  return {
    "access-control-allow-origin": permitido,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
  };
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

// Freno por IP en memoria. No es infalible entre instancias serverless, pero
// corta el caso real: alguien apretando enviar en bucle.
const golpes = new Map<string, number[]>();
const VENTANA_MS = 10 * 60_000;
const MAX_POR_VENTANA = 8;

function demasiados(ip: string): boolean {
  const ahora = Date.now();
  const previos = (golpes.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  golpes.set(ip, previos);
  return previos.length > MAX_POR_VENTANA;
}

const faltaTabla = latchDeTabla();

export async function POST(req: Request) {
  const cabeceras = cors(req.headers.get("origin"));
  const ip = (req.headers.get("x-forwarded-for") ?? "sin-ip").split(",")[0].trim();
  if (demasiados(ip)) {
    return NextResponse.json({ ok: false, error: "Demasiados envíos seguidos." }, { status: 429, headers: cabeceras });
  }

  const crudo = await req.text();
  if (crudo.length > LIMITE_BYTES) {
    return NextResponse.json({ ok: false, error: "El envío es demasiado grande." }, { status: 413, headers: cabeceras });
  }

  let body: { cliente?: unknown; respuestas?: unknown; pendientes?: unknown };
  try {
    body = JSON.parse(crudo);
  } catch {
    return NextResponse.json({ ok: false, error: "Formato inválido." }, { status: 400, headers: cabeceras });
  }

  if (!esCliente(body.cliente)) {
    return NextResponse.json({ ok: false, error: "Cliente desconocido." }, { status: 400, headers: cabeceras });
  }

  const respuestas = limpiar(body.respuestas);
  if (Object.keys(respuestas).length === 0) {
    return NextResponse.json({ ok: false, error: "El formulario viene vacío." }, { status: 400, headers: cabeceras });
  }

  const envio: EnvioOnboarding = {
    id: `onb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    cliente: body.cliente,
    respuestas,
    pendientes: Number.isFinite(Number(body.pendientes)) ? Math.max(0, Number(body.pendientes)) : 0,
    origen: req.headers.get("origin") ?? undefined,
    creado: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    // Sin base no se puede prometer que quedó guardado. Se dice, y el
    // formulario ofrece copiar el resumen a mano en vez de dar un falso ok.
    console.error("[onboarding] sin base, envío perdido:", envio.cliente);
    return NextResponse.json({ ok: false, error: "Guardado no disponible." }, { status: 503, headers: cabeceras });
  }

  const { error } = await sb.from("onboarding").insert({
    id: envio.id,
    cliente: envio.cliente,
    respuestas: envio.respuestas,
    pendientes: envio.pendientes,
    origen: envio.origen ?? null,
    creado: envio.creado,
  });
  if (error) {
    if (tablaFaltante(error) || columnaFaltante(error)) faltaTabla.marcar();
    console.error("[onboarding] no se pudo guardar:", error.message);
    return NextResponse.json({ ok: false, error: "No se pudo guardar." }, { status: 503, headers: cabeceras });
  }

  return NextResponse.json({ ok: true, id: envio.id }, { headers: cabeceras });
}
