// Consumo de la IA: un registro por respuesta generada.
// Persiste en Supabase (`ai_uso_tokens`) para que el webhook, que corre en una
// función serverless aparte del dashboard, escriba donde el dashboard lee. Sin
// Supabase cae a memoria, igual que el resto de los stores (solo sirve local).
//
// SE GUARDA EL MODELO en cada fila a propósito: si mañana cambia AI_MODEL, el
// histórico NO se puede recalcular con la tarifa nueva. Y además se guarda el
// costo ya calculado (snapshot), para que un cambio en la tabla de precios no
// reescriba lo que ya se facturó.

import { esquemaDeTenant, getSupabase } from "./supabase";
import { columnaFaltante } from "./tabla-faltante";
import {
  costoDeImagen,
  costoDeUso,
  fmtCosto,
  tokensPrompt,
  USO_CERO,
  type CostoDesglosado,
  type UsoTokens,
} from "./tokens-precios";

export interface RegistroConsumo {
  ts: string; // ISO
  tenant: string;
  waFrom: string; // número / lead
  waId?: string | null; // id del mensaje saliente, para cruzar con el hilo
  modelo: string;
  uso: UsoTokens;
  /** Tokens que aportaron las imágenes (medidos con count_tokens). */
  tokensImagen: number;
  /** Cuántas imágenes se le pasaron al modelo en este turno. */
  imagenes: number;
  /** Llamadas al modelo del turno (el bucle de herramientas puede dar varias). */
  llamadas: number;
  /**
   * Qué se pagó. "respuesta" es el agente contestando; "transcripcion" es pasar
   * una nota de voz a texto, que es otro modelo y otro precio. Se separan para
   * que el conteo de respuestas no se infle con los audios y para poder ver
   * cuánto pesa cada cosa. Default: respuesta.
   */
  tipo?: "respuesta" | "transcripcion";
}

interface FilaConsumo extends RegistroConsumo {
  tokensTexto: number;
  costo: CostoDesglosado;
  costoImagen: number;
  costoTexto: number;
}

function materializar(r: RegistroConsumo): FilaConsumo {
  const costo = costoDeUso(r.uso, r.modelo);
  const costoImagen = Math.min(costoDeImagen(r.tokensImagen, r.modelo), costo.total);
  return {
    ...r,
    tokensTexto: Math.max(tokensPrompt(r.uso) - r.tokensImagen, 0),
    costo,
    costoImagen,
    costoTexto: Math.round((costo.total - costoImagen) * 1e6) / 1e6,
  };
}

// Fallback en memoria (local, sin Supabase).
const mem: FilaConsumo[] = [];
const MAX_MEM = 1000;

export async function registrarConsumo(r: RegistroConsumo): Promise<void> {
  const fila = materializar(r);
  const sb = getSupabase(r.tenant);
  if (!sb) {
    mem.push(fila);
    if (mem.length > MAX_MEM) mem.splice(0, mem.length - MAX_MEM);
    return;
  }
  const registro: Record<string, unknown> = {
    ts: fila.ts,
    tenant: fila.tenant,
    wa_from: fila.waFrom,
    wa_id: fila.waId ?? null,
    modelo: fila.modelo,
    input_tokens: fila.uso.input_tokens,
    output_tokens: fila.uso.output_tokens,
    cache_creation_input_tokens: fila.uso.cache_creation_input_tokens,
    cache_read_input_tokens: fila.uso.cache_read_input_tokens,
    tokens_texto: fila.tokensTexto,
    tokens_imagen: fila.tokensImagen,
    imagenes: fila.imagenes,
    llamadas: fila.llamadas,
    tipo: fila.tipo ?? "respuesta",
    costo_entrada: fila.costo.entrada,
    costo_salida: fila.costo.salida,
    costo_cache_escritura: fila.costo.cacheEscritura,
    costo_cache_lectura: fila.costo.cacheLectura,
    costo_texto: fila.costoTexto,
    costo_imagen: fila.costoImagen,
    costo_total: fila.costo.total,
  };
  const { error } = await sb.from("ai_uso_tokens").insert(registro);
  if (error && columnaFaltante(error)) {
    // Falta la migración de `tipo`. Perder el registro entero por una columna
    // nueva sería lo peor de los dos mundos: el agente responde, cuesta plata, y
    // el panel dice que no gastó nada. Se guarda sin esa columna.
    const { tipo: _fuera, ...sinTipo } = registro;
    const reintento = await sb.from("ai_uso_tokens").insert(sinTipo);
    if (reintento.error) console.error("ai_uso_tokens insert:", reintento.error.message);
    return;
  }
  if (error) console.error("ai_uso_tokens insert:", error.message);
}

// ── Lectura para el dashboard ──

export interface TotalesConsumo {
  respuestas: number; // turnos con respuesta de la IA (NO cuenta transcripciones)
  /** Notas de voz pasadas a texto, y lo que costaron aparte. */
  transcripciones: number;
  costoTranscripcion: number;
  llamadas: number; // llamadas al modelo (incluye el bucle de herramientas)
  imagenes: number;
  tokensPrompt: number;
  tokensSalida: number;
  tokensTexto: number;
  tokensImagen: number;
  inputTokens: number;
  cacheEscritura: number;
  cacheLectura: number;
  costoTotal: number;
  costoTexto: number;
  costoImagen: number;
  costoEntrada: number;
  costoSalida: number;
}

export interface ConsumoConversacion extends TotalesConsumo {
  waFrom: string;
  modelos: string[];
  ultimo: string; // ISO del último consumo
}

export interface ResumenConsumo {
  total: TotalesConsumo;
  conversaciones: ConsumoConversacion[];
  modelos: Array<{ modelo: string; respuestas: number; tokens: number; costo: number }>;
}

function totalesVacios(): TotalesConsumo {
  return {
    respuestas: 0,
    transcripciones: 0,
    costoTranscripcion: 0,
    llamadas: 0,
    imagenes: 0,
    tokensPrompt: 0,
    tokensSalida: 0,
    tokensTexto: 0,
    tokensImagen: 0,
    inputTokens: 0,
    cacheEscritura: 0,
    cacheLectura: 0,
    costoTotal: 0,
    costoTexto: 0,
    costoImagen: 0,
    costoEntrada: 0,
    costoSalida: 0,
  };
}

function acumular(t: TotalesConsumo, f: FilaConsumo): void {
  // Una transcripción NO es una respuesta: contarla como tal inflaría el número
  // que mira el dueño para saber cuántas veces contestó el agente.
  if (f.tipo === "transcripcion") {
    t.transcripciones += 1;
    t.costoTranscripcion += f.costo.total;
    t.costoTotal += f.costo.total;
    t.tokensPrompt += tokensPrompt(f.uso);
    t.tokensSalida += f.uso.output_tokens;
    t.inputTokens += f.uso.input_tokens;
    t.costoEntrada += f.costo.entrada;
    t.costoSalida += f.costo.salida;
    return;
  }
  t.respuestas += 1;
  t.llamadas += f.llamadas;
  t.imagenes += f.imagenes;
  t.tokensPrompt += tokensPrompt(f.uso);
  t.tokensSalida += f.uso.output_tokens;
  t.tokensTexto += f.tokensTexto;
  t.tokensImagen += f.tokensImagen;
  t.inputTokens += f.uso.input_tokens;
  t.cacheEscritura += f.uso.cache_creation_input_tokens;
  t.cacheLectura += f.uso.cache_read_input_tokens;
  t.costoTotal += f.costo.total;
  t.costoTexto += f.costoTexto;
  t.costoImagen += f.costoImagen;
  t.costoEntrada += f.costo.entrada + f.costo.cacheEscritura + f.costo.cacheLectura;
  t.costoSalida += f.costo.salida;
}

function redondear(t: TotalesConsumo): void {
  for (const k of [
    "costoTranscripcion",
    "costoTotal",
    "costoTexto",
    "costoImagen",
    "costoEntrada",
    "costoSalida",
  ] as const) {
    t[k] = Math.round(t[k] * 1e6) / 1e6;
  }
}

/** Agrega las filas en totales + una línea por conversación (número). */
export function resumirFilas(filas: FilaConsumo[]): ResumenConsumo {
  const total = totalesVacios();
  const porNumero = new Map<string, ConsumoConversacion>();
  const porModelo = new Map<string, { respuestas: number; tokens: number; costo: number }>();

  for (const f of filas) {
    acumular(total, f);

    let c = porNumero.get(f.waFrom);
    if (!c) {
      c = { ...totalesVacios(), waFrom: f.waFrom, modelos: [], ultimo: f.ts };
      porNumero.set(f.waFrom, c);
    }
    acumular(c, f);
    if (!c.modelos.includes(f.modelo)) c.modelos.push(f.modelo);
    if (f.ts > c.ultimo) c.ultimo = f.ts;

    // El corte por modelo sí cuenta las transcripciones: ahí se quiere ver qué
    // pesa cada modelo, Claude y Gemini incluidos.
    const m = porModelo.get(f.modelo) ?? { respuestas: 0, tokens: 0, costo: 0 };
    m.respuestas += 1;
    m.tokens += tokensPrompt(f.uso) + f.uso.output_tokens;
    m.costo += f.costo.total;
    porModelo.set(f.modelo, m);
  }

  redondear(total);
  const conversaciones = [...porNumero.values()];
  for (const c of conversaciones) redondear(c);
  conversaciones.sort((a, b) => b.costoTotal - a.costoTotal);

  return {
    total,
    conversaciones,
    modelos: [...porModelo.entries()]
      .map(([modelo, v]) => ({ modelo, ...v, costo: Math.round(v.costo * 1e6) / 1e6 }))
      .sort((a, b) => b.costo - a.costo),
  };
}

/** Consumo de un cliente (tenant). Sin tenant, el de todos. */
/**
 * Las filas crudas, una por respuesta del agente. El resumen sirve para el
 * total del mes; esto sirve para la pregunta que aparece siempre en cuanto se
 * mira el gasto en serio: cuánto costó ESTA respuesta.
 */
export async function detalleConsumo(tenant?: string, tope = 50): Promise<FilaConsumo[]> {
  const sb = getSupabase();
  if (!sb) {
    return mem.filter((f) => !tenant || f.tenant === tenant).slice(0, tope);
  }
  const filas = await leerFilas(tenant, tope);
  return filas;
}

export async function resumenConsumo(tenant?: string): Promise<ResumenConsumo> {
  const sb = getSupabase();
  if (!sb) {
    return resumirFilas(mem.filter((f) => !tenant || f.tenant === tenant));
  }

  return resumirFilas(await leerFilas(tenant, 1000));
}

// Columnas que se leen. `COLS_BASE` es lo que existe desde siempre; `COLS`
// suma `tipo`, que llegó con la medición de las transcripciones. Se separan
// porque el código sale antes que la migración y hay que poder leer sin ella.
const COLS_BASE =
  "ts, tenant, wa_from, wa_id, modelo, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, tokens_texto, tokens_imagen, imagenes, llamadas, costo_entrada, costo_salida, costo_cache_escritura, costo_cache_lectura, costo_texto, costo_imagen, costo_total";
const COLS = `${COLS_BASE}, tipo`;

// Lectura cruda, compartida por el resumen y el detalle.
//
// Un cliente con esquema propio (Yali) tiene filas en su esquema Y en public:
// registrarConsumo escribió en public hasta el 27 de agosto de 2026. Se leen
// las dos y se juntan; así el consumo del cliente sale completo.
async function leerFilas(tenant: string | undefined, tope: number): Promise<FilaConsumo[]> {
  const sb = getSupabase(tenant);
  if (!sb) return mem.filter((f) => !tenant || f.tenant === tenant).slice(0, tope);
  const propias = await leerFilasEn(sb, tenant, tope);
  if (!tenant || esquemaDeTenant(tenant) === "public") return propias;
  const pub = getSupabase();
  if (!pub) return propias;
  const enPublic = await leerFilasEn(pub, tenant, tope);
  const vistas = new Set(propias.map((f) => `${f.ts}|${f.waId ?? ""}|${f.waFrom}`));
  const todas = [...propias, ...enPublic.filter((f) => !vistas.has(`${f.ts}|${f.waId ?? ""}|${f.waFrom}`))];
  todas.sort((x, y) => y.ts.localeCompare(x.ts));
  return todas.slice(0, tope);
}

async function leerFilasEn(sb: NonNullable<ReturnType<typeof getSupabase>>, tenant: string | undefined, tope: number): Promise<FilaConsumo[]> {
  let q = sb
    .from("ai_uso_tokens")
    .select(COLS)
    .order("ts", { ascending: false })
    .limit(tope);
  if (tenant) q = q.eq("tenant", tenant);

  let res = await q;
  if (res.error && columnaFaltante(res.error)) {
    // La migración de `tipo` todavía no corrió. Se lee sin esa columna en vez
    // de devolver un panel en blanco: el consumo ya registrado sigue siendo
    // válido, y todo lo viejo es una respuesta del agente de todos modos.
    let q2 = sb
      .from("ai_uso_tokens")
      .select(COLS_BASE)
      .order("ts", { ascending: false })
      .limit(tope);
    if (tenant) q2 = q2.eq("tenant", tenant);
    res = (await q2) as typeof res;
  }
  const { data, error } = res;
  if (error) {
    console.error("ai_uso_tokens select:", error.message);
    return [];
  }

  // Se leen los costos GUARDADOS (snapshot con la tarifa del día), no se
  // recalculan: la tabla de precios de hoy no debe reescribir el histórico.
  const filas: FilaConsumo[] = (data ?? []).map((r) => {
    const uso: UsoTokens = {
      input_tokens: Number(r.input_tokens ?? 0),
      output_tokens: Number(r.output_tokens ?? 0),
      cache_creation_input_tokens: Number(r.cache_creation_input_tokens ?? 0),
      cache_read_input_tokens: Number(r.cache_read_input_tokens ?? 0),
    };
    return {
      ts: r.ts as string,
      tenant: (r.tenant as string) ?? "",
      waFrom: (r.wa_from as string) ?? "",
      waId: (r.wa_id as string | null) ?? null,
      modelo: (r.modelo as string) ?? "",
      uso,
      tokensImagen: Number(r.tokens_imagen ?? 0),
      imagenes: Number(r.imagenes ?? 0),
      llamadas: Number(r.llamadas ?? 1),
      tipo: ((r.tipo as string) === "transcripcion" ? "transcripcion" : "respuesta") as
        | "respuesta"
        | "transcripcion",
      tokensTexto: Number(r.tokens_texto ?? 0),
      costo: {
        entrada: Number(r.costo_entrada ?? 0),
        salida: Number(r.costo_salida ?? 0),
        cacheEscritura: Number(r.costo_cache_escritura ?? 0),
        cacheLectura: Number(r.costo_cache_lectura ?? 0),
        total: Number(r.costo_total ?? 0),
        tarifaConocida: true,
      },
      costoImagen: Number(r.costo_imagen ?? 0),
      costoTexto: Number(r.costo_texto ?? 0),
    };
  });
  return filas;
}

/** Borra el consumo de un cliente (lo llama el "Borrar historial" del demo). */
export async function borrarConsumo(tenant?: string): Promise<void> {
  const sb = getSupabase(tenant);
  if (!sb) {
    for (let i = mem.length - 1; i >= 0; i--) {
      if (!tenant || mem[i].tenant === tenant) mem.splice(i, 1);
    }
    return;
  }
  const base = sb.from("ai_uso_tokens").delete();
  const { error } = await (tenant ? base.eq("tenant", tenant) : base.neq("id", 0));
  if (error) console.error("ai_uso_tokens delete:", error.message);
}

// Re-export por comodidad de los componentes del dashboard.
export { fmtCosto, USO_CERO };
