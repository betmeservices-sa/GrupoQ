// El tablero de la agencia leía mil filas y reportaba eso como el periodo.
//
// EL BUG (16 de septiembre de 2026). `leerFilasEn` pedía `.limit(5000)`, pero
// PostgREST corta en 1.000 filas por respuesta y devuelve esas sin avisar. La
// tarjeta "Respuestas enviadas" de Yali decía exactamente 1.000 para la semana
// del 10 al 16 de septiembre; las reales eran 1.268, y "Conversaciones
// atendidas" decía 265 contra 329. El número redondo era la pista.
//
// Y había un segundo filo: como se leen las MÁS RECIENTES y el recorte por
// periodo viene después, cualquier corte más viejo que esas mil filas salía
// casi vacío.
//
// El Supabase falso de acá corta en mil, igual que el de verdad. Sin esa parte
// la prueba pasaría con el bug.

import { describe, expect, it, vi, beforeEach } from "vitest";

const TOPE_POSTGREST = 1000;

/** 2.109 turnos, que es lo que Yali tenía registrado ese día. */
const TOTAL = 2109;
const filas = Array.from({ length: TOTAL }, (_, i) => ({
  // Más nuevo primero, como los devuelve la consulta ordenada por ts desc.
  ts: new Date(Date.UTC(2026, 8, 16, 20) - i * 60_000).toISOString(),
  tenant: "yaly",
  wa_from: `5037${String(i % 557).padStart(7, "0")}`,
  wa_id: null,
  modelo: "claude-haiku-4-5",
  input_tokens: 1500,
  output_tokens: 90,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  tokens_texto: 0,
  tokens_imagen: 0,
  imagenes: 0,
  llamadas: 2,
  costo_entrada: 0.001,
  costo_salida: 0.0004,
  costo_cache_escritura: 0,
  costo_cache_lectura: 0,
  costo_texto: 0,
  costo_imagen: 0,
  costo_total: 0.0014,
  tipo: "respuesta",
}));

let paginasPedidas: Array<[number, number]> = [];

function supabaseFalso() {
  const consulta = () => {
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      order: () => api,
      range: (a: number, b: number) => {
        paginasPedidas.push([a, b]);
        // El corte de verdad: nunca más de mil por respuesta.
        const cuantas = Math.min(b - a + 1, TOPE_POSTGREST);
        return Promise.resolve({ data: filas.slice(a, a + cuantas), error: null });
      },
      limit: (n: number) => {
        // Lo que hacía el código viejo. Se deja para que quede claro que el
        // `.limit()` grande NO alcanza: devuelve mil igual.
        paginasPedidas.push([0, n - 1]);
        return Promise.resolve({ data: filas.slice(0, Math.min(n, TOPE_POSTGREST)), error: null });
      },
    };
    return api;
  };
  return { from: () => consulta() };
}

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => supabaseFalso(),
  esquemaDeTenant: (t?: string) => (t === "yaly" ? "yali" : "public"),
}));

beforeEach(() => {
  paginasPedidas = [];
  vi.resetModules();
});

describe("leer el consumo de un cliente", () => {
  it("trae TODAS las filas, no las primeras mil", async () => {
    const { detalleConsumo } = await import("@/lib/tokens-store");
    const leidas = await detalleConsumo("yaly", 5000);
    expect(leidas.length).toBe(TOTAL);
    expect(TOTAL).toBeGreaterThan(TOPE_POSTGREST);
  });

  it("las pide de a mil, que es lo máximo que devuelve la base", async () => {
    const { detalleConsumo } = await import("@/lib/tokens-store");
    await detalleConsumo("yaly", 5000);
    // Del esquema del cliente y del público: dos tandas de páginas.
    const tamanos = paginasPedidas.map(([a, b]) => b - a + 1);
    expect(tamanos.every((n) => n <= TOPE_POSTGREST)).toBe(true);
    expect(paginasPedidas.length).toBeGreaterThan(1);
  });

  it("respeta el tope que le piden", async () => {
    const { detalleConsumo } = await import("@/lib/tokens-store");
    const leidas = await detalleConsumo("yaly", 1500);
    // Lee de dos esquemas, así que el tope aplica a cada uno.
    expect(leidas.length).toBeLessThanOrEqual(3000);
    expect(leidas.length).toBeGreaterThan(TOPE_POSTGREST);
  });

  it("un tope chico sigue leyendo una sola página", async () => {
    const { detalleConsumo } = await import("@/lib/tokens-store");
    const leidas = await detalleConsumo("yaly", 50);
    expect(leidas.length).toBeLessThanOrEqual(100);
  });
});
