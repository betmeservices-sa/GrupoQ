import { describe, expect, it } from "vitest";
import {
  filasDeConversaciones,
  textoDeMensajeGraph,
  type ConversacionGraph,
  type MensajeGraph,
} from "../meta-sondeo-messenger";

const PAGINA = "113226271738310";
const IG = "17841455138505937";
const casa = new Set([PAGINA, IG]);

function conv(
  otro: { id: string; name?: string },
  mensajes: MensajeGraph[],
  updated = "2026-08-26T20:40:00+0000",
): ConversacionGraph {
  return {
    updated_time: updated,
    participants: { data: [{ id: PAGINA, name: "Sunzal Beach Club" }, otro] },
    messages: { data: mensajes },
  };
}

describe("textoDeMensajeGraph", () => {
  it("prefiere el texto", () => {
    expect(textoDeMensajeGraph({ message: "hola" })).toBe("hola");
  });
  it("marca adjuntos por tipo", () => {
    expect(textoDeMensajeGraph({ attachments: { data: [{ mime_type: "image/jpeg" }] } })).toBe("[imagen]");
    expect(textoDeMensajeGraph({ attachments: { data: [{ mime_type: "audio/mpeg" }] } })).toBe("[audio]");
    expect(textoDeMensajeGraph({ sticker: "https://x" })).toBe("[sticker]");
  });
  it("sin nada no guarda", () => {
    expect(textoDeMensajeGraph({})).toBeNull();
  });
});

describe("filasDeConversaciones", () => {
  it("identifica la conversación por la contraparte en los dos sentidos", () => {
    const filas = filasDeConversaciones(
      [
        conv({ id: "999", name: "Sofía Zárate" }, [
          { id: "m2", message: "gracias", from: { id: PAGINA }, created_time: "2026-08-26T20:41:00+0000" },
          {
            id: "m1",
            message: "precio?",
            from: { id: "999", name: "Sofía Zárate" },
            created_time: "2026-08-26T20:40:00+0000",
          },
        ]),
      ],
      casa,
    );
    // cronológico, no como los da Meta (la más nueva primero)
    expect(filas.map((f) => f.mid)).toEqual(["m1", "m2"]);
    expect(filas[0]).toMatchObject({ senderId: "999", senderName: "Sofía Zárate", direction: "in" });
    expect(filas[1]).toMatchObject({ senderId: "999", direction: "out" });
  });

  it("salta conversaciones sin contraparte y notas de respuesta a comentario", () => {
    const filas = filasDeConversaciones(
      [
        conv({ id: "999" }, [
          {
            id: "m3",
            message: "Estás respondiendo a un comentario",
            from: { id: PAGINA },
            created_time: "2026-08-26T20:40:00+0000",
          },
        ]),
        {
          participants: { data: [{ id: PAGINA }] },
          messages: { data: [{ id: "m4", message: "x", created_time: "2026-08-26T20:40:00+0000" }] },
        },
      ],
      casa,
    );
    expect(filas).toEqual([]);
  });

  it("con fecha desde, deja fuera lo viejo", () => {
    const desde = Date.parse("2026-08-26T20:30:00+0000");
    const filas = filasDeConversaciones(
      [
        conv({ id: "999" }, [
          { id: "nuevo", message: "hoy", from: { id: "999" }, created_time: "2026-08-26T20:45:00+0000" },
          { id: "viejo", message: "ayer", from: { id: "999" }, created_time: "2026-08-25T10:00:00+0000" },
        ]),
        conv(
          { id: "888" },
          [{ id: "m9", message: "x", from: { id: "888" }, created_time: "2026-08-20T10:00:00+0000" }],
          "2026-08-20T10:00:00+0000",
        ),
      ],
      casa,
      desde,
    );
    expect(filas.map((f) => f.mid)).toEqual(["nuevo"]);
  });
});
