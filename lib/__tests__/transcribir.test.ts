// Notas de voz pasadas a texto. Lo que cuidan estas pruebas:
//   - que en la bandeja se siga viendo que el huésped MANDÓ UN AUDIO, no que
//     escribió eso (por eso la marca "[audio]" adelante);
//   - que sin llave de Gemini la función se apague sola en vez de fallar;
//   - la baranda de siempre: un cliente que escucha tiene que DECIRLO en su
//     guion, y uno que no escucha no puede prometer que sí.
import { describe, it, expect, afterEach } from "vitest";
import { hayTranscripcion, textoDeAudio } from "@/lib/transcribir";
import { TENANTS } from "@/lib/tenants";
import { captionDeMedia } from "@/lib/format";

const LLAVE = process.env.GEMINI_API_KEY;
afterEach(() => {
  // `delete` y no `= ""`: en Node poner una env var en cadena vacía la deja
  // definida, y el chequeo de la llave la daría por presente.
  if (LLAVE === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = LLAVE;
});

describe("cómo se guarda una nota de voz transcrita", () => {
  it("deja la marca [audio] adelante, para que se vea que fue un audio", () => {
    expect(textoDeAudio("quiero reservar para el viernes")).toBe(
      "[audio] quiero reservar para el viernes",
    );
  });

  it("la marca va primero, no envuelve el texto", () => {
    expect(textoDeAudio("hola").startsWith("[audio] ")).toBe(true);
  });

  // La burbuja del chat pinta el reproductor y debajo lo que devuelve
  // captionDeMedia. Si la marca dejara de calzar, la transcripción se vería con
  // el "[audio]" pegado adelante, o directamente no se vería.
  it("en el chat, la transcripción queda como pie del reproductor", () => {
    const guardado = textoDeAudio("quiero reservar para el viernes");
    expect(captionDeMedia(guardado)).toBe("quiero reservar para el viernes");
  });

  it("un audio que no se pudo transcribir no deja pie", () => {
    expect(captionDeMedia("[audio]")).toBeNull();
  });
});

describe("interruptor por configuración", () => {
  it("sin GEMINI_API_KEY la transcripción está apagada", () => {
    delete process.env.GEMINI_API_KEY;
    expect(hayTranscripcion()).toBe(false);
  });

  it("con la llave puesta, encendida", () => {
    process.env.GEMINI_API_KEY = "de-prueba";
    expect(hayTranscripcion()).toBe(true);
  });
});

describe("baranda: el guion tiene que decir lo que el agente puede hacer", () => {
  const conAudio = Object.values(TENANTS).filter((t) => t.ai.audios === true);

  it("hoy solo Yali escucha notas de voz", () => {
    expect(conAudio.map((t) => t.id)).toEqual(["yaly"]);
  });

  it("quien escucha lo dice en su guion, y avisa que la transcripción falla", () => {
    for (const t of conAudio) {
      expect(t.ai.systemPrompt, t.id).toMatch(/NOTAS DE VOZ/);
      expect(t.ai.systemPrompt, t.id).toMatch(/pasadas a texto/i);
      // Nombres, fechas y cantidades son justo lo que una transcripción erra.
      expect(t.ai.systemPrompt, t.id).toMatch(/puede traer errores/i);
    }
  });

  it("quien escucha ya NO dice que no puede abrir un audio", () => {
    for (const t of conAudio) {
      expect(t.ai.systemPrompt, t.id).not.toMatch(/"\[audio\]".{0,40}NO lo puedes abrir/);
    }
  });

  it("quien NO escucha tampoco promete que sí", () => {
    for (const t of Object.values(TENANTS)) {
      if (t.ai.audios === true) continue;
      expect(t.ai.systemPrompt, t.id).not.toMatch(/NOTAS DE VOZ/);
    }
  });
});
