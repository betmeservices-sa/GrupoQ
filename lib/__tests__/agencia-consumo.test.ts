// El reporte de consumo que mira la agencia por cliente.
//
// Lo que cuidan estas pruebas: que "hoy", "ayer", la semana y el mes se corten
// en hora de El Salvador (no en UTC, que va 6 horas adelante), que las
// respuestas y las conversaciones se cuenten bien, que la caché se lea de las
// filas y que la comparación con el periodo anterior use el mismo tramo.
import { describe, it, expect } from "vitest";
import { canalDe, enmascarar, rangoDePeriodo, reporteConsumo } from "@/lib/agencia-consumo";
import type { FilaConsumo } from "@/lib/tokens-store";
import { USO_CERO, costoDeUso } from "@/lib/tokens-precios";

const MODELO = "claude-sonnet-4-5";

function fila(over: {
  ts: string;
  waFrom?: string;
  entrada?: number;
  salida?: number;
  cacheLectura?: number;
  cacheEscritura?: number;
  tipo?: "respuesta" | "transcripcion";
  modelo?: string;
}): FilaConsumo {
  const uso = {
    ...USO_CERO,
    input_tokens: over.entrada ?? 1000,
    output_tokens: over.salida ?? 200,
    cache_read_input_tokens: over.cacheLectura ?? 0,
    cache_creation_input_tokens: over.cacheEscritura ?? 0,
  };
  const modelo = over.modelo ?? MODELO;
  const costo = costoDeUso(uso, modelo);
  return {
    ts: over.ts,
    tenant: "yaly",
    waFrom: over.waFrom ?? "50375391721",
    waId: null,
    modelo,
    uso,
    tokensImagen: 0,
    imagenes: 0,
    llamadas: 1,
    tipo: over.tipo ?? "respuesta",
    tokensTexto: uso.input_tokens,
    costo,
    costoImagen: 0,
    costoTexto: costo.total,
  };
}

// Miércoles 2 de septiembre de 2026, 8:30 p.m. en El Salvador = 3 de sept 02:30 UTC.
const AHORA = new Date("2026-09-03T02:30:00.000Z");

describe("rangoDePeriodo (hora de El Salvador)", () => {
  it("hoy es el día de El Salvador aunque en UTC ya sea mañana", () => {
    const r = rangoDePeriodo("hoy", AHORA);
    expect(r.desde).toBe("2026-09-02T06:00:00.000Z");
    expect(r.hasta).toBe("2026-09-03T06:00:00.000Z");
    expect(r.granularidad).toBe("hora");
    expect(r.anterior).toEqual({ desde: "2026-09-01T06:00:00.000Z", hasta: "2026-09-02T02:30:00.000Z" });
  });

  it("ayer", () => {
    const r = rangoDePeriodo("ayer", AHORA);
    expect(r.desde).toBe("2026-09-01T06:00:00.000Z");
    expect(r.hasta).toBe("2026-09-02T06:00:00.000Z");
    expect(r.anterior).toEqual({ desde: "2026-08-31T06:00:00.000Z", hasta: "2026-09-01T06:00:00.000Z" });
  });

  it("la semana empieza el lunes y se compara con el mismo tramo de la anterior", () => {
    const r = rangoDePeriodo("semana", AHORA);
    expect(r.desde).toBe("2026-08-31T06:00:00.000Z"); // lunes 31 de agosto
    expect(r.hasta).toBe("2026-09-07T06:00:00.000Z");
    expect(r.granularidad).toBe("dia");
    // Transcurrieron 2 días y 20:30 h: el tramo anterior arranca el lunes 24 y llega hasta el mismo punto.
    expect(r.anterior).toEqual({ desde: "2026-08-24T06:00:00.000Z", hasta: "2026-08-27T02:30:00.000Z" });
  });

  it("semana pasada completa", () => {
    const r = rangoDePeriodo("semana_pasada", AHORA);
    expect(r.desde).toBe("2026-08-24T06:00:00.000Z");
    expect(r.hasta).toBe("2026-08-31T06:00:00.000Z");
    expect(r.anterior).toEqual({ desde: "2026-08-17T06:00:00.000Z", hasta: "2026-08-24T06:00:00.000Z" });
  });

  it("este mes y mes pasado", () => {
    const mes = rangoDePeriodo("mes", AHORA);
    expect(mes.desde).toBe("2026-09-01T06:00:00.000Z");
    expect(mes.hasta).toBe("2026-10-01T06:00:00.000Z");
    expect(mes.anterior.desde).toBe("2026-08-01T06:00:00.000Z");
    // Transcurrió 1 día y 20:30 h de septiembre: agosto se corta en el mismo punto.
    expect(mes.anterior.hasta).toBe("2026-08-03T02:30:00.000Z");

    const pasado = rangoDePeriodo("mes_pasado", AHORA);
    expect(pasado.desde).toBe("2026-08-01T06:00:00.000Z");
    expect(pasado.hasta).toBe("2026-09-01T06:00:00.000Z");
    expect(pasado.anterior).toEqual({ desde: "2026-07-01T06:00:00.000Z", hasta: "2026-08-01T06:00:00.000Z" });
  });

  it("7 y 30 días incluyen hoy", () => {
    const r7 = rangoDePeriodo("7d", AHORA);
    expect(r7.desde).toBe("2026-08-27T06:00:00.000Z");
    expect(r7.hasta).toBe("2026-09-03T06:00:00.000Z");
    const r30 = rangoDePeriodo("30d", AHORA);
    expect(r30.desde).toBe("2026-08-04T06:00:00.000Z");
    expect(r30.hasta).toBe("2026-09-03T06:00:00.000Z");
  });

  it("rango con fechas locales inclusivas; si viene mal cae a 7 días", () => {
    const r = rangoDePeriodo("rango", AHORA, "2026-08-10", "2026-08-11");
    expect(r.desde).toBe("2026-08-10T06:00:00.000Z");
    expect(r.hasta).toBe("2026-08-12T06:00:00.000Z");
    expect(r.granularidad).toBe("hora");
    expect(r.anterior).toEqual({ desde: "2026-08-08T06:00:00.000Z", hasta: "2026-08-10T06:00:00.000Z" });

    const malo = rangoDePeriodo("rango", AHORA, "2026-08-20", "2026-08-10");
    expect(malo.clave).toBe("7d");
  });
});

describe("reporteConsumo", () => {
  const filas = [
    // Hoy (2 de sept SV): dos conversaciones, 3 respuestas, una con caché.
    fila({ ts: "2026-09-02T14:00:00.000Z", waFrom: "50375391721", cacheLectura: 3000, entrada: 200 }),
    fila({ ts: "2026-09-02T14:05:00.000Z", waFrom: "50375391721" }),
    fila({ ts: "2026-09-03T01:00:00.000Z", waFrom: "instagram:17841400000012345" }),
    // Una transcripción hoy: suma costo pero no es respuesta.
    fila({ ts: "2026-09-03T01:01:00.000Z", waFrom: "50375391721", tipo: "transcripcion", modelo: "gemini-2.5-flash-lite", entrada: 500, salida: 50 }),
    // Ayer 9 a.m. SV: NO es de hoy, y cae en el tramo comparable (ayer hasta las 8:30 p.m.).
    fila({ ts: "2026-09-01T15:00:00.000Z", waFrom: "facebook:9876543210" }),
    // Ayer 11 p.m. SV (= hoy 05:00 UTC): tampoco es de hoy, y queda fuera del tramo comparable.
    fila({ ts: "2026-09-02T05:00:00.000Z", waFrom: "facebook:9876543210" }),
  ];

  it("cuenta respuestas, conversaciones y promedios solo del periodo, en hora local", () => {
    const rep = reporteConsumo(filas, rangoDePeriodo("hoy", AHORA), AHORA);
    expect(rep.actual.respuestas).toBe(3);
    expect(rep.actual.conversaciones).toBe(2);
    expect(rep.actual.respuestasPorConversacion).toBe(1.5);
    expect(rep.actual.transcripciones.cantidad).toBe(1);
    expect(rep.actual.costo).toBeCloseTo(filas.slice(0, 4).reduce((s, f) => s + f.costo.total, 0), 6);
    expect(rep.actual.costoPorRespuesta).toBeCloseTo(rep.actual.costo / 3, 6);
    expect(rep.actual.tokens.cacheLectura).toBe(3000);
    expect(rep.actual.tokens.entrada).toBe(200 + 3000 + 1000 + 1000 + 500);

    // Ayer hasta las 8:30 p.m. solo entra la respuesta de Facebook de las 9 a.m.
    expect(rep.anterior.respuestas).toBe(1);
    expect(rep.anterior.conversaciones).toBe(1);
  });

  it("lee la caché de las filas: encendida si las últimas respuestas la usaron", () => {
    const rep = reporteConsumo(filas, rangoDePeriodo("hoy", AHORA), AHORA);
    expect(rep.cache.encendida).toBe(true);
    expect(rep.cache.respuestasConCache).toBe(1);
    expect(rep.cache.respuestas).toBe(3);
    expect(rep.cache.ultimas).toEqual({ conCache: 1, total: 3 });
    // 3000 leídos de caché sobre 200+3000+1000+1000 de entrada de respuestas.
    expect(rep.cache.pctEntradaDesdeCache).toBe(58);

    const sinCache = reporteConsumo(filas, rangoDePeriodo("ayer", AHORA), AHORA);
    expect(sinCache.cache.encendida).toBe(false);

    const vacio = reporteConsumo(filas, rangoDePeriodo("semana_pasada", AHORA), AHORA);
    expect(vacio.cache.encendida).toBeNull();
    expect(vacio.actual.respuestas).toBe(0);
    expect(vacio.actual.costoPorRespuesta).toBe(0);
  });

  it("separa por canal y enmascara los contactos", () => {
    const rep = reporteConsumo(filas, rangoDePeriodo("hoy", AHORA), AHORA);
    expect(rep.canales.map((c) => [c.canal, c.respuestas, c.conversaciones])).toEqual([
      ["whatsapp", 2, 1],
      ["instagram", 1, 1],
    ]);
    expect(rep.conversaciones.map((c) => c.id)).toEqual(["+503 •••• 1721", "…12345"]);
    expect(rep.conversaciones[0].respuestas).toBe(2);
  });

  it("la serie de hoy va por hora y las filas caen en su hora de El Salvador", () => {
    const rep = reporteConsumo(filas, rangoDePeriodo("hoy", AHORA), AHORA);
    expect(rep.serie).toHaveLength(24);
    expect(rep.serie[0].etiqueta).toBe("12 a.m.");
    expect(rep.serie[8].etiqueta).toBe("8 a.m.");
    // 14:00 UTC = 8 a.m. SV; 01:00 UTC del 3 = 7 p.m. SV del 2.
    expect(rep.serie[8].respuestas).toBe(2);
    expect(rep.serie[19].respuestas).toBe(1);
    expect(rep.serie.reduce((s, p) => s + p.respuestas, 0)).toBe(3);
  });

  it("la serie de la semana va por día y no pasa de hoy", () => {
    const rep = reporteConsumo(filas, rangoDePeriodo("semana", AHORA), AHORA);
    expect(rep.serie.map((p) => p.etiqueta)).toEqual(["lun 31", "mar 1", "mié 2"]);
    expect(rep.serie[1].respuestas).toBe(2); // Facebook, martes 9 a.m. y 11 p.m.
    expect(rep.serie[2].respuestas).toBe(3);
  });
});

describe("canal y máscara", () => {
  it("clasifica por el prefijo", () => {
    expect(canalDe("50375391721")).toBe("whatsapp");
    expect(canalDe("instagram:123")).toBe("instagram");
    expect(canalDe("facebook:123")).toBe("facebook");
    expect(canalDe("lead-abc")).toBe("otro");
  });
  it("no expone el número completo", () => {
    expect(enmascarar("50375391721")).toBe("+503 •••• 1721");
    expect(enmascarar("instagram:17841400000012345")).toBe("…12345");
  });
});
