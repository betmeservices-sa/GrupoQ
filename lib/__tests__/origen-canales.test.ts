// El bloque "de dónde llegan": que el conteo por canal salga de las
// conversaciones reales del store, que mande el volumen y que el canal que
// nadie está atendiendo quede a la vista.
import { describe, it, expect } from "vitest";
import { origenPorCanal } from "@/lib/origen-canales";
import type { Channel, Conversation, ConversationStatus } from "@/lib/data/types";

let n = 0;

function conv(
  canal: Channel,
  estado: ConversationStatus = "nuevo",
  asignadoA?: string,
): Conversation {
  n += 1;
  return {
    id: `c${n}`,
    canal,
    contactId: `k${n}`,
    departamento: "ventas",
    estado,
    asignadoA,
    noLeidos: 0,
    ultimoMensajeTs: "2026-08-12T09:00:00",
  };
}

describe("origenPorCanal", () => {
  it("sin conversaciones devuelve una lista vacía", () => {
    expect(origenPorCanal([])).toEqual([]);
  });

  it("un solo canal se lleva el 100%", () => {
    const filas = origenPorCanal([
      conv("whatsapp", "resuelto", "s2"),
      conv("whatsapp", "resuelto", "s3"),
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ canal: "whatsapp", total: 2, pct: 100, pendientes: 0 });
  });

  it("ordena por volumen, no por orden alfabético ni por el orden en que entraron", () => {
    const filas = origenPorCanal([
      conv("facebook"),
      conv("instagram"),
      conv("instagram"),
      conv("whatsapp"),
      conv("whatsapp"),
      conv("whatsapp"),
    ]);
    expect(filas.map((f) => f.canal)).toEqual(["whatsapp", "instagram", "facebook"]);
    expect(filas.map((f) => f.total)).toEqual([3, 2, 1]);
    expect(filas.map((f) => f.pct)).toEqual([50, 33, 17]);
  });

  it("no inventa canales: el que no trae conversaciones no aparece", () => {
    const filas = origenPorCanal([conv("whatsapp"), conv("facebook")]);
    expect(filas.map((f) => f.canal)).toEqual(["facebook", "whatsapp"]);
    expect(filas.some((f) => f.canal === "instagram")).toBe(false);
  });

  it("con el mismo volumen sube el canal que tiene más gente esperando", () => {
    const filas = origenPorCanal([
      conv("whatsapp", "resuelto", "s2"),
      conv("whatsapp", "resuelto", "s2"),
      conv("instagram", "nuevo"),
      conv("instagram", "en_progreso", "s3"),
    ]);
    expect(filas.map((f) => f.canal)).toEqual(["instagram", "whatsapp"]);
    expect(filas.map((f) => f.total)).toEqual([2, 2]);
    expect(filas.map((f) => f.pct)).toEqual([50, 50]);
  });

  it("empate parejo: el desempate es estable, no depende del orden de entrada", () => {
    const a = origenPorCanal([conv("whatsapp"), conv("instagram")]);
    const b = origenPorCanal([conv("instagram"), conv("whatsapp")]);
    expect(a.map((f) => f.canal)).toEqual(b.map((f) => f.canal));
    expect(a.map((f) => f.canal)).toEqual(["instagram", "whatsapp"]);
  });

  it("cuenta lo que falta atender: abiertas o sin dueño", () => {
    const [wa] = origenPorCanal([
      conv("whatsapp", "nuevo"), // abierta y sin dueño
      conv("whatsapp", "en_progreso", "s2"), // abierta, con dueño
      conv("whatsapp", "resuelto"), // cerrada pero sin dueño
      conv("whatsapp", "resuelto", "s3"), // atendida y cerrada
    ]);
    expect(wa).toMatchObject({
      total: 4,
      sinResolver: 2,
      sinAsignar: 2,
      pendientes: 3,
    });
  });

  it("un canal atendido al día no deja pendientes", () => {
    const [fb] = origenPorCanal([conv("facebook", "resuelto", "s5")]);
    expect(fb.pendientes).toBe(0);
  });
});
