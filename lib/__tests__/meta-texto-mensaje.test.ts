// Qué se guarda por cada mensaje de Messenger o Instagram.

import { describe, expect, it } from "vitest";
import { compartidoDeTexto, textoDelMensaje } from "@/lib/meta-texto-mensaje";

describe("mensajes normales", () => {
  it("guarda el texto tal cual", () => {
    expect(textoDelMensaje({ text: "Hola, tienen habitaciones?" })).toBe(
      "Hola, tienen habitaciones?",
    );
  });

  it("un adjunto sin texto deja su marca, en español", () => {
    expect(textoDelMensaje({ attachments: [{ type: "image" }] })).toBe("[imagen]");
    expect(textoDelMensaje({ attachments: [{ type: "file" }] })).toBe("[archivo]");
    expect(textoDelMensaje({ attachments: [{ type: "audio" }] })).toBe("[audio]");
  });

  it("un tipo desconocido se deja tal cual, entre corchetes", () => {
    expect(textoDelMensaje({ attachments: [{ type: "cosa_nueva" }] })).toBe("[cosa_nueva]");
  });

  it("sin nada, no hay nada que guardar", () => {
    expect(textoDelMensaje({})).toBeNull();
  });
});

describe("reels y publicaciones compartidas", () => {
  const reel = {
    type: "ig_reel",
    payload: {
      url: "https://www.instagram.com/p/DchOhM8gH_F/",
      title: "Un hotel para los salvadoreños 🌴\n\n📲 Reserva al +503 7020 0301\n\n#elsalvador",
      reel_video_id: "18197521672375749",
    },
  };

  it("un reel compartido guarda la marca, el título corto y el enlace", () => {
    // Antes quedaba "[ig_reel]", que no le dice nada a quien atiende, y se
    // perdía justo el contexto de la pregunta que viene después.
    expect(textoDelMensaje({ attachments: [reel] })).toBe(
      "[compartió un reel] Un hotel para los salvadoreños 🌴\nhttps://www.instagram.com/p/DchOhM8gH_F/",
    );
  });

  it("con texto en el mismo mensaje, el reel va primero y el texto después", () => {
    expect(textoDelMensaje({ text: "qué es el menú salvadoreño", attachments: [reel] })).toBe(
      "[compartió un reel] Un hotel para los salvadoreños 🌴\nhttps://www.instagram.com/p/DchOhM8gH_F/\n\nqué es el menú salvadoreño",
    );
  });

  it("una publicación de Facebook también", () => {
    expect(
      textoDelMensaje({ attachments: [{ type: "post", payload: { url: "https://fb.com/x", title: "Promo" } }] }),
    ).toBe("[compartió una publicación] Promo\nhttps://fb.com/x");
  });

  it("la burbuja recupera rótulo, título, enlace y texto", () => {
    const t = textoDelMensaje({ text: "qué es el menú salvadoreño", attachments: [reel] }) as string;
    expect(compartidoDeTexto(t)).toEqual({
      rotulo: "Compartió un reel",
      titulo: "Un hotel para los salvadoreños 🌴",
      url: "https://www.instagram.com/p/DchOhM8gH_F/",
      resto: "qué es el menú salvadoreño",
    });
    expect(compartidoDeTexto("hola")).toBeNull();
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
    ).toBe("[respuesta a tu historia] [imagen]");
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
