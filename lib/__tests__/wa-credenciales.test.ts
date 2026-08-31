// Con qué número habla cada cliente por WhatsApp.
//
// La regla que importa: un cliente sin número propio NO habla con el de la
// demo, salvo que el interruptor global se lo tenga asignado. Así fue como los
// enlaces de Yali terminaron apuntando a un número que no era el suyo.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let conexiones: Record<string, { accessToken: string; phoneNumberId: string; wabaId: string }[]> = {};
let tenantDemo = "hospital";

vi.mock("@/lib/wa-conexiones-store", () => ({
  conexionesWaDe: async (t: string) => conexiones[t] ?? [],
  conexionPorPhoneNumberId: async (id: string) => {
    for (const lista of Object.values(conexiones)) {
      const hit = lista.find((c) => c.phoneNumberId === id);
      if (hit) return hit;
    }
    return null;
  },
}));
vi.mock("@/lib/wa-routing", () => ({ getWaTenant: async () => tenantDemo }));

const { credencialesWa, credencialesPorNumero } = await import("@/lib/wa-credenciales");

beforeEach(() => {
  conexiones = {};
  tenantDemo = "hospital";
  process.env.WHATSAPP_ACCESS_TOKEN = "tok-demo";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "111";
});
afterEach(() => {
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
});

describe("credenciales de WhatsApp por cliente", () => {
  it("un cliente con número propio habla desde su número", async () => {
    conexiones.yaly = [{ accessToken: "tok-yali", phoneNumberId: "555", wabaId: "w1" }];
    const c = await credencialesWa("yaly");
    expect(c).toMatchObject({ token: "tok-yali", phoneId: "555", origen: "cliente" });
  });

  it("un cliente SIN número propio no habla con el de la demo", async () => {
    // Yali sin número conectado y la demo apuntada al hospital: nada.
    expect(await credencialesWa("yaly")).toBeNull();
  });

  it("salvo que el interruptor le tenga asignado el de la demo", async () => {
    tenantDemo = "yaly";
    expect(await credencialesWa("yaly")).toMatchObject({ phoneId: "111", origen: "demo" });
  });

  it("sin cliente, es el de la demo, como siempre", async () => {
    expect(await credencialesWa()).toMatchObject({ phoneId: "111", origen: "demo" });
  });

  it("el número propio gana aunque el interruptor también lo apunte", async () => {
    tenantDemo = "yaly";
    conexiones.yaly = [{ accessToken: "tok-yali", phoneNumberId: "555", wabaId: "w1" }];
    expect((await credencialesWa("yaly"))?.phoneId).toBe("555");
  });
});

describe("credenciales por el número al que llegó", () => {
  it("un número conectado devuelve el token de ese cliente", async () => {
    conexiones.yaly = [{ accessToken: "tok-yali", phoneNumberId: "555", wabaId: "w1" }];
    expect((await credencialesPorNumero("555"))?.token).toBe("tok-yali");
  });

  it("el número de la demo devuelve el de la demo", async () => {
    expect((await credencialesPorNumero("111"))?.origen).toBe("demo");
  });

  it("un número desconocido no devuelve nada", async () => {
    expect(await credencialesPorNumero("999")).toBeNull();
  });
});
