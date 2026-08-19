// El costo de transcribir se mide, no se estima.
//
// Gemini devuelve sus tokens en cada respuesta y antes los tirábamos: para
// saber cuánto costaba una nota de voz había que calcularlo a mano después, con
// la duración del audio. Ahora la fila queda guardada como cualquier otra.
//
// Lo que cuidan estas pruebas: que una transcripción NO se cuente como una
// respuesta del agente (inflaría el número que mira el dueño), que su costo se
// calcule con la tarifa de Gemini y no con la de Claude, y que igual sume al
// total, porque atender ese mensaje costó las dos cosas.
import { describe, it, expect } from "vitest";
import { resumirFilas } from "@/lib/tokens-store";
import { PRECIOS_POR_MILLON, USO_CERO, costoDeUso, tarifaDe } from "@/lib/tokens-precios";

// resumirFilas espera filas ya materializadas (con costo calculado), igual que
// las que arma el store al leer de la base.
function fila(over: {
  modelo: string;
  entrada: number;
  salida: number;
  tipo?: "respuesta" | "transcripcion";
}) {
  const uso = { ...USO_CERO, input_tokens: over.entrada, output_tokens: over.salida };
  const costo = costoDeUso(uso, over.modelo);
  return {
    ts: "2026-08-19T23:37:00.000Z",
    tenant: "yaly",
    waFrom: "50375391721",
    waId: null,
    modelo: over.modelo,
    uso,
    tokensImagen: 0,
    imagenes: 0,
    llamadas: 1,
    tipo: over.tipo ?? ("respuesta" as const),
    tokensTexto: over.entrada,
    costo,
    costoImagen: 0,
    costoTexto: costo.total,
  };
}

describe("tarifas de Gemini", () => {
  it("están declaradas junto a las de Claude", () => {
    expect(PRECIOS_POR_MILLON["gemini-3.5-flash-lite"]).toEqual({ input: 0.3, output: 2.5 });
    expect(tarifaDe("gemini-3.5-flash-lite")).toEqual({ input: 0.3, output: 2.5 });
  });

  it("una transcripción NO se cobra a precio de Claude", () => {
    const uso = { ...USO_CERO, input_tokens: 1000, output_tokens: 100 };
    const gemini = costoDeUso(uso, "gemini-3.5-flash-lite").total;
    const claude = costoDeUso(uso, "claude-haiku-4-5").total;
    expect(gemini).toBeLessThan(claude);
    // 1000 * 0.30/1M + 100 * 2.50/1M
    expect(gemini).toBeCloseTo(0.0003 + 0.00025, 8);
  });
});

describe("cómo suma una transcripción en el resumen", () => {
  const filas = [
    fila({ modelo: "claude-haiku-4-5", entrada: 10052, salida: 137 }),
    fila({ modelo: "gemini-3.5-flash-lite", entrada: 595, salida: 55, tipo: "transcripcion" }),
  ];
  const r = resumirFilas(filas);

  it("no se cuenta como una respuesta del agente", () => {
    expect(r.total.respuestas).toBe(1);
    expect(r.total.transcripciones).toBe(1);
  });

  it("su costo se ve aparte y también dentro del total", () => {
    const costoGemini = costoDeUso(filas[1].uso, "gemini-3.5-flash-lite").total;
    const costoClaude = costoDeUso(filas[0].uso, "claude-haiku-4-5").total;
    expect(r.total.costoTranscripcion).toBeCloseTo(costoGemini, 6);
    expect(r.total.costoTotal).toBeCloseTo(costoClaude + costoGemini, 6);
  });

  it("el corte por modelo muestra los dos, para saber qué pesa cada uno", () => {
    const modelos = r.modelos.map((m) => m.modelo).sort();
    expect(modelos).toEqual(["claude-haiku-4-5", "gemini-3.5-flash-lite"]);
  });

  it("sin transcripciones, los contadores nuevos quedan en cero", () => {
    const solo = resumirFilas([fila({ modelo: "claude-haiku-4-5", entrada: 100, salida: 10 })]);
    expect(solo.total.transcripciones).toBe(0);
    expect(solo.total.costoTranscripcion).toBe(0);
  });
});
