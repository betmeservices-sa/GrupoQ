// El nombre de quien escribe por Messenger o Instagram.
//
// Se prueba porque el modo de fallar es silencioso: si la busqueda se rompe,
// no salta ningun error, simplemente la bandeja vuelve a mostrar "FB 087261" y
// nadie se entera hasta que alguien mira la pantalla.

import { afterEach, describe, expect, it, vi } from "vitest";
import { nombreDelRemitente, olvidarPerfiles } from "@/lib/meta-perfil";

function respuesta(cuerpo: unknown) {
  return { json: async () => cuerpo } as Response;
}

afterEach(() => {
  olvidarPerfiles();
  vi.unstubAllGlobals();
});

describe("el nombre de quien escribe", () => {
  it("lo pide con el token de la pagina y lo devuelve", async () => {
    const fetchMock = vi.fn(async (_url: string) => respuesta({ name: "Bryan Alvarado" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await nombreDelRemitente("1234", "facebook", "TOK")).toBe("Bryan Alvarado");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/1234?");
    expect(url).toContain("fields=name");
    expect(url).toContain("access_token=TOK");
  });

  it("en Instagram cae al arroba cuando no hay nombre", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ username: "yali_hotel" })));
    expect(await nombreDelRemitente("99", "instagram", "TOK")).toBe("@yali_hotel");
  });

  it("prefiere el nombre al arroba cuando estan los dos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ name: "Vero", username: "vero" })));
    expect(await nombreDelRemitente("99", "instagram", "TOK")).toBe("Vero");
  });

  it("no vuelve a preguntar por la misma persona", async () => {
    const fetchMock = vi.fn(async () => respuesta({ name: "Bryan" }));
    vi.stubGlobal("fetch", fetchMock);

    await nombreDelRemitente("1234", "facebook", "TOK");
    await nombreDelRemitente("1234", "facebook", "TOK");
    await nombreDelRemitente("1234", "facebook", "TOK");

    // Alguien manda cinco mensajes seguidos: se pregunta una vez, no cinco.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("vuelve a preguntar cuando se vence el guardado", async () => {
    const fetchMock = vi.fn(async () => respuesta({ name: "Bryan" }));
    vi.stubGlobal("fetch", fetchMock);

    await nombreDelRemitente("1234", "facebook", "TOK", 0);
    await nombreDelRemitente("1234", "facebook", "TOK", 7 * 60 * 60 * 1000);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("devuelve null si Meta responde con error, y no revienta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ error: { message: "sin permiso" } })));
    expect(await nombreDelRemitente("1234", "facebook", "TOK")).toBeNull();
  });

  it("devuelve null si la llamada se cae", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("sin red");
    }));
    expect(await nombreDelRemitente("1234", "facebook", "TOK")).toBeNull();
  });

  it("no llama a Meta sin token de pagina", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await nombreDelRemitente("1234", "facebook", "")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
