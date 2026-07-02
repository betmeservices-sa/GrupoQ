import { describe, expect, it } from "vitest";
import { createInitialState, storeReducer, type StoreState } from "../../store";
import { contacts, conversations, messages } from "../seed";

// La bandeja real arranca vacía (createInitialState), así que para probar el
// reducer sembramos un estado con las conversaciones del seed.
function freshState(): StoreState {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
  return {
    ...createInitialState(),
    conversations: clone(conversations),
    messages: clone(messages),
    contacts: clone(contacts),
  };
}

function conv(state: StoreState, id: string) {
  return state.conversations.find((c) => c.id === id)!;
}

function msgs(state: StoreState, id: string) {
  return state.messages.filter((m) => m.conversationId === id);
}

describe("storeReducer", () => {
  it("SEND_MESSAGE agrega un mensaje de staff y pasa 'nuevo' a 'en_progreso'", () => {
    const before = freshState();
    expect(conv(before, "v2").estado).toBe("nuevo");
    const after = storeReducer(before, {
      type: "SEND_MESSAGE",
      conversationId: "v2",
      texto: "Con gusto le ayudo.",
      staffId: "me",
    });
    const added = msgs(after, "v2").at(-1)!;
    expect(added.autor).toBe("staff");
    expect(added.texto).toBe("Con gusto le ayudo.");
    expect(conv(after, "v2").estado).toBe("en_progreso");
    expect(conv(after, "v2").ultimoMensajeTs).toBe(added.ts);
  });

  it("ASSIGN fija el responsable", () => {
    const after = storeReducer(freshState(), {
      type: "ASSIGN",
      conversationId: "v2",
      staffId: "s2",
    });
    expect(conv(after, "v2").asignadoA).toBe("s2");
  });

  it("SET_STATUS cambia el estado", () => {
    const after = storeReducer(freshState(), {
      type: "SET_STATUS",
      conversationId: "v1",
      estado: "resuelto",
    });
    expect(conv(after, "v1").estado).toBe("resuelto");
  });

  it("MARK_READ pone los no leídos en cero", () => {
    const before = freshState();
    expect(conv(before, "v2").noLeidos).toBeGreaterThan(0);
    const after = storeReducer(before, { type: "MARK_READ", conversationId: "v2" });
    expect(conv(after, "v2").noLeidos).toBe(0);
  });

  it("INCOMING agrega un mensaje de cliente e incrementa no leídos", () => {
    const before = freshState();
    const prev = conv(before, "v1").noLeidos;
    const after = storeReducer(before, {
      type: "INCOMING",
      conversationId: "v1",
      texto: "Una última pregunta.",
    });
    const added = msgs(after, "v1").at(-1)!;
    expect(added.autor).toBe("cliente");
    expect(conv(after, "v1").noLeidos).toBe(prev + 1);
  });

  it("SEND_INTERNAL agrega un mensaje al canal interno", () => {
    const before = freshState();
    const prev = before.internalMessages.filter((m) => m.channelId === "ic1").length;
    const after = storeReducer(before, {
      type: "SEND_INTERNAL",
      channelId: "ic1",
      texto: "Equipo, reunión a las 4.",
      staffId: "me",
    });
    expect(after.internalMessages.filter((m) => m.channelId === "ic1").length).toBe(prev + 1);
  });

  it("ADD_SOCIAL_POST agrega una publicación programada al inicio", () => {
    const after = storeReducer(freshState(), {
      type: "ADD_SOCIAL_POST",
      red: "instagram",
      texto: "Nueva campaña de test drive.",
      fecha: "2026-06-26T09:00:00",
    });
    expect(after.socialPosts[0].estado).toBe("programado");
    expect(after.socialPosts[0].texto).toBe("Nueva campaña de test drive.");
  });
});

// ---------------------------------------------------------------------------
// HIDRATAR_CONVERSACION
// Las conversaciones "wac-" no estan en el seed; se crean via WHATSAPP_INCOMING.
// ---------------------------------------------------------------------------
describe("storeReducer - HIDRATAR_CONVERSACION", () => {
  const TEST_FROM = "50376294980";

  // Crea un estado base que contiene una conversacion wac real.
  function stateWithWacConv(): StoreState {
    return storeReducer(freshState(), {
      type: "WHATSAPP_INCOMING",
      waId: "wamsg-test-1",
      from: TEST_FROM,
      nombre: "Cliente Test",
      texto: "Hola, tengo una consulta.",
      ts: "2026-06-23T11:00:00",
    });
  }

  it("aplica asignado_a, estado y departamento a una conversacion wac existente", () => {
    const before = stateWithWacConv();
    const after = storeReducer(before, {
      type: "HIDRATAR_CONVERSACION",
      wa_from: TEST_FROM,
      asignado_a: "s2",
      estado: "en_progreso",
      departamento: "ventas",
    });
    const c = after.conversations.find((x) => x.id === `wac-${TEST_FROM}`)!;
    expect(c.asignadoA).toBe("s2");
    expect(c.estado).toBe("en_progreso");
    expect(c.departamento).toBe("ventas");
  });

  it("es no-op si la conversacion wac no existe: retorna la misma referencia de estado", () => {
    const before = stateWithWacConv();
    const after = storeReducer(before, {
      type: "HIDRATAR_CONVERSACION",
      wa_from: "99999999999",
      asignado_a: "s2",
      estado: "en_progreso",
      departamento: "ventas",
    });
    // El reducer retorna `state` sin modificar cuando la conv no existe
    expect(after).toBe(before);
  });

  it("asignado_a null desasigna; estado/departamento null se conservan", () => {
    // Paso 1: establecer valores reales
    const withValues = storeReducer(stateWithWacConv(), {
      type: "HIDRATAR_CONVERSACION",
      wa_from: TEST_FROM,
      asignado_a: "s3",
      estado: "en_progreso",
      departamento: "taller",
    });
    // Paso 2: hidratar con todos null
    const after = storeReducer(withValues, {
      type: "HIDRATAR_CONVERSACION",
      wa_from: TEST_FROM,
      asignado_a: null,
      estado: null,
      departamento: null,
    });
    const c = after.conversations.find((x) => x.id === `wac-${TEST_FROM}`)!;
    // asignado_a null = desasignar explicito; estado/departamento null no pisan.
    expect(c.asignadoA).toBeUndefined();
    expect(c.estado).toBe("en_progreso");
    expect(c.departamento).toBe("taller");
  });

  it("actualiza solo los campos no-null dejando los null sin tocar", () => {
    // Conv recien creada: asignadoA=undefined, estado="nuevo", departamento="atencion"
    const before = stateWithWacConv();
    const after = storeReducer(before, {
      type: "HIDRATAR_CONVERSACION",
      wa_from: TEST_FROM,
      asignado_a: "s4",
      estado: null,
      departamento: null,
    });
    const c = after.conversations.find((x) => x.id === `wac-${TEST_FROM}`)!;
    expect(c.asignadoA).toBe("s4");
    expect(c.estado).toBe("nuevo");       // no debe cambiar
    expect(c.departamento).toBe("atencion"); // no debe cambiar
  });
});
