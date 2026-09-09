// La plantilla que abre el WhatsApp después de la llamada de CrediQ.
//
// Cada prueba de acá es un WhatsApp que le llega a una persona real, o uno que
// NO le llega. Los "no" importan más que los "sí": mandar de más es lo que hace
// que reporten el número, y encima cada plantilla se cobra.

import { describe, expect, it } from "vitest";
import {
  MARCA_TRAS_LLAMADA,
  decidirPlantilla,
  primerNombre,
  textoTrasLlamada,
} from "@/lib/plantilla-tras-llamada";

const AHORA = new Date("2026-09-09T20:00:00.000Z");
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString();

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

describe("cuándo SÍ se manda", () => {
  it("dijo que sí en la llamada y nunca nos ha escrito", () => {
    const r = base();
    expect(r.enviar).toBe(true);
    if (!r.enviar) return;
    expect(r.nombre).toBe("Karla");
    expect(r.plantilla).toBe("crediq_seguimiento_llamada");
    expect(r.texto).toContain(MARCA_TRAS_LLAMADA);
  });

  it("con la ventana ya vencida vuelve a ser la única vía", () => {
    const r = base({ hilo: [{ direction: "in", texto: "buenas", ts: haceHoras(30) }] });
    expect(r.enviar).toBe(true);
  });
});

describe("cuándo NO se manda nada", () => {
  const casos: Array<[string, Parameters<typeof base>[0], RegExp]> = [
    ["dijo que no en la llamada", { acepto: false }, /no acept/],
    ["el número no sirve", { telefono: "123" }, /sin n[úu]mero/],
    ["no sabemos cómo se llama", { nombre: null }, /nombre/],
    [
      "el agente transcribió un relleno en vez de un nombre",
      { nombre: "no especificado" },
      /nombre/,
    ],
    [
      "ya se le había mandado",
      { hilo: [{ direction: "out", texto: `Hola Karla! ... ${MARCA_TRAS_LLAMADA}. ...`, ts: haceHoras(48) }] },
      /ya se le hab[ií]a mandado/,
    ],
    [
      "la ventana de 24 h está abierta",
      { hilo: [{ direction: "in", texto: "hola", ts: haceHoras(2) }] },
      /ventana de 24/,
    ],
  ];

  for (const [que, extra, motivo] of casos) {
    it(que, () => {
      const r = base(extra);
      expect(r.enviar).toBe(false);
      if (r.enviar) return;
      expect(r.motivo).toMatch(motivo);
    });
  }

  it("no manda un segundo aunque hayan pasado meses", () => {
    // Insistir dos veces a quien no contestó es exactamente lo que hace que
    // reporten el número.
    const r = base({
      hilo: [{ direction: "out", texto: textoTrasLlamada("Karla"), ts: haceHoras(24 * 90) }],
    });
    expect(r.enviar).toBe(false);
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

  it("el texto es el cuerpo aprobado, sin cifras ni promesas nuevas", () => {
    const t = textoTrasLlamada("Karla");
    expect(t.startsWith("Hola Karla!")).toBe(true);
    expect(t).not.toMatch(/\$\s?\d/);
    // Si esto cambia, la plantilla en Meta también tiene que cambiar y volver a
    // aprobarse: Meta rechaza el envío si el cuerpo no es el aprobado.
    expect(t).toBe(
      "Hola Karla! Soy Sofía de CrediQ, le escribo para seguir con su solicitud, como quedamos en la llamada. ¿Le parece si continuamos por aquí?",
    );
  });
});
