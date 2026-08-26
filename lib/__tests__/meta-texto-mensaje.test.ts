// Qué se guarda por cada mensaje de Messenger o Instagram.

import { describe, expect, it } from "vitest";
import { textoDelMensaje } from "@/lib/meta-texto-mensaje";

describe("mensajes normales", () => {
  it("guarda el texto tal cual", () => {
    expect(textoDelMensaje({ text: "Hola, tienen habitaciones?" })).toBe(
      "Hola, tienen habitaciones?",
    );
  });

  it("un adjunto sin texto deja su marca", () => {
    expect(textoDelMensaje({ attachments: [{ type: "image" }] })).toBe("[image]");
  });

  it("sin nada, no hay nada que guardar", () => {
    expect(textoDelMensaje({})).toBeNull();
  });
});

describe("historias", () => {
  it("responder una historia se marca, sin perder lo que escribieron", () => {
    // Sin la marca, en la bandeja aparecía "cuánto vale?" suelto y quien
    // atiende no tenía forma de saber de qué le hablaban.
    expect(
      textoDelMensaje({
        text: "cuánto vale?",
        reply_to: { story: { id: "s1", url: "https://..." } },
      }),
    ).toBe("[respuesta a tu historia] cuánto vale?");
  });

  it("responder una historia solo con una foto también se marca", () => {
    expect(
      textoDelMensaje({
        attachments: [{ type: "image" }],
        reply_to: { story: { id: "s1" } },
      }),
    ).toBe("[respuesta a tu historia] [image]");
  });

  it("que nos mencionen en su historia se dice con todas sus letras", () => {
    // Acá el adjunto ES el mensaje: no viene texto ninguno.
    expect(textoDelMensaje({ attachments: [{ type: "story_mention" }] })).toBe(
      "[te mencionó en su historia]",
    );
  });

  it("responder a otro mensaje no se confunde con responder a una historia", () => {
    // reply_to también viene cuando alguien cita un mensaje anterior, y eso no
    // lleva marca.
    expect(textoDelMensaje({ text: "sí, ese", reply_to: { mid: "m_123" } })).toBe("sí, ese");
  });
});
