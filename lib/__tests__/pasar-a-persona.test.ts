// Sacar al agente de una conversación y dejársela a alguien.
//
// Se prueba con ganas porque el modo de fallar es silencioso y caro: si el
// agente NO se apaga, sigue contestando mientras la persona también contesta, y
// el huésped recibe dos respuestas distintas al mismo tiempo. Con un socio eso
// significa dos precios distintos.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apagados: { from: string; activa: boolean }[] = [];
const asignados: Record<string, unknown>[] = [];
let fallaApagar = false;
let fallaAsignar = false;

vi.mock("@/lib/ai-store", () => ({
  setChatOverride: async (from: string, activa: boolean) => {
    if (fallaApagar) throw new Error("no se pudo apagar");
    apagados.push({ from, activa });
  },
}));

vi.mock("@/lib/conv-store", () => ({
  upsertConversacion: async (c: Record<string, unknown>) => {
    if (fallaAsignar) throw new Error("no se pudo asignar");
    asignados.push(c);
  },
}));

const { pasarAPersona, RESPONSABLE } = await import("@/lib/pasar-a-persona");

beforeEach(() => {
  apagados.length = 0;
  asignados.length = 0;
  fallaApagar = false;
  fallaAsignar = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("pasar una conversación a una persona", () => {
  it("apaga el agente EN ESE CHAT y se lo asigna a alguien", async () => {
    const r = await pasarAPersona("50370000001", "socio");

    expect(r.ok).toBe(true);
    // Las dos cosas, no una: apagar sin asignar deja el chat huérfano en la
    // bandeja general, y asignar sin apagar deja a los dos contestando.
    expect(apagados).toEqual([{ from: "50370000001", activa: false }]);
    expect(asignados[0]).toMatchObject({
      wa_from: "50370000001",
      asignado_a: RESPONSABLE.membresias,
      estado: "en_progreso",
    });
  });

  it("un socio va a membresías; todo lo demás va a reservas", async () => {
    await pasarAPersona("1", "socio");
    await pasarAPersona("2", "audio");
    await pasarAPersona("3", "pago");
    await pasarAPersona("4", "reclamo");

    expect(asignados.map((a) => a.asignado_a)).toEqual([
      RESPONSABLE.membresias,
      RESPONSABLE.reservas,
      RESPONSABLE.reservas,
      RESPONSABLE.reservas,
    ]);
  });

  it("apaga ANTES de asignar", async () => {
    // El orden importa: si asignara primero y fallara el apagado, quedarían el
    // agente y la persona contestando a la vez, que es lo que esto evita.
    fallaAsignar = true;
    const r = await pasarAPersona("50370000001", "socio");

    expect(r.ok).toBe(false);
    expect(apagados).toHaveLength(1); // alcanzó a apagarse
    expect(asignados).toHaveLength(0);
  });

  it("avisa cuando falla en vez de decir que salió bien", async () => {
    // Quien llama necesita saberlo: si devolviera ok, el agente le diría al
    // huésped que alguien le va a escribir y no le va a escribir nadie.
    fallaApagar = true;
    const r = await pasarAPersona("50370000001", "socio");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("sin teléfono no hace nada, y lo dice", async () => {
    const r = await pasarAPersona("", "audio");
    expect(r.ok).toBe(false);
    expect(apagados).toHaveLength(0);
    expect(asignados).toHaveLength(0);
  });

  it("devuelve a quién quedó, para poder nombrarlo", async () => {
    expect((await pasarAPersona("1", "socio")).para).toBe(RESPONSABLE.membresias);
    expect((await pasarAPersona("2", "audio")).para).toBe(RESPONSABLE.reservas);
  });
});
