import { describe, expect, it } from "vitest";
import { FakeCommsProvider } from "../provider";
import { conversations as seedConversations } from "../seed";

describe("FakeCommsProvider", () => {
  it("lista todas las conversaciones del seed", () => {
    const p = new FakeCommsProvider();
    expect(p.listConversations()).toHaveLength(seedConversations.length);
  });

  it("devuelve solo los mensajes de una conversación, ordenados por ts", () => {
    const p = new FakeCommsProvider();
    const msgs = p.getMessages("v1");
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs.every((m) => m.conversationId === "v1")).toBe(true);
    const tss = msgs.map((m) => m.ts);
    expect([...tss].sort()).toEqual(tss);
  });

  it("devuelve clones: mutar el resultado no afecta al provider", () => {
    const p = new FakeCommsProvider();
    const a = p.listConversations();
    a[0].estado = "resuelto";
    const b = p.listConversations();
    expect(b[0].estado).not.toBe("resuelto");
  });

  it("resuelve el contacto por id", () => {
    const p = new FakeCommsProvider();
    expect(p.getContact("c1")?.nombre).toBe("Wendy Alvarado");
    expect(p.getContact("nope")).toBeUndefined();
  });
});
