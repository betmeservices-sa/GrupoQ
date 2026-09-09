// "Ya tengo tiempo, me puede llamar" y el teléfono suena.
//
// Cada prueba de acá es un teléfono que suena en el bolsillo de alguien, o uno
// que NO suena. Los "no" importan más que los "sí": llamar a quien pidió que no
// lo llamen es el único error que el cliente va a recordar.

import { describe, expect, it } from "vitest";
import {
  AVISO_LLAMANDO,
  REPETIR_MIN,
  contextoDelChat,
  decidirLlamada,
  pideLlamada,
} from "@/lib/pedido-de-llamada";

describe("cuándo SÍ está pidiendo que lo llamen", () => {
  const si = [
    "ya tengo tiempo me puede llamar",
    "Ya tengo tiempo, me puede llamar", // el pedido tal como llegó
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
      "ya se le marcó hace poco",
      {
        hilo: [
          { direction: "out", texto: `Karla, con gusto: ${AVISO_LLAMANDO}.`, ts: haceMin(REPETIR_MIN - 5) },
          { direction: "in", texto: "me puede llamar", ts: haceMin(1) },
        ],
      },
      /ya se le marc/,
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

  it("pasado el tiempo de espera, un pedido nuevo SÍ vuelve a marcar", () => {
    const r = base({
      hilo: [
        { direction: "out", texto: `Karla, con gusto: ${AVISO_LLAMANDO}.`, ts: haceMin(REPETIR_MIN + 10) },
        { direction: "in", texto: "no me contestaron, me puede llamar de nuevo", ts: haceMin(1) },
      ],
    });
    expect(r.llamar).toBe(true);
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
