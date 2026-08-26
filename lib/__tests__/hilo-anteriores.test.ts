// Cargar mensajes viejos en un hilo no puede desordenar la bandeja.
//
// La lista se ordena por la fecha del último mensaje de cada conversación. Al
// abrir un hilo se traen sus 50 anteriores, y si cada uno de esos "actualizara"
// esa fecha, la conversación que se acaba de abrir se iría al fondo de la lista
// como si hubiera envejecido cincuenta mensajes.

import { describe, expect, it } from "vitest";
import { storeReducer, createInitialState, type StoreAction } from "@/lib/store";

function wa(waId: string, ts: string, historico = true): StoreAction {
  return { type: "WHATSAPP_INCOMING", waId, from: "50370009999", texto: "x", ts, direccion: "in", historico };
}
function meta(mid: string, ts: string, dir: "in" | "out" = "in"): StoreAction {
  return { type: "META_INCOMING", mid, canal: "facebook", pageId: "PG", senderId: "u9", texto: "x", ts, direction: dir, historico: true };
}

describe("al cargar mensajes anteriores", () => {
  it("la conversación de WhatsApp se queda donde estaba en la lista", () => {
    let s = storeReducer(createInitialState(), wa("h-1", "2026-08-20T10:00:00.000Z"));
    // Llegan 3 mensajes más viejos, como al abrir el hilo.
    s = storeReducer(s, wa("h-2", "2026-08-19T10:00:00.000Z"));
    s = storeReducer(s, wa("h-3", "2026-08-18T10:00:00.000Z"));
    const c = s.conversations.find((x) => x.id === "wac-50370009999")!;
    expect(c.ultimoMensajeTs).toBe("2026-08-20T10:00:00.000Z");
    expect(s.messages.filter((m) => m.conversationId === c.id)).toHaveLength(3);
  });

  it("la de Messenger también, y no cambia su estado", () => {
    // El último real fue del hotel, así que está atendida. Que después se
    // carguen mensajes viejos del huésped no la puede volver a poner pendiente.
    let s = storeReducer(createInitialState(), meta("fbh-1", "2026-08-20T10:00:00.000Z", "out"));
    s = storeReducer(s, meta("fbh-2", "2026-08-19T10:00:00.000Z", "in"));
    const c = s.conversations.find((x) => x.id === "metac-facebook-PG-u9")!;
    expect(c.ultimoMensajeTs).toBe("2026-08-20T10:00:00.000Z");
    expect(c.estado).toBe("resuelto");
  });

  it("un mensaje nuevo de verdad sí la sube", () => {
    let s = storeReducer(createInitialState(), wa("h-4", "2026-08-20T10:00:00.000Z"));
    s = storeReducer(s, wa("h-5", "2026-08-26T10:00:00.000Z", false));
    expect(s.conversations.find((x) => x.id === "wac-50370009999")!.ultimoMensajeTs).toBe(
      "2026-08-26T10:00:00.000Z",
    );
  });
});
