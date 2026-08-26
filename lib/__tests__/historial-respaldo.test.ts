// Releer el respaldo no es lo mismo que recibir mensajes.
//
// La bandeja se arma releyendo el historial completo cada vez que se abre. Sin
// distinguir las dos cosas, abrir el panel mostraba cuatro mil mensajes sin
// leer y reabría las conversaciones ya cerradas, como si mil setecientas
// personas hubieran escrito todas juntas en ese instante.

import { describe, expect, it } from "vitest";
import { storeReducer, createInitialState, type StoreAction } from "@/lib/store";

function entrante(from: string, waId: string, historico: boolean): StoreAction {
  return {
    type: "WHATSAPP_INCOMING",
    waId,
    from,
    texto: "hola",
    ts: "2026-08-20T10:00:00.000Z",
    direccion: "in",
    historico,
  };
}

describe("mensajes releídos del respaldo", () => {
  it("no dejan nada sin leer", () => {
    const s = storeReducer(createInitialState(), entrante("50370000001", "w1", true));
    const c = s.conversations.find((x) => x.id === "wac-50370000001")!;
    expect(c.noLeidos).toBe(0);
  });

  it("nacen cerrados: son conversaciones de agosto, ya contestadas", () => {
    const s = storeReducer(createInitialState(), entrante("50370000002", "w2", true));
    expect(s.conversations.find((x) => x.id === "wac-50370000002")!.estado).toBe("resuelto");
  });

  it("no reabren una conversación que alguien ya cerró", () => {
    let s = storeReducer(createInitialState(), entrante("50370000003", "w3", true));
    const id = "wac-50370000003";
    s = storeReducer(s, { type: "SET_STATUS", conversationId: id, estado: "resuelto" });
    s = storeReducer(s, entrante("50370000003", "w4", true));
    expect(s.conversations.find((x) => x.id === id)!.estado).toBe("resuelto");
  });

  it("pero el mensaje sí queda en el hilo", () => {
    // No se ignoran: son la conversación. Lo que no hacen es pedir atención.
    const s = storeReducer(createInitialState(), entrante("50370000004", "w5", true));
    expect(s.messages.some((m) => m.id === "w5")).toBe(true);
  });
});

describe("mensajes que llegan de verdad", () => {
  it("sí cuentan como sin leer", () => {
    const s = storeReducer(createInitialState(), entrante("50370000005", "w6", false));
    expect(s.conversations.find((x) => x.id === "wac-50370000005")!.noLeidos).toBe(1);
  });

  it("sí reabren una conversación cerrada", () => {
    // Alguien a quien ya se atendió vuelve a escribir: eso es trabajo nuevo.
    let s = storeReducer(createInitialState(), entrante("50370000006", "w7", true));
    const id = "wac-50370000006";
    s = storeReducer(s, { type: "SET_STATUS", conversationId: id, estado: "resuelto" });
    s = storeReducer(s, entrante("50370000006", "w8", false));
    const c = s.conversations.find((x) => x.id === id)!;
    expect(c.estado).toBe("en_progreso");
    expect(c.noLeidos).toBe(1);
  });
});
