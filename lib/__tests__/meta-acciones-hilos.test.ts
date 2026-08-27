import { describe, expect, it } from "vitest";
import { hiloRespondido } from "../meta-comentarios";
import { cuerpoDeAccion } from "../meta-acciones";

describe("hiloRespondido", () => {
  it("sin ninguna respuesta nuestra, no", () => {
    expect(hiloRespondido([{ ts: "2026-08-27T00:00:00Z", nuestra: false }])).toBe(false);
  });
  it("que otra persona responda no cuenta como atendido", () => {
    // El caso real: kristian_guz reclamó, anagonzalez7478 le respondió, el
    // hotel no. Antes la pantalla lo daba por respondido.
    expect(
      hiloRespondido([
        { ts: "2026-08-27T00:29:00Z", nuestra: false },
        { ts: "2026-08-27T14:29:00Z", nuestra: false },
      ]),
    ).toBe(false);
  });
  it("si lo último es nuestro, sí", () => {
    expect(
      hiloRespondido([
        { ts: "2026-08-27T00:29:00Z", nuestra: false },
        { ts: "2026-08-27T15:00:00Z", nuestra: true },
      ]),
    ).toBe(true);
  });
  it("si vuelven a escribir después de nuestra respuesta, vuelve a pendiente", () => {
    expect(
      hiloRespondido([
        { ts: "2026-08-27T00:29:00Z", nuestra: false },
        { ts: "2026-08-27T15:00:00Z", nuestra: true },
        { ts: "2026-08-27T16:00:00Z", nuestra: false },
      ]),
    ).toBe(false);
  });
});

describe("cuerpoDeAccion", () => {
  it("por la página solo se puede 'love', y se avisa cuál quedó", () => {
    const r = cuerpoDeAccion("123", { accion: "reaccionar", mid: "m_1", emoji: "🙏" }, false);
    expect(r.cuerpo).toEqual({
      recipient: { id: "123" },
      sender_action: "react",
      payload: { message_id: "m_1", reaction: "love" },
    });
    expect(r.aplicada).toBe("❤️");
  });
  it("por la cuenta de Instagram va el emoji tal cual", () => {
    const r = cuerpoDeAccion("123", { accion: "reaccionar", mid: "m_1", emoji: "🙏" }, true);
    expect(r.cuerpo).toMatchObject({ payload: { reaction: "🙏" } });
    expect(r.aplicada).toBe("🙏");
  });
  it("quitar, visto y escribiendo", () => {
    expect(cuerpoDeAccion("1", { accion: "quitar_reaccion", mid: "m" }, false).cuerpo).toEqual({
      recipient: { id: "1" },
      sender_action: "unreact",
      payload: { message_id: "m" },
    });
    expect(cuerpoDeAccion("1", { accion: "visto" }, false).cuerpo).toEqual({ recipient: { id: "1" }, sender_action: "mark_seen" });
    expect(cuerpoDeAccion("1", { accion: "escribiendo" }, true).cuerpo).toEqual({ recipient: { id: "1" }, sender_action: "typing_on" });
  });
});
