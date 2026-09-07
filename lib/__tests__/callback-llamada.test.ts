// La llamada de vuelta se agenda con lo que dijo alguien por teléfono y lo que
// entendió un modelo, o sea con datos sucios. Lo que se prueba acá es que nada
// de eso termine en una llamada a deshora: minutos en texto, argumentos que
// llegan como JSON pegado, o un "llámeme mañana" que se convierte en un tope.
import { describe, expect, it } from "vitest";
import {
  buscarToolCall,
  confirmacion,
  cuandoLlamar,
  MINUTOS_DEFECTO,
  MINUTOS_MAX,
  minutosPedidos,
} from "../callback-llamada";

describe("los minutos que pidió", () => {
  it("toma el número tal cual", () => {
    expect(minutosPedidos(2)).toBe(2);
    expect(minutosPedidos(30)).toBe(30);
  });

  it("acepta el número en texto, que es como suele mandarlo el modelo", () => {
    expect(minutosPedidos("15")).toBe(15);
    expect(minutosPedidos(" 45 ")).toBe(45);
    expect(minutosPedidos("2.5")).toBe(3);
  });

  it("sin dato usable, cae en el rato por defecto", () => {
    expect(minutosPedidos(undefined)).toBe(MINUTOS_DEFECTO);
    expect(minutosPedidos("ahorita")).toBe(MINUTOS_DEFECTO);
    expect(minutosPedidos(null)).toBe(MINUTOS_DEFECTO);
    expect(minutosPedidos(0)).toBe(MINUTOS_DEFECTO);
    expect(minutosPedidos(-10)).toBe(MINUTOS_DEFECTO);
  });

  it("no agenda más allá del tope: arriba de eso se entendió mal", () => {
    expect(minutosPedidos(5000)).toBe(MINUTOS_MAX);
  });
});

describe("cuándo toca", () => {
  it("suma los minutos y lo deja en ISO", () => {
    const ahora = Date.parse("2026-09-07T15:00:00.000Z");
    expect(cuandoLlamar(2, ahora)).toBe("2026-09-07T15:02:00.000Z");
    expect(cuandoLlamar(90, ahora)).toBe("2026-09-07T16:30:00.000Z");
  });
});

describe("lo que se le contesta al agente", () => {
  it("habla en minutos abajo de la hora y en horas arriba", () => {
    expect(confirmacion(1)).toContain("un minuto");
    expect(confirmacion(2)).toContain("2 minutos");
    expect(confirmacion(60)).toContain("una hora");
    expect(confirmacion(120)).toContain("2 horas");
  });
});

describe("encontrar la llamada a la herramienta", () => {
  const call = (extra: object) => ({ type: "tool-calls", ...extra });

  it("la encuentra en toolCalls, con los argumentos como objeto", () => {
    const t = buscarToolCall(
      call({ toolCalls: [{ id: "tc1", function: { name: "programar_callback", arguments: { minutos: 2 } } }] }),
    );
    expect(t).toEqual({ id: "tc1", args: { minutos: 2 } });
  });

  it("también cuando los argumentos vienen como texto JSON", () => {
    const t = buscarToolCall(
      call({ toolCalls: [{ id: "tc2", function: { name: "programar_callback", arguments: '{"minutos":"10","nota":"iba manejando"}' } }] }),
    );
    expect(t?.args).toEqual({ minutos: "10", nota: "iba manejando" });
  });

  it("no agarra la de otra herramienta del mismo turno", () => {
    const msg = call({
      toolCalls: [
        { id: "otra", function: { name: "consultar_historial", arguments: {} } },
        { id: "mia", function: { name: "programar_callback", arguments: { minutos: 3 } } },
      ],
    });
    expect(buscarToolCall(msg)?.id).toBe("mia");
  });

  it("ignora los mensajes que no son de herramientas", () => {
    expect(buscarToolCall({ type: "end-of-call-report" })).toBeNull();
    expect(buscarToolCall({ type: "status-update" })).toBeNull();
    expect(buscarToolCall(null)).toBeNull();
  });

  it("argumentos rotos no tumban nada: quedan vacíos y se usa el defecto", () => {
    const t = buscarToolCall(
      call({ toolCalls: [{ id: "tc3", function: { name: "programar_callback", arguments: "{no es json" } }] }),
    );
    expect(t?.args).toEqual({});
    expect(minutosPedidos(t?.args.minutos)).toBe(MINUTOS_DEFECTO);
  });
});
