import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearSesion, verificarSesion } from "../session";

// session.ts lee process.env en CADA llamada (no al importar), asi que podemos
// simular distintos entornos moviendo las variables en cada test.
const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.SESSION_SECRET = "un-secreto-de-prueba-suficientemente-largo";
  process.env.NODE_ENV = "test";
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

describe("sesion firmada", () => {
  it("una sesion recien creada se verifica y devuelve su tenant", async () => {
    const s = await crearSesion("miagentia");
    expect(s).not.toBeNull();
    const tenant = await verificarSesion(s!.valor);
    expect(tenant).toBe("miagentia");
  });

  it("rechaza una cookie con la firma manipulada", async () => {
    const s = await crearSesion("hospital");
    const manipulada = s!.valor.slice(0, -4) + "XXXX";
    expect(await verificarSesion(manipulada)).toBeNull();
  });

  it("rechaza si cambian el tenant sin refirmar (no se puede suplantar cliente)", async () => {
    const s = await crearSesion("hospital");
    const partes = s!.valor.split(".");
    const otroTenant = ["grupoq", partes[1], partes[2]].join(".");
    expect(await verificarSesion(otroTenant)).toBeNull();
  });

  it("rechaza una sesion expirada", async () => {
    // Firmamos a mano un payload ya vencido con el mismo secreto.
    const { createHmac } = await import("node:crypto");
    const exp = Math.floor(Date.now() / 1000) - 10;
    const payload = `miagentia.${exp}`;
    const sig = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(payload)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verificarSesion(`${payload}.${sig}`)).toBeNull();
  });

  it("rechaza basura y vacio", async () => {
    expect(await verificarSesion(undefined)).toBeNull();
    expect(await verificarSesion("")).toBeNull();
    expect(await verificarSesion("no.es.valido")).toBeNull();
  });

  it("firmas con secretos distintos no son intercambiables", async () => {
    const s = await crearSesion("excel");
    process.env.SESSION_SECRET = "otro-secreto-totalmente-distinto-largo";
    expect(await verificarSesion(s!.valor)).toBeNull();
  });
});

describe("fail-closed sin SESSION_SECRET en produccion", () => {
  beforeEach(() => {
    delete process.env.SESSION_SECRET;
    process.env.NODE_ENV = "production";
  });

  it("NO emite sesion (crearSesion devuelve null)", async () => {
    expect(await crearSesion("miagentia")).toBeNull();
  });

  it("NO valida ninguna sesion, ni una que fue legitima antes", async () => {
    // Una cookie firmada con el default publico del repo NO debe pasar.
    const { createHmac } = await import("node:crypto");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = `miagentia.${exp}`;
    const sig = createHmac("sha256", "dev-secret-solo-local-nunca-produccion")
      .update(payload)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verificarSesion(`${payload}.${sig}`)).toBeNull();
  });
});
