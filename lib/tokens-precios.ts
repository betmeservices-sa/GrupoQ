// Tarifas de la API de Anthropic y aritmética del consumo.
// TODO lo de este módulo son funciones puras: sin fetch, sin env, sin React.
// Por eso se puede probar directo y se importa igual desde el cliente que desde
// el servidor (mismo criterio que lib/calls-metrics.ts para las llamadas).
//
// FRONTERA IMPORTANTE: aquí NO se estima nada. Los tokens salen del objeto
// `usage` que devuelve la API en cada respuesta, y el reparto texto/imagen sale
// de client.messages.count_tokens (ver lib/ai.ts). Nada de tiktoken ni de
// contar caracteres: subestiman los tokens de Claude.

/** Los CUATRO campos de `usage`. Se cobran distinto y se guardan los cuatro. */
export interface UsoTokens {
  /** Entrada NO cacheada. OJO: no es el prompt completo. */
  input_tokens: number;
  output_tokens: number;
  /** Escritura de caché: 1.25x el precio de entrada (TTL 5 min) o 2x (1 hora). */
  cache_creation_input_tokens: number;
  /** Lectura de caché: 0.1x el precio de entrada. */
  cache_read_input_tokens: number;
}

export const USO_CERO: UsoTokens = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

// ── Tarifas por MILLÓN de tokens (USD) ──
export interface TarifaModelo {
  input: number;
  output: number;
}

export const PRECIOS_POR_MILLON: Record<string, TarifaModelo> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-opus-5": { input: 5.0, output: 25.0 },
};

/** Promo introductoria de Sonnet 5: hasta el 31 de agosto de 2026 inclusive. */
export const PROMO_SONNET_5 = {
  modelo: "claude-sonnet-5",
  hastaISO: "2026-08-31",
  tarifa: { input: 2.0, output: 10.0 } as TarifaModelo,
};

// Multiplicadores del caché sobre el precio de ENTRADA.
export const MULT_CACHE_ESCRITURA_5M = 1.25;
export const MULT_CACHE_ESCRITURA_1H = 2;
export const MULT_CACHE_LECTURA = 0.1;

export type TtlCache = "5m" | "1h";

/**
 * Tarifa de un modelo. Acepta ids con fecha ("claude-haiku-4-5-20260101"):
 * gana la clave conocida más larga con la que empiece. null = tarifa
 * desconocida, y entonces el costo NO se inventa (queda en 0 y marcado).
 */
export function tarifaDe(modelo: string, fecha: Date = new Date()): TarifaModelo | null {
  const id = (modelo ?? "").trim().toLowerCase();
  if (!id) return null;

  const claves = Object.keys(PRECIOS_POR_MILLON)
    .filter((k) => id === k || id.startsWith(k))
    .sort((a, b) => b.length - a.length);
  const clave = claves[0];
  if (!clave) return null;

  if (clave === PROMO_SONNET_5.modelo) {
    const hoy = fecha.toISOString().slice(0, 10);
    if (hoy <= PROMO_SONNET_5.hastaISO) return PROMO_SONNET_5.tarifa;
  }
  return PRECIOS_POR_MILLON[clave];
}

/**
 * Tokens del PROMPT completo. `input_tokens` es solo el remanente no cacheado:
 * reportarlo como total es el error clásico.
 */
export function tokensPrompt(u: UsoTokens): number {
  return (
    (u.input_tokens ?? 0) +
    (u.cache_creation_input_tokens ?? 0) +
    (u.cache_read_input_tokens ?? 0)
  );
}

export function tokensTotales(u: UsoTokens): number {
  return tokensPrompt(u) + (u.output_tokens ?? 0);
}

export function sumarUso(a: UsoTokens, b: Partial<UsoTokens> | null | undefined): UsoTokens {
  return {
    input_tokens: a.input_tokens + (b?.input_tokens ?? 0),
    output_tokens: a.output_tokens + (b?.output_tokens ?? 0),
    cache_creation_input_tokens:
      a.cache_creation_input_tokens + (b?.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: a.cache_read_input_tokens + (b?.cache_read_input_tokens ?? 0),
  };
}

export interface CostoDesglosado {
  entrada: number; // input_tokens al precio normal
  salida: number; // output_tokens
  cacheEscritura: number; // 1.25x o 2x el precio de entrada
  cacheLectura: number; // 0.1x el precio de entrada
  total: number;
  /** false si el modelo no está en la tabla: el costo queda en 0, no inventado. */
  tarifaConocida: boolean;
}

const CERO: CostoDesglosado = {
  entrada: 0,
  salida: 0,
  cacheEscritura: 0,
  cacheLectura: 0,
  total: 0,
  tarifaConocida: false,
};

/** Redondeo a 6 decimales: una respuesta de WhatsApp cuesta millonésimas. */
function r6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function costoDeUso(
  u: UsoTokens,
  modelo: string,
  opts?: { ttlCache?: TtlCache; fecha?: Date },
): CostoDesglosado {
  const tarifa = tarifaDe(modelo, opts?.fecha);
  if (!tarifa) return { ...CERO };

  const multEscritura =
    opts?.ttlCache === "1h" ? MULT_CACHE_ESCRITURA_1H : MULT_CACHE_ESCRITURA_5M;

  const entrada = r6(((u.input_tokens ?? 0) / 1e6) * tarifa.input);
  const salida = r6(((u.output_tokens ?? 0) / 1e6) * tarifa.output);
  const cacheEscritura = r6(
    ((u.cache_creation_input_tokens ?? 0) / 1e6) * tarifa.input * multEscritura,
  );
  const cacheLectura = r6(
    ((u.cache_read_input_tokens ?? 0) / 1e6) * tarifa.input * MULT_CACHE_LECTURA,
  );

  return {
    entrada,
    salida,
    cacheEscritura,
    cacheLectura,
    total: r6(entrada + salida + cacheEscritura + cacheLectura),
    tarifaConocida: true,
  };
}

/**
 * Cuánto costaron las IMÁGENES de un turno.
 *
 * Las imágenes NO tienen línea propia en la factura: se cobran como tokens de
 * ENTRADA. Por eso el desglose texto/imagen que pidió el dueño se calcula así:
 * los `tokensImagen` (medidos con count_tokens, ver lib/ai.ts) se valorizan al
 * precio de entrada, y lo que sobra del costo total es texto.
 */
export function costoDeImagen(
  tokensImagen: number,
  modelo: string,
  fecha?: Date,
): number {
  const tarifa = tarifaDe(modelo, fecha);
  if (!tarifa || tokensImagen <= 0) return 0;
  return r6((tokensImagen / 1e6) * tarifa.input);
}

/** Reparto del costo de un turno entre texto e imagen. */
export function repartirCosto(
  u: UsoTokens,
  tokensImagen: number,
  modelo: string,
  opts?: { ttlCache?: TtlCache; fecha?: Date },
): { costo: CostoDesglosado; costoImagen: number; costoTexto: number } {
  const costo = costoDeUso(u, modelo, opts);
  const costoImagen = Math.min(costoDeImagen(tokensImagen, modelo, opts?.fecha), costo.total);
  return { costo, costoImagen, costoTexto: r6(costo.total - costoImagen) };
}

/** Formato de dinero para montos que suelen ser millonésimas de dólar. */
export function fmtCosto(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/** 1234 -> "1,234" (los tokens se leen mejor con separador). */
export function fmtTokens(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("es-SV");
}
