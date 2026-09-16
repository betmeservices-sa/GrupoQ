// "Ya tengo tiempo, me puede llamar" y el teléfono suena.
//
// Cada prueba de acá es un teléfono que suena en el bolsillo de alguien, o uno
// que NO suena. Los "no" importan más que los "sí": llamar a quien pidió que no
// lo llamen es el único error que el cliente va a recordar.

import { describe, expect, it } from "vitest";
import {
  AVISO_LLAMANDO,
  PREGUNTA_VOLVER,
  contextoDelChat,
  decidirLlamada,
  intencionDeLlamada,
  pideLlamada,
} from "@/lib/pedido-de-llamada";
import { CONTINUAR, REQUISITOS, esPlantillaCrediQ } from "@/lib/plantilla-tras-llamada";

describe("cuándo SÍ está pidiendo que lo llamen", () => {
  const si = [
    "ya tengo tiempo me puede llamar",
    "Ya tengo tiempo, me puede llamar", // el pedido tal como llegó
    "llamame ahora tengo tiempo",
    "llámame ahora, tengo tiempo",
    "llámenme ahora que tengo tiempo",
    "me pude llamar?", // el error de dedo, que es como se escribe de verdad
    "¿me pueden llamar?",
    "me podría llamar más tarde",
    "puede llamarme",
    "pueden marcarme",
    "llámenme por favor",
    "llameme",
    "márqueme cuando pueda",
    "me marca porfa",
    "quiero que me llamen",
    "prefiero que me llamen",
    "hablemos por teléfono",
    "ya salí de la reunión, podemos hablar",
    "ahora sí puedo hablar",
    "estoy libre, podemos hablar",
  ];
  for (const t of si) {
    it(JSON.stringify(t), () => expect(pideLlamada(t)).toBe(true));
  }
});

describe("cuándo NO, aunque lo parezca", () => {
  const no = [
    // Lo dijo al revés. Este es el que no se puede fallar.
    ["no me llamen", "negado"],
    ["no me llame por favor", "negado"],
    ["por favor ya no me llamen", "negado"],
    ["no vuelvan a llamarme", "negado"],
    ["dejen de llamar", "negado"],
    ["no quiero que me llamen", "negado"],
    ["mejor por aquí", "prefiere escribir"],
    ["prefiero por whatsapp", "prefiere escribir"],
    ["mejor por mensaje, no puedo hablar", "prefiere escribir"],
    // Ya pasó. No lo está pidiendo, lo está contando.
    ["ya me llamaron gracias", "pasado"],
    ["me llamaron ahorita", "pasado"],
    ["me acaban de llamar", "pasado"],
    ["ya me llamó la señorita", "pasado"],
    // Se esta presentando, no pidiendo nada. Es el falso positivo mas facil de
    // cometer: la frase lleva "me llam" igual que el pedido.
    ["me llamo Karla", "se presenta"],
    ["hola, me llamo Jorge Bonilla", "se presenta"],
    // Nada que ver.
    ["hola buenas tardes", "saludo"],
    ["cuánto cuesta el tucson", "consulta"],
    ["ya tengo tiempo esperando", "no pide nada"],
    ["", "vacío"],
  ] as const;
  for (const [t, por] of no) {
    it(`${por}: ${JSON.stringify(t)}`, () => expect(pideLlamada(t)).toBe(false));
  }
});

const AHORA = new Date("2026-09-09T20:00:00.000Z"); // 14:00 en El Salvador
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString();

function base(extra: Partial<Parameters<typeof decidirLlamada>[0]> = {}) {
  return decidirLlamada({
    texto: "ya tengo tiempo, me puede llamar",
    telefono: "50370020001",
    nombre: "Karla Menjívar",
    hilo: [{ direction: "in", texto: "ya tengo tiempo, me puede llamar", ts: haceMin(1) }],
    sinDueno: true,
    ahora: AHORA,
    horaLocal: 14,
    ...extra,
  });
}

describe("la decisión de marcar", () => {
  it("marca, con su nombre y sin presentarse desde cero", () => {
    const r = base();
    expect(r.llamar).toBe(true);
    if (!r.llamar) return;
    expect(r.primerMensaje).toContain("Karla");
    expect(r.primerMensaje).toContain("como me pidió por WhatsApp");
    expect(r.aviso).toContain(AVISO_LLAMANDO);
  });

  it("sin nombre marca igual, pero no lo inventa", () => {
    const r = base({ nombre: null });
    expect(r.llamar).toBe(true);
    if (!r.llamar) return;
    expect(r.primerMensaje.startsWith("Buenas,")).toBe(true);
  });

  const noMarca: Array<[string, Parameters<typeof base>[0], RegExp]> = [
    ["no lo pidió", { texto: "gracias" }, /no pidi/],
    ["el número no sirve", { telefono: "123" }, /sin n[úu]mero/],
    ["el chat lo tiene una persona", { sinDueno: false }, /le toca a ella/],
    ["de madrugada", { horaLocal: 3 }, /fuera de horario/],
    ["ya de noche", { horaLocal: 21 }, /fuera de horario/],
    [
      "el mismo mensaje entregado dos veces por Meta",
      {
        hilo: [
          { direction: "in", texto: "ya tengo tiempo, me puede llamar", ts: haceMin(2) },
          { direction: "out", texto: `Karla, con gusto: ${AVISO_LLAMANDO}.`, ts: haceMin(1) },
        ],
      },
      /ya se atendi/,
    ],
  ];
  for (const [que, extra, motivo] of noMarca) {
    it(`no marca: ${que}`, () => {
      const r = base(extra);
      expect(r.llamar).toBe(false);
      if (r.llamar) return;
      expect(r.motivo).toMatch(motivo);
    });
  }

  it("no contestó y a los 3 minutos vuelve a pedir: SÍ marca", () => {
    const r = base({
      texto: "Ya puedo hablar",
      hilo: [
        { direction: "in", texto: "me puede llamar", ts: haceMin(5) },
        { direction: "out", texto: `Omar, con gusto: ${AVISO_LLAMANDO}.`, ts: haceMin(4) },
        { direction: "in", texto: "Ya puedo hablar", ts: haceMin(1) },
      ],
    });
    expect(r.llamar).toBe(true);
  });
});

describe("cuando cuenta que la llamada no se completó", () => {
  const preguntar = [
    "no me contestaron",
    "No me contestaron 😕",
    "me llamaron y no pude contestar",
    "no alcancé a contestar",
    "no me entró la llamada",
    "se cortó la llamada",
    "tengo una llamada perdida de ustedes",
    "¿quién me llamó?",
  ];
  for (const t of preguntar) {
    it(`pregunta: ${JSON.stringify(t)}`, () => expect(intencionDeLlamada(t)).toBe("preguntar"));
  }

  it("si además pide que lo llamen, se llama directo", () => {
    expect(intencionDeLlamada("no me contestaron, me puede llamar de nuevo")).toBe("llamar");
    expect(intencionDeLlamada("se cortó la llamada, llámeme")).toBe("llamar");
  });

  it("le pregunta por escrito, con su nombre, y no marca", () => {
    const r = base({
      texto: "no me contestaron",
      hilo: [{ direction: "in", texto: "no me contestaron", ts: haceMin(1) }],
    });
    expect(r.llamar).toBe(false);
    if (r.llamar) return;
    expect(r.pregunta).toBe(`No se preocupe, Karla. ${PREGUNTA_VOLVER}`);
  });

  it("contesta que sí a la pregunta: marca", () => {
    for (const si of ["sí", "Si por favor", "claro que sí", "dale", "ok", "sí, ahorita"]) {
      const r = base({
        texto: si,
        hilo: [
          { direction: "in", texto: "no me contestaron", ts: haceMin(3) },
          { direction: "out", texto: `No se preocupe, Karla. ${PREGUNTA_VOLVER}`, ts: haceMin(2) },
          { direction: "in", texto: si, ts: haceMin(1) },
        ],
      });
      expect(r.llamar, si).toBe(true);
    }
  });

  it("un sí que no contesta la pregunta, o un sí para más tarde, no marca", () => {
    const sinPregunta = base({
      texto: "sí",
      hilo: [
        { direction: "out", texto: "¿Le interesa el Kicks?", ts: haceMin(2) },
        { direction: "in", texto: "sí", ts: haceMin(1) },
      ],
    });
    expect(sinPregunta.llamar).toBe(false);

    const masTarde = base({
      texto: "sí pero más tarde",
      hilo: [
        { direction: "out", texto: `No se preocupe, Karla. ${PREGUNTA_VOLVER}`, ts: haceMin(2) },
        { direction: "in", texto: "sí pero más tarde", ts: haceMin(1) },
      ],
    });
    expect(masTarde.llamar).toBe(false);
  });

  it("el mismo mensaje repetido por Meta no pregunta dos veces", () => {
    const r = base({
      texto: "no me contestaron",
      hilo: [
        { direction: "in", texto: "no me contestaron", ts: haceMin(2) },
        { direction: "out", texto: `No se preocupe, Karla. ${PREGUNTA_VOLVER}`, ts: haceMin(1) },
      ],
    });
    expect(r.llamar).toBe(false);
    if (r.llamar) return;
    expect(r.pregunta).toBeUndefined();
  });
});

describe("plantillas de CrediQ en el hilo", () => {
  it("reconoce las dos automáticas y la mandada a mano sin texto", () => {
    expect(esPlantillaCrediQ(REQUISITOS.texto("Omar"))).toBe(true);
    expect(esPlantillaCrediQ(CONTINUAR.texto("Omar"))).toBe(true);
    expect(esPlantillaCrediQ("[plantilla: crediq_seguimiento_llamada]")).toBe(true);
  });

  it("una respuesta de Sofía que nombra CrediQ no es la plantilla", () => {
    expect(esPlantillaCrediQ("El financiamiento es con CrediQ, la financiera de Grupo Q.")).toBe(false);
  });
});

describe("el contexto que se lleva la llamada", () => {
  const hilo = [
    { direction: "in" as const, texto: "hola, quiero información del Tucson", ts: haceMin(60) },
    { direction: "out" as const, texto: "Con gusto. ¿Para financiamiento o de contado?", ts: haceMin(59) },
    { direction: "in" as const, texto: "financiamiento, como de 20 mil", ts: haceMin(58) },
    { direction: "in" as const, texto: "ya tengo tiempo, me puede llamar", ts: haceMin(1) },
  ];

  it("va el diálogo real, no un resumen inventado por nosotros", () => {
    const c = contextoDelChat(hilo);
    expect(c).toContain("Cliente: hola, quiero información del Tucson");
    expect(c).toContain("Nosotros: Con gusto. ¿Para financiamiento o de contado?");
    expect(c).toContain("Cliente: financiamiento, como de 20 mil");
  });

  it("del más viejo al más nuevo, como se leyó", () => {
    const c = contextoDelChat(hilo);
    expect(c.indexOf("Tucson")).toBeLessThan(c.indexOf("20 mil"));
  });

  it("cuando no cabe todo, sobrevive lo RECIENTE", () => {
    // Lo último que se habló es lo que la persona tiene fresco. Recortar por el
    // final dejaría al agente hablando de algo de hace una semana.
    const largo = Array.from({ length: 40 }, (_, i) => ({
      direction: "in" as const,
      texto: `mensaje viejo numero ${i} con relleno para ocupar espacio de sobra`,
      ts: new Date(AHORA.getTime() - (100 - i) * 60_000).toISOString(),
    }));
    const c = contextoDelChat([...largo, hilo[3]], 300);
    expect(c.length).toBeLessThanOrEqual(300);
    expect(c).toContain("ya tengo tiempo");
    expect(c).not.toContain("numero 0 ");
  });

  it("los mensajes vacíos no ensucian el contexto", () => {
    const c = contextoDelChat([
      { direction: "in", texto: "  ", ts: haceMin(5) },
      { direction: "in", texto: "llámenme", ts: haceMin(1) },
    ]);
    expect(c).toBe("Cliente: llámenme");
  });

  it("la llamada lo lleva puesto", () => {
    const r = base({ hilo });
    expect(r.llamar).toBe(true);
    if (!r.llamar) return;
    expect(r.contexto).toContain("financiamiento, como de 20 mil");
  });
});
