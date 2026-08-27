import { describe, expect, it } from "vitest";
import { normalizarConversacionIg } from "../meta-sondeo-instagram";
import { filasDeConversaciones } from "../meta-sondeo-messenger";

// Con la forma exacta que devolvió graph.instagram.com/me/conversations para
// yali_hotel el 27 de agosto de 2026.
const CONV = {
  updated_time: "2026-08-27T18:38:46+0000",
  participants: {
    data: [
      { username: "yali_hotel", id: "17841455138505937" },
      { username: "noeeh22_", id: "1128200086394177" },
    ],
  },
  messages: {
    data: [
      { id: "aWdf-1", message: "Los fines de semana no contamos con Day Pass", from: { id: "17841455138505937", username: "yali_hotel" }, created_time: "2026-08-27T18:38:46+0000" },
      { id: "aWdf-2", message: "Y para fin de semana como sería el precio?", from: { id: "1128200086394177", username: "noeeh22_" }, created_time: "2026-08-27T17:56:26+0000" },
      { id: "aWdf-3", from: { id: "1128200086394177" }, created_time: "2026-08-27T17:50:00+0000", attachments: { data: [{ image_data: { url: "x" } }] } },
    ],
  },
};

describe("sondeo de Instagram", () => {
  it("convierte la conversación de Instagram en filas: la persona es la contraparte, con su usuario", () => {
    const filas = filasDeConversaciones([normalizarConversacionIg(CONV)], new Set(["17841455138505937", "108604138639295"]));
    expect(filas.map((f) => [f.direction, f.texto])).toEqual([
      ["in", "[imagen]"],
      ["in", "Y para fin de semana como sería el precio?"],
      ["out", "Los fines de semana no contamos con Day Pass"],
    ]);
    expect(filas.every((f) => f.senderId === "1128200086394177")).toBe(true);
    expect(filas[0].senderName).toBe("noeeh22_");
  });

  it("el filtro de fecha deja solo lo nuevo", () => {
    const filas = filasDeConversaciones([normalizarConversacionIg(CONV)], new Set(["17841455138505937"]), Date.parse("2026-08-27T18:00:00+0000"));
    expect(filas.map((f) => f.mid)).toEqual(["aWdf-1"]);
  });
});
