// El nombre de quien escribe por Messenger o Instagram.
//
// Se prueba porque el modo de fallar es silencioso: si la busqueda se rompe,
// no salta ningun error, simplemente la bandeja vuelve a mostrar "FB 087261" y
// nadie se entera hasta que alguien mira la pantalla.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nombreDelRemitente, olvidarPerfiles } from "@/lib/meta-perfil";

function respuesta(cuerpo: unknown) {
  return { json: async () => cuerpo } as Response;
}

afterEach(() => {
  olvidarPerfiles();
  vi.unstubAllGlobals();
});

describe("el nombre de quien escribe", () => {
  it("en Messenger arma el nombre con first_name y last_name", async () => {
    // El error que tuvimos en produccion: se pedia "name" y para un PSID de
    // Messenger ese campo viene vacio, asi que la bandeja mostraba "FB 971486".
    const fetchMock = vi.fn(async (_url: string) =>
      respuesta({ first_name: "Bryan", last_name: "Alvarado" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await nombreDelRemitente("1234", "facebook", "TOK")).toBe("Bryan Alvarado");

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/1234?");
    expect(url).toContain("first_name");
    expect(url).toContain("last_name");
    expect(url).toContain("access_token=TOK");
  });

  it("se conforma con el nombre de pila si no hay apellido", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ first_name: "Bryan" })));
    expect(await nombreDelRemitente("1234", "facebook", "TOK")).toBe("Bryan");
  });

  it("todavia acepta 'name' suelto, por si Meta lo devuelve", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta({ name: "Bryan Alvarado" })));
    expect(await nombreDelRemitente("1234", "facebook", "TOK")).toBe("Bryan Alvarado");
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

describe("cuando Meta no deja preguntar por la persona", () => {
  beforeEach(() => {
    olvidarPerfiles();
    const g = globalThis as unknown as { __metaParticipantes?: Map<string, unknown> };
    g.__metaParticipantes?.clear();
  });

  it("saca el nombre de la lista de conversaciones de la página", async () => {
    // Es el caso real de Messenger hoy: preguntar por un PSID devuelve
    // "(#3) Application does not have the capability to make this API call"
    // hasta que pase el App Review, pero la lista de conversaciones de la
    // página trae el mismo nombre y sí está permitida.
    const llamadas: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      llamadas.push(url);
      if (url.includes("/conversations")) {
        return respuesta({
          data: [
            { participants: { data: [{ id: "PSID1", name: "Ruth Ibarra" }, { id: "PG", name: "Yali" }] } },
          ],
        });
      }
      return respuesta({ error: { message: "(#3) Application does not have the capability" } });
    });

    const n = await nombreDelRemitente("PSID1", "facebook", "tok", Date.now(), "PG");
    expect(n).toBe("Ruth Ibarra");
    expect(llamadas.some((u) => u.includes("/conversations"))).toBe(true);
  });

  it("sin page_id no intenta la segunda puerta", async () => {
    // Quien llama tiene que pasarlo; si no, esto no puede inventarlo.
    vi.stubGlobal("fetch", async () => respuesta({ error: { message: "(#3)" } }));
    expect(await nombreDelRemitente("PSID1", "facebook", "tok", Date.now())).toBeNull();
  });

  it("no vuelve a pedir la lista para cada mensaje del mismo lote", async () => {
    let listas = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("/conversations")) {
        listas++;
        return respuesta({ data: [{ participants: { data: [{ id: "A", name: "Ana" }, { id: "B", name: "Beto" }] } }] });
      }
      return respuesta({ error: { message: "(#3)" } });
    });

    const ahora = Date.now();
    expect(await nombreDelRemitente("A", "facebook", "tok", ahora, "PG")).toBe("Ana");
    expect(await nombreDelRemitente("B", "facebook", "tok", ahora, "PG")).toBe("Beto");
    expect(listas).toBe(1);
  });

  it("a quien no aparece lo olvida rápido, para volver a buscarlo", async () => {
    // Quien acaba de escribir por primera vez puede no estar en la lista que
    // trajimos. Guardarlo seis horas como "sin nombre" lo dejaría sin nombre
    // seis horas.
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("/conversations")
        ? respuesta({ data: [] })
        : respuesta({ error: { message: "(#3)" } }),
    );
    const ahora = Date.now();
    expect(await nombreDelRemitente("NUEVO", "facebook", "tok", ahora, "PG")).toBeNull();
    // Diez minutos despues ya no vale lo guardado.
    vi.stubGlobal("fetch", async (url: string) =>
      url.includes("/conversations")
        ? respuesta({ data: [{ participants: { data: [{ id: "NUEVO", name: "Recién Llegada" }] } }] })
        : respuesta({ error: { message: "(#3)" } }),
    );
    expect(await nombreDelRemitente("NUEVO", "facebook", "tok", ahora + 11 * 60 * 1000, "PG")).toBe(
      "Recién Llegada",
    );
  });
});
