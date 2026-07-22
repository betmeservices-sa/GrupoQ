import { describe, expect, it } from "vitest";
import { normalizarCall, type Directorio, type VapiCall } from "../vapi";

const directorio: Directorio = {
  numeros: new Map([
    ["e0a31324-def7-4cff-b65a-922084628804", { numero: "+50325054600", nombre: "BetMe Services" }],
  ]),
  assistants: new Map([["4f581515-fb1e-4b39-96af-8dcb39af1173", "Sofia - Banco BetMe"]]),
};

const crudo: VapiCall = {
  id: "019f86a4",
  type: "outboundPhoneCall",
  status: "ended",
  customer: { number: "+50375391721" },
  phoneNumberId: "e0a31324-def7-4cff-b65a-922084628804",
  assistantId: "4f581515-fb1e-4b39-96af-8dcb39af1173",
  createdAt: "2026-07-21T21:46:15.269Z",
  startedAt: "2026-07-21T21:46:22.606Z",
  endedAt: "2026-07-21T21:46:48.516Z",
  endedReason: "assistant-forwarded-call",
  cost: 0.0339,
  costBreakdown: { transport: 0, stt: 0.0046, llm: 0.0077, tts: 0, vapi: 0.0216, total: 0.0339 },
  transcript: "AI: Buenas...",
  recordingUrl: "https://ejemplo/r.wav",
};

describe("normalizarCall", () => {
  it("mapea todos los campos y resuelve numero propio y assistant", () => {
    const c = normalizarCall(crudo, directorio);
    expect(c.id).toBe("019f86a4");
    expect(c.direccion).toBe("outbound");
    expect(c.numeroCliente).toBe("+50375391721");
    expect(c.numeroPropio).toBe("+50325054600");
    expect(c.nombreNumero).toBe("BetMe Services");
    expect(c.nombreAssistant).toBe("Sofia - Banco BetMe");
    expect(c.creada).toBe("2026-07-21T21:46:15.269Z");
    expect(c.duracionSeg).toBe(26);
    expect(c.costo).toBe(0.0339);
    expect(c.costoDesglose?.vapi).toBe(0.0216);
    expect(c.estadoFinal).toBe("assistant-forwarded-call");
  });

  it("deja el id crudo visible si el numero no esta en el directorio", () => {
    const c = normalizarCall({ ...crudo, phoneNumberId: "desconocido" }, directorio);
    expect(c.numeroPropio).toBeUndefined();
    expect(c.phoneNumberId).toBe("desconocido");
  });

  it("no rompe cuando faltan startedAt y endedAt (llamada rechazada)", () => {
    const c = normalizarCall(
      { id: "x", type: "outboundPhoneCall", createdAt: "2026-07-21T17:08:26.814Z", cost: 0 },
      directorio,
    );
    expect(c.duracionSeg).toBe(0);
    expect(c.inicio).toBeUndefined();
    expect(c.costoDesglose).toBeUndefined();
  });

  it("mapea el tipo de llamada a direccion", () => {
    expect(normalizarCall({ ...crudo, type: "inboundPhoneCall" }, directorio).direccion).toBe(
      "inbound",
    );
    expect(normalizarCall({ ...crudo, type: "webCall" }, directorio).direccion).toBe("web");
  });
});
