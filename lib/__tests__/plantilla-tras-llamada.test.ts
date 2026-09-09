// Las dos plantillas de WhatsApp que salen tras la llamada de CrediQ.
//
// Cada prueba de acá es un WhatsApp que le llega a una persona real, o uno que
// NO le llega. Los "no" importan más que los "sí": mandar de más es lo que hace
// que reporten el número, y encima cada plantilla se cobra.

import { describe, expect, it } from "vitest";
import {
  CONTINUAR,
  ESPERA_MIN,
  REQUISITOS,
  decidirPlantilla,
  decidirRecordatorio,
  primerNombre,
} from "@/lib/plantilla-tras-llamada";

const AHORA = new Date("2026-09-09T20:00:00.000Z");
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString();
const salioRequisitos = (m: number) => ({
  direction: "out" as const,
  texto: REQUISITOS.texto("Karla"),
  ts: haceMin(m),
});

function base(extra: Partial<Parameters<typeof decidirPlantilla>[0]> = {}) {
  return decidirPlantilla({
    acepto: true,
    telefono: "50370020001",
    nombre: "Karla Menjívar",
    hilo: [],
    ahora: AHORA,
    ...extra,
  });
}

function recordar(extra: Partial<Parameters<typeof decidirRecordatorio>[0]> = {}) {
  return decidirRecordatorio({
    telefono: "50370020001",
    nombre: "Karla Menjívar",
    hilo: [salioRequisitos(ESPERA_MIN + 1)],
    ahora: AHORA,
    ...extra,
  });
}

describe("1. al colgar salen los REQUISITOS", () => {
  it("es esa plantilla y no otra", () => {
    const r = base();
    expect(r.enviar).toBe(true);
    if (!r.enviar) return;
    expect(r.plantilla).toBe("crediq_seguimiento_requisitos");
    expect(r.nombre).toBe("Karla");
    expect(r.texto).toContain("1. DUI por ambos lados");
    expect(r.texto.startsWith("Hola Karla!")).toBe(true);
  });

  const noSeManda: Array<[string, Parameters<typeof base>[0], RegExp]> = [
    ["dijo que no en la llamada", { acepto: false }, /no acept/],
    ["el número no sirve", { telefono: "123" }, /sin n[úu]mero/],
    ["no sabemos cómo se llama", { nombre: null }, /nombre/],
    ["el agente transcribió un relleno", { nombre: "no especificado" }, /nombre/],
    ["ya se le había mandado", { hilo: [salioRequisitos(60)] }, /ya se le hab[ií]a mandado/],
    [
      "la ventana de 24 h está abierta",
      { hilo: [{ direction: "in", texto: "hola", ts: haceMin(120) }] },
      /ventana de 24/,
    ],
  ];

  for (const [que, extra, motivo] of noSeManda) {
    it(`no se manda: ${que}`, () => {
      const r = base(extra);
      expect(r.enviar).toBe(false);
      if (r.enviar) return;
      expect(r.motivo).toMatch(motivo);
    });
  }
});

describe("2. a los 5 minutos, si no contestó, el recordatorio", () => {
  it("es la otra plantilla, la que NO repite la lista", () => {
    const r = recordar();
    expect(r.enviar).toBe(true);
    if (!r.enviar) return;
    expect(r.plantilla).toBe("crediq_continuar_solicitud");
    expect(r.texto).toContain("Empiece por el que tenga a la mano");
    // Repetirle los cuatro papeles a quien no contestó no aporta nada.
    expect(r.texto).not.toContain("1. DUI por ambos lados");
  });

  it("si CONTESTÓ, no se le manda nada", () => {
    // Aunque haya dicho solo "ok": la conversación ya está viva y ahí escribe
    // una persona o la IA, gratis y sin plantilla.
    const r = recordar({
      hilo: [salioRequisitos(ESPERA_MIN + 1), { direction: "in", texto: "ok", ts: haceMin(1) }],
    });
    expect(r.enviar).toBe(false);
    if (r.enviar) return;
    expect(r.motivo).toMatch(/s[íi] contest/);
  });

  it("todavía no pasan los 5 minutos", () => {
    const r = recordar({ hilo: [salioRequisitos(ESPERA_MIN - 1)] });
    expect(r.enviar).toBe(false);
    if (r.enviar) return;
    expect(r.motivo).toMatch(/pronto/);
  });

  it("ya pasó demasiado: no se le escribe de la nada", () => {
    const r = recordar({ hilo: [salioRequisitos(12 * 60)] });
    expect(r.enviar).toBe(false);
    if (r.enviar) return;
    expect(r.motivo).toMatch(/demasiado/);
  });

  it("nunca se le mandaron los requisitos", () => {
    const r = recordar({ hilo: [] });
    expect(r.enviar).toBe(false);
    if (r.enviar) return;
    expect(r.motivo).toMatch(/nunca se le mandaron/);
  });

  it("no hay un segundo recordatorio, nunca", () => {
    const r = recordar({
      hilo: [
        salioRequisitos(120),
        { direction: "out", texto: CONTINUAR.texto("Karla"), ts: haceMin(100) },
      ],
    });
    expect(r.enviar).toBe(false);
    if (r.enviar) return;
    expect(r.motivo).toMatch(/ya se le record/);
  });
});

describe("los cuerpos son los que Meta aprobó", () => {
  it("la marca con la que se reconoce cada uno está DENTRO de su cuerpo", () => {
    // Si esto se rompe, el sistema deja de ver que ya mandó una plantilla y la
    // manda de nuevo, o manda el recordatorio a quien nunca recibió la primera.
    expect(REQUISITOS.texto("Ana")).toContain(REQUISITOS.marca);
    expect(CONTINUAR.texto("Ana")).toContain(CONTINUAR.marca);
  });

  it("ninguno lleva cifras: no se cotiza por plantilla", () => {
    expect(REQUISITOS.texto("Ana")).not.toMatch(/\$\s?\d/);
    expect(CONTINUAR.texto("Ana")).not.toMatch(/\$\s?\d/);
  });

  it("las marcas no se confunden entre sí", () => {
    expect(REQUISITOS.texto("Ana")).not.toContain(CONTINUAR.marca);
    expect(CONTINUAR.texto("Ana")).not.toContain(REQUISITOS.marca);
  });
});

describe("el nombre", () => {
  it("usa solo el primero", () => {
    expect(primerNombre("Ana Cristina Reyes")).toBe("Ana");
    expect(primerNombre("Óscar Melgar")).toBe("Óscar");
  });

  it("descarta lo que no es un nombre", () => {
    for (const x of ["no especificado", "el cliente", "señor", "12345", "", null, "A"]) {
      expect(primerNombre(x), String(x)).toBe("");
    }
  });
});
