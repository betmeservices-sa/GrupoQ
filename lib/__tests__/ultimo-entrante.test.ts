import { describe, expect, it } from "vitest";
import { ultimoEntrante } from "../ultimo-entrante";

describe("ultimoEntrante", () => {
  it("devuelve lo último que dijo la persona aunque después hayamos hablado nosotros", () => {
    const hilo = [
      { mid: "1", direction: "in" },
      { mid: "2", direction: "out" },
      { mid: "3", direction: "in" },
      { mid: "4", direction: "out" },
    ];
    expect(ultimoEntrante(hilo)?.mid).toBe("3");
  });

  it("con varios mensajes seguidos de la persona, el último de ellos", () => {
    const hilo = [
      { mid: "1", direction: "out" },
      { mid: "2", direction: "in" },
      { mid: "3", direction: "in" },
      { mid: "4", direction: "in" },
    ];
    expect(ultimoEntrante(hilo)?.mid).toBe("4");
  });

  it("entiende la forma de WhatsApp (direccion) y devuelve null si no hay nada de la persona", () => {
    expect(ultimoEntrante([{ waId: "a", direccion: "in" }, { waId: "b", direccion: "out" }])?.waId).toBe("a");
    expect(ultimoEntrante([{ direction: "out" }])).toBeNull();
    expect(ultimoEntrante([])).toBeNull();
  });
});
