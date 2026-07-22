import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchVapiCalls } from "../vapi";

const ENV_ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function respuestaOk(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

describe("fetchVapiCalls: reintento ante fallos transitorios", () => {
  beforeEach(() => {
    process.env.VAPI_PRIVATE_KEY = "clave-de-prueba";
  });

  it("reintenta el /call cuando la conexion se corta y luego funciona", async () => {
    let intentosCall = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/phone-number")) return respuestaOk([]);
        if (u.includes("/assistant")) return respuestaOk([]);
        // /call: la primera vez se corta ("terminated"), la segunda responde.
        intentosCall++;
        if (intentosCall === 1) throw new TypeError("terminated");
        return respuestaOk([{ id: "c1", type: "outboundPhoneCall", cost: 0.1 }]);
      }),
    );

    const calls = await fetchVapiCalls();
    expect(intentosCall).toBe(2); // hubo reintento
    expect(calls).toHaveLength(1);
    expect(calls[0].id).toBe("c1");
  });

  it("se rinde tras 3 intentos fallidos y propaga el error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/phone-number") || u.includes("/assistant")) return respuestaOk([]);
        throw new TypeError("terminated");
      }),
    );

    await expect(fetchVapiCalls()).rejects.toThrow(/terminated/);
  });

  it("NO reintenta un error no transitorio (401) y falla de una", async () => {
    let intentosCall = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/phone-number") || u.includes("/assistant")) return respuestaOk([]);
        intentosCall++;
        return { ok: false, status: 401, json: async () => ({}) } as Response;
      }),
    );

    await expect(fetchVapiCalls()).rejects.toThrow(/401/);
    expect(intentosCall).toBe(1); // sin reintento
  });
});
