import { describe, expect, it } from "vitest";
import { autorDeCambioFeed } from "../meta-feed-autores";

const PAGINA = "108604138639295";

describe("autorDeCambioFeed", () => {
  it("saca nombre e ids de un comentario nuevo", () => {
    const a = autorDeCambioFeed(PAGINA, {
      field: "feed",
      value: {
        item: "comment",
        verb: "add",
        comment_id: "1039922918848325_2667544746994594",
        post_id: "108604138639295_1039922918848325",
        message: "Locación?",
        from: { id: "27451287877881656", name: "Josue Rodriguez" },
      },
    });
    expect(a).toEqual({
      commentId: "1039922918848325_2667544746994594",
      pageId: PAGINA,
      postId: "108604138639295_1039922918848325",
      fromId: "27451287877881656",
      nombre: "Josue Rodriguez",
      texto: "Locación?",
    });
  });

  it("ignora reacciones, borrados y comentarios sin nombre", () => {
    expect(
      autorDeCambioFeed(PAGINA, {
        field: "feed",
        value: { item: "reaction", verb: "add", from: { id: "1", name: "Alguien" } },
      }),
    ).toBeNull();
    expect(
      autorDeCambioFeed(PAGINA, {
        field: "feed",
        value: { item: "comment", verb: "remove", comment_id: "x_y", from: { id: "1", name: "Alguien" } },
      }),
    ).toBeNull();
    expect(
      autorDeCambioFeed(PAGINA, {
        field: "feed",
        value: { item: "comment", verb: "add", comment_id: "x_y", from: { id: "1" } },
      }),
    ).toBeNull();
    expect(autorDeCambioFeed(PAGINA, { field: "mention", value: { item: "comment", verb: "add" } })).toBeNull();
  });
});
