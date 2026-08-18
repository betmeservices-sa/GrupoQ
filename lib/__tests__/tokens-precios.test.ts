// Aritmética del consumo de la IA. Los cuatro campos de `usage` se cobran
// distinto, y el error clásico es tratar `input_tokens` como si fuera el prompt
// completo. Estas pruebas fijan las tarifas y ese reparto.
import { describe, it, expect } from "vitest";
import {
  MULT_CACHE_ESCRITURA_1H,
  MULT_CACHE_ESCRITURA_5M,
  MULT_CACHE_LECTURA,
  PRECIOS_POR_MILLON,
  PROMO_SONNET_5,
  USO_CERO,
  costoDeImagen,
  costoDeUso,
  fmtCosto,
  fmtTokens,
  repartirCosto,
  sumarUso,
  tarifaDe,
  tokensPrompt,
  tokensTotales,
  type UsoTokens,
} from "@/lib/tokens-precios";
import { borrarConsumo, registrarConsumo, resumenConsumo, resumirFilas } from "@/lib/tokens-store";

function uso(over: Partial<UsoTokens> = {}): UsoTokens {
  return { ...USO_CERO, ...over };
}

describe("tarifas por millón de tokens", () => {
  it("son las de la API de Anthropic", () => {
    expect(PRECIOS_POR_MILLON["claude-haiku-4-5"]).toEqual({ input: 1, output: 5 });
    expect(PRECIOS_POR_MILLON["claude-sonnet-5"]).toEqual({ input: 3, output: 15 });
    expect(PRECIOS_POR_MILLON["claude-opus-5"]).toEqual({ input: 5, output: 25 });
  });

  it("los multiplicadores de caché son 1.25x, 2x y 0.1x", () => {
    expect(MULT_CACHE_ESCRITURA_5M).toBe(1.25);
    expect(MULT_CACHE_ESCRITURA_1H).toBe(2);
    expect(MULT_CACHE_LECTURA).toBe(0.1);
  });

  it("un id con fecha resuelve a la tarifa de su familia", () => {
    expect(tarifaDe("claude-haiku-4-5-20260101")).toEqual({ input: 1, output: 5 });
    expect(tarifaDe("CLAUDE-HAIKU-4-5")).toEqual({ input: 1, output: 5 });
  });

  it("un modelo desconocido NO se cobra a ojo: devuelve null", () => {
    expect(tarifaDe("modelo-inventado")).toBeNull();
    expect(tarifaDe("")).toBeNull();
    const c = costoDeUso(uso({ input_tokens: 1_000_000 }), "modelo-inventado");
    expect(c.total).toBe(0);
    expect(c.tarifaConocida).toBe(false);
  });

  it("la promo de Sonnet 5 aplica hasta el 31 de agosto de 2026 y después no", () => {
    expect(tarifaDe("claude-sonnet-5", new Date("2026-08-15T00:00:00Z"))).toEqual(
      PROMO_SONNET_5.tarifa,
    );
    expect(tarifaDe("claude-sonnet-5", new Date("2026-08-31T23:00:00Z"))).toEqual({
      input: 2,
      output: 10,
    });
    expect(tarifaDe("claude-sonnet-5", new Date("2026-09-01T00:00:00Z"))).toEqual({
      input: 3,
      output: 15,
    });
  });

  it("la promo es solo de Sonnet 5", () => {
    expect(tarifaDe("claude-opus-5", new Date("2026-08-15T00:00:00Z"))).toEqual({
      input: 5,
      output: 25,
    });
  });
});

describe("tokens del prompt", () => {
  // El error clásico: reportar input_tokens como si fuera todo el prompt.
  it("el prompt es input + escritura de caché + lectura de caché", () => {
    const u = uso({
      input_tokens: 100,
      cache_creation_input_tokens: 400,
      cache_read_input_tokens: 1500,
      output_tokens: 80,
    });
    expect(tokensPrompt(u)).toBe(2000);
    expect(tokensPrompt(u)).not.toBe(u.input_tokens);
    expect(tokensTotales(u)).toBe(2080);
  });

  // La API declara los campos de caché como `number | null`: si eso llegara
  // crudo a la suma, el total se volvería NaN y el dashboard mostraría "—".
  it("un usage con nulls no rompe la suma", () => {
    const crudo = {
      input_tokens: 120,
      output_tokens: 40,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    } as unknown as Partial<UsoTokens>;
    const total = sumarUso(USO_CERO, crudo);
    expect(total.cache_creation_input_tokens).toBe(0);
    expect(total.cache_read_input_tokens).toBe(0);
    expect(Number.isNaN(tokensPrompt(total))).toBe(false);
    expect(tokensPrompt(total)).toBe(120);
  });

  it("suma dos usos campo por campo", () => {
    const a = uso({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2 });
    const b = uso({ input_tokens: 3, cache_creation_input_tokens: 7 });
    expect(sumarUso(a, b)).toEqual({
      input_tokens: 13,
      output_tokens: 5,
      cache_creation_input_tokens: 7,
      cache_read_input_tokens: 2,
    });
    expect(sumarUso(a, null)).toEqual(a);
  });
});

describe("dinero", () => {
  it("un millón de tokens de entrada en Haiku cuesta un dólar", () => {
    const c = costoDeUso(uso({ input_tokens: 1_000_000 }), "claude-haiku-4-5");
    expect(c.entrada).toBe(1);
    expect(c.total).toBe(1);
  });

  it("la salida de Haiku vale cinco veces la entrada", () => {
    const c = costoDeUso(uso({ output_tokens: 1_000_000 }), "claude-haiku-4-5");
    expect(c.salida).toBe(5);
  });

  it("escribir caché cuesta 1.25x la entrada, y con TTL de 1 hora 2x", () => {
    const u = uso({ cache_creation_input_tokens: 1_000_000 });
    expect(costoDeUso(u, "claude-haiku-4-5").cacheEscritura).toBe(1.25);
    expect(costoDeUso(u, "claude-haiku-4-5", { ttlCache: "1h" }).cacheEscritura).toBe(2);
  });

  it("leer caché cuesta 0.1x la entrada", () => {
    const c = costoDeUso(uso({ cache_read_input_tokens: 1_000_000 }), "claude-haiku-4-5");
    expect(c.cacheLectura).toBeCloseTo(0.1, 6);
  });

  it("el total suma las cuatro líneas", () => {
    const u = uso({
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
    });
    const c = costoDeUso(u, "claude-haiku-4-5");
    expect(c.total).toBeCloseTo(1 + 5 + 1.25 + 0.1, 6);
  });

  it("una respuesta típica de WhatsApp cuesta millonésimas, y se ve", () => {
    const c = costoDeUso(uso({ input_tokens: 1800, output_tokens: 120 }), "claude-haiku-4-5");
    expect(c.total).toBeCloseTo(0.0018 + 0.0006, 8);
    expect(fmtCosto(c.total)).toBe("$0.00240");
  });
});

describe("separar el costo de las imágenes", () => {
  // Las imágenes no tienen línea propia en la factura: entran como tokens de
  // entrada. El desglose que se muestra en el dashboard sale de valorizar los
  // tokens de imagen al precio de entrada.
  it("una imagen se cobra al precio de ENTRADA, no al de salida", () => {
    expect(costoDeImagen(1_000_000, "claude-haiku-4-5")).toBe(1);
    expect(costoDeImagen(1600, "claude-haiku-4-5")).toBeCloseTo(0.0016, 8);
  });

  it("sin imagen no hay costo de imagen", () => {
    expect(costoDeImagen(0, "claude-haiku-4-5")).toBe(0);
    expect(costoDeImagen(-5, "claude-haiku-4-5")).toBe(0);
  });

  it("el reparto texto + imagen suma exactamente el total", () => {
    const u = uso({ input_tokens: 3400, output_tokens: 150 });
    const { costo, costoTexto, costoImagen } = repartirCosto(u, 1600, "claude-haiku-4-5");
    expect(costoImagen).toBeCloseTo(0.0016, 8);
    expect(costoTexto + costoImagen).toBeCloseTo(costo.total, 8);
    expect(costoTexto).toBeGreaterThan(0);
  });

  it("el costo de imagen nunca supera el total (no deja el texto en negativo)", () => {
    const { costoTexto, costoImagen, costo } = repartirCosto(
      uso({ input_tokens: 100 }),
      999_999,
      "claude-haiku-4-5",
    );
    expect(costoImagen).toBeLessThanOrEqual(costo.total);
    expect(costoTexto).toBeGreaterThanOrEqual(0);
  });
});

describe("agregación para el dashboard", () => {
  const filas = [
    {
      ts: "2026-08-17T10:00:00.000Z",
      tenant: "yaly",
      waFrom: "50370000001",
      modelo: "claude-haiku-4-5",
      uso: uso({ input_tokens: 2000, output_tokens: 100 }),
      tokensImagen: 0,
      imagenes: 0,
      llamadas: 1,
      tokensTexto: 2000,
      costo: costoDeUso(uso({ input_tokens: 2000, output_tokens: 100 }), "claude-haiku-4-5"),
      costoImagen: 0,
      costoTexto: 0.0025,
    },
    {
      ts: "2026-08-17T10:05:00.000Z",
      tenant: "yaly",
      waFrom: "50370000001",
      modelo: "claude-haiku-4-5",
      uso: uso({ input_tokens: 3600, output_tokens: 120 }),
      tokensImagen: 1600,
      imagenes: 1,
      llamadas: 1,
      tokensTexto: 2000,
      costo: costoDeUso(uso({ input_tokens: 3600, output_tokens: 120 }), "claude-haiku-4-5"),
      costoImagen: 0.0016,
      costoTexto: 0.0026,
    },
    {
      ts: "2026-08-17T11:00:00.000Z",
      tenant: "yaly",
      waFrom: "50370000002",
      modelo: "claude-sonnet-5",
      uso: uso({ input_tokens: 1000, output_tokens: 50 }),
      tokensImagen: 0,
      imagenes: 0,
      llamadas: 2,
      tokensTexto: 1000,
      costo: costoDeUso(uso({ input_tokens: 1000, output_tokens: 50 }), "claude-sonnet-5"),
      costoImagen: 0,
      costoTexto: 0.0025,
    },
  ];

  it("agrega totales, y el desglose texto/imagen cuadra", () => {
    const r = resumirFilas(filas);
    expect(r.total.respuestas).toBe(3);
    expect(r.total.llamadas).toBe(4);
    expect(r.total.imagenes).toBe(1);
    expect(r.total.tokensImagen).toBe(1600);
    expect(r.total.tokensTexto).toBe(5000);
    expect(r.total.tokensPrompt).toBe(6600);
    expect(r.total.tokensSalida).toBe(270);
  });

  it("una línea por conversación, ordenadas por costo", () => {
    const r = resumirFilas(filas);
    expect(r.conversaciones).toHaveLength(2);
    expect(r.conversaciones[0].waFrom).toBe("50370000001");
    expect(r.conversaciones[0].respuestas).toBe(2);
    expect(r.conversaciones[0].imagenes).toBe(1);
    expect(r.conversaciones[0].costoTotal).toBeGreaterThan(
      r.conversaciones[1].costoTotal,
    );
  });

  // Si mañana cambia AI_MODEL, el histórico tiene que seguir mostrando con qué
  // modelo se generó cada respuesta.
  it("guarda el modelo de cada conversación y agrupa por modelo", () => {
    const r = resumirFilas(filas);
    expect(r.conversaciones[0].modelos).toEqual(["claude-haiku-4-5"]);
    expect(r.modelos.map((m) => m.modelo).sort()).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-5",
    ]);
  });

  it("sin filas no revienta ni inventa números", () => {
    const r = resumirFilas([]);
    expect(r.total.respuestas).toBe(0);
    expect(r.total.costoTotal).toBe(0);
    expect(r.conversaciones).toEqual([]);
  });
});

// Ida y vuelta por el store: es donde se calcula el costo a partir del usage
// crudo. Sin Supabase configurado usa el respaldo en memoria, que es justo lo
// que corre en local.
describe("guardar y leer el consumo", () => {
  it("una respuesta con foto se guarda con su desglose y se lee agregada", async () => {
    await borrarConsumo();
    await registrarConsumo({
      ts: "2026-08-17T12:00:00.000Z",
      tenant: "yaly",
      waFrom: "50370000009",
      waId: "wamid.abc",
      modelo: "claude-haiku-4-5",
      uso: {
        input_tokens: 3400,
        output_tokens: 150,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      tokensImagen: 1600,
      imagenes: 1,
      llamadas: 1,
    });

    const r = await resumenConsumo("yaly");
    expect(r.total.respuestas).toBe(1);
    expect(r.total.imagenes).toBe(1);
    expect(r.total.tokensPrompt).toBe(3400);
    expect(r.total.tokensImagen).toBe(1600);
    expect(r.total.tokensTexto).toBe(1800); // 3400 del prompt menos la foto
    // 3400 entrada a $1/M + 150 salida a $5/M = 0.0034 + 0.00075
    expect(r.total.costoTotal).toBeCloseTo(0.004150, 8);
    expect(r.total.costoImagen).toBeCloseTo(0.0016, 8);
    expect(r.total.costoTexto).toBeCloseTo(0.004150 - 0.0016, 8);
    expect(r.conversaciones[0].waFrom).toBe("50370000009");
    expect(r.conversaciones[0].modelos).toEqual(["claude-haiku-4-5"]);
  });

  it("el consumo de un cliente no se mezcla con el de otro", async () => {
    await borrarConsumo();
    const base = {
      ts: "2026-08-17T12:00:00.000Z",
      modelo: "claude-haiku-4-5",
      uso: {
        input_tokens: 1000,
        output_tokens: 10,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      tokensImagen: 0,
      imagenes: 0,
      llamadas: 1,
    };
    await registrarConsumo({ ...base, tenant: "yaly", waFrom: "1" });
    await registrarConsumo({ ...base, tenant: "grupoq", waFrom: "2" });

    expect((await resumenConsumo("yaly")).total.respuestas).toBe(1);
    expect((await resumenConsumo("grupoq")).total.respuestas).toBe(1);
    expect((await resumenConsumo()).total.respuestas).toBe(2);
    await borrarConsumo("yaly");
    expect((await resumenConsumo("yaly")).total.respuestas).toBe(0);
    expect((await resumenConsumo("grupoq")).total.respuestas).toBe(1);
  });
});

describe("formato", () => {
  it("los montos micro se ven con cinco decimales y los grandes con dos", () => {
    expect(fmtCosto(0)).toBe("$0.00");
    expect(fmtCosto(0.0000123)).toBe("$0.00001");
    expect(fmtCosto(0.5)).toBe("$0.5000");
    expect(fmtCosto(12.3456)).toBe("$12.35");
    expect(fmtCosto(null)).toBe("—");
  });

  it("los tokens llevan separador de miles", () => {
    expect(fmtTokens(1234567)).toMatch(/1.234.567|1,234,567/);
    expect(fmtTokens(null)).toBe("—");
  });
});
