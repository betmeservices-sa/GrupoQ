import { describe, expect, it } from "vitest";
import { extraerScript, normalizarAgentes, type VapiAssistant, type VapiPhoneNumber } from "../vapi";
import { destinoRiesgoso, normalizarDestinoSV } from "../phone";

const assistants: VapiAssistant[] = [
  {
    id: "a1",
    name: "Sofía - Banco BetMe",
    firstMessage: "Buenas, le saluda Sofía.",
    model: {
      model: "gpt-5.4",
      messages: [
        { role: "system", content: "IDENTIDAD\nEres Sofía..." },
        { role: "user", content: "hola" },
      ],
    },
    voice: { provider: "11labs", voiceId: "qO4CS" },
  },
  // Sin numero apuntandole y sin system prompt: el caso que rompe la UI si no
  // se contempla (no se puede llamar desde el).
  { id: "a2", name: "Riley", model: { model: "gpt-4.1", messages: [] } },
];

const numeros: VapiPhoneNumber[] = [
  { id: "n1", number: "+50325054600", name: "BetMe Services", assistantId: "a1" },
  { id: "n2", number: "+50325054601", name: "Miagentia", assistantId: "otro" },
];

describe("extraerScript", () => {
  it("devuelve el contenido del mensaje system", () => {
    expect(extraerScript(assistants[0])).toBe("IDENTIDAD\nEres Sofía...");
  });

  it("devuelve cadena vacia cuando no hay mensaje system", () => {
    expect(extraerScript(assistants[1])).toBe("");
  });
});

describe("normalizarAgentes", () => {
  it("liga cada agente solo con los numeros que le apuntan", () => {
    const [a1, a2] = normalizarAgentes(assistants, numeros);
    expect(a1.numeros).toEqual([{ id: "n1", numero: "+50325054600", nombre: "BetMe Services" }]);
    expect(a2.numeros).toEqual([]);
  });

  it("arma modelo, voz y script legibles", () => {
    const [a1] = normalizarAgentes(assistants, numeros);
    expect(a1.modelo).toBe("gpt-5.4");
    expect(a1.voz).toBe("11labs / qO4CS");
    expect(a1.script).toContain("Eres Sofía");
  });

  it("no revienta con un assistant sin nombre", () => {
    const [a] = normalizarAgentes([{ id: "x" }], []);
    expect(a.nombre).toBe("(sin nombre)");
    expect(a.script).toBe("");
  });
});

describe("normalizarDestinoSV", () => {
  it("acepta 8 digitos locales y les pone el +503", () => {
    expect(normalizarDestinoSV("75391721")).toBe("+50375391721");
  });

  it("ignora espacios, guiones y el prefijo ya puesto", () => {
    expect(normalizarDestinoSV("7539 1721")).toBe("+50375391721");
    expect(normalizarDestinoSV("7539-1721")).toBe("+50375391721");
    expect(normalizarDestinoSV("+503 7539 1721")).toBe("+50375391721");
    expect(normalizarDestinoSV("50375391721")).toBe("+50375391721");
  });

  it("rechaza largos incorrectos y prefijos no marcables en SV", () => {
    expect(normalizarDestinoSV("753917")).toBeNull();
    expect(normalizarDestinoSV("753917211")).toBeNull();
    expect(normalizarDestinoSV("35391721")).toBeNull(); // no empieza en 2, 6 ni 7
    expect(normalizarDestinoSV("")).toBeNull();
  });
});

describe("destinoRiesgoso", () => {
  it("marca el rango 6, que hoy no termina por el trunk", () => {
    expect(destinoRiesgoso("+50361611519")).toBe(true);
  });

  it("no marca el rango 7 ni los fijos", () => {
    expect(destinoRiesgoso("+50378887308")).toBe(false);
    expect(destinoRiesgoso("+50325054600")).toBe(false);
  });
});
