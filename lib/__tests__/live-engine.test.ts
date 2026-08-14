import { describe, expect, it } from "vitest";
import {
  PASO_MAX_MS,
  PASO_MIN_MS,
  RESPUESTA_MAX_MS,
  RESPUESTA_MIN_MS,
  SIM_PREFIJO,
  siguientePaso,
  type ConversacionViva,
} from "../data/live-engine";
import { TENANTS } from "../tenants";
import type { TenantId } from "../tenants/types";

const SIM = {
  turnos: [
    { entra: "Pregunta 1", responde: "Respuesta 1" },
    { entra: "Pregunta 2", responde: "Respuesta 2" },
    { entra: "Pregunta 3", responde: "Respuesta 3" },
  ],
  contactos: [
    { nombre: "Ana Lucía Godoy", canal: "whatsapp" as const, telefono: "50245127788" },
    { nombre: "Byron Chuc", canal: "facebook" as const, handle: "Byron Chuc" },
  ],
};

const BANDEJA: ConversacionViva[] = [
  { id: "v1", canal: "whatsapp" },
  { id: "v2", canal: "instagram" },
  { id: "v3", canal: "whatsapp" },
  { id: "v4", canal: "facebook" },
];

function paso(tick: number, conversaciones = BANDEJA) {
  return siguientePaso({ tick, simulacion: SIM, conversaciones, azar: () => 0 });
}

describe("siguientePaso", () => {
  it("toma el texto y la respuesta del guion del tenant, rotando los turnos", () => {
    expect(paso(0)!.texto).toBe("Pregunta 1");
    expect(paso(0)!.respuesta).toBe("Respuesta 1");
    expect(paso(3)!.texto).toBe("Pregunta 1");
    expect(paso(4)!.texto).toBe("Pregunta 2");
  });

  it("reparte los mensajes entre WhatsApp, Messenger e Instagram", () => {
    const canales = [0, 1, 3, 4, 5].map((t) => {
      const p = paso(t)!;
      return BANDEJA.find((c) => c.id === p.conversationId)!.canal;
    });
    expect(new Set(canales)).toEqual(new Set(["whatsapp", "facebook", "instagram"]));
  });

  it("cada cuatro ticks estrena una conversación con un contacto nuevo", () => {
    const p = paso(2)!;
    expect(p.conversationId).toBe(`${SIM_PREFIJO}1`);
    expect(p.nueva).toBeDefined();
    expect(p.nueva!.nombre).toBe("Ana Lucía Godoy");
    expect(p.nueva!.canal).toBe("whatsapp");
    // Los demás ticks caen en conversaciones que ya estaban.
    expect(paso(0)!.nueva).toBeUndefined();
    expect(paso(1)!.nueva).toBeUndefined();
    expect(paso(3)!.nueva).toBeUndefined();
  });

  it("numera las conversaciones nuevas y va cambiando de contacto", () => {
    const conBandeja = [...BANDEJA, { id: `${SIM_PREFIJO}1`, canal: "whatsapp" as const }];
    const p = siguientePaso({ tick: 6, simulacion: SIM, conversaciones: conBandeja, azar: () => 0 })!;
    expect(p.conversationId).toBe(`${SIM_PREFIJO}2`);
    expect(p.nueva!.nombre).toBe("Byron Chuc");
    expect(p.nueva!.canal).toBe("facebook");
  });

  it("con la bandeja vacía siempre abre conversación", () => {
    const p = siguientePaso({ tick: 0, simulacion: SIM, conversaciones: [], azar: () => 0 })!;
    expect(p.nueva).toBeDefined();
    expect(p.conversationId).toBe(`${SIM_PREFIJO}1`);
  });

  it("nunca escribe en una conversación real de WhatsApp o Messenger", () => {
    const reales: ConversacionViva[] = [
      { id: "wac-50376294980", canal: "whatsapp" },
      { id: "metac-instagram-111-222", canal: "instagram" },
    ];
    for (const tick of [0, 1, 3, 4, 5]) {
      const p = siguientePaso({ tick, simulacion: SIM, conversaciones: reales, azar: () => 0 })!;
      expect(p.conversationId.startsWith(SIM_PREFIJO)).toBe(true);
    }
  });

  it("sin guion no pasa nada", () => {
    const vacio = { turnos: [], contactos: [] };
    expect(siguientePaso({ tick: 0, simulacion: vacio, conversaciones: BANDEJA })).toBeNull();
  });
});

describe("ritmo de la simulación", () => {
  it("mantiene un compás grabable, con variación", () => {
    expect(PASO_MIN_MS).toBeLessThan(PASO_MAX_MS);
    expect(PASO_MAX_MS).toBeLessThanOrEqual(9000);
    // La respuesta llega antes del siguiente mensaje, y nunca es instantánea.
    expect(RESPUESTA_MIN_MS).toBeGreaterThan(1500);
    expect(RESPUESTA_MAX_MS).toBeLessThan(PASO_MIN_MS + PASO_MAX_MS);
  });
});

describe("guion por tenant", () => {
  const ids = Object.keys(TENANTS) as TenantId[];

  it("todos los clientes traen turnos y contactos propios", () => {
    for (const id of ids) {
      const { turnos, contactos } = TENANTS[id].simulacion;
      expect(turnos.length, id).toBeGreaterThanOrEqual(8);
      expect(contactos.length, id).toBeGreaterThanOrEqual(4);
      for (const t of turnos) {
        expect(t.entra.length, id).toBeGreaterThan(0);
        expect(t.responde.length, id).toBeGreaterThan(0);
      }
      // Los contactos nuevos llegan por los tres canales, no por uno solo.
      expect(new Set(contactos.map((c) => c.canal)).size, id).toBeGreaterThanOrEqual(3);
    }
  });

  it("el hotel pregunta por hospedaje y la inmobiliaria por propiedades", () => {
    const hotel = TENANTS.hotel.simulacion.turnos.map((t) => t.entra).join(" ").toLowerCase();
    expect(hotel).toContain("check in");
    expect(hotel).toContain("mascotas");
    expect(hotel).toContain("aeropuerto");
    expect(hotel).not.toContain("frontier");

    const inmo = TENANTS.inmobiliaria.simulacion.turnos.map((t) => t.entra).join(" ").toLowerCase();
    expect(inmo).toContain("prima");
    expect(inmo).not.toContain("check in");
  });

  it("ningún guion usa guiones largos", () => {
    for (const id of ids) {
      for (const t of TENANTS[id].simulacion.turnos) {
        expect(t.entra.includes("—"), id).toBe(false);
        expect(t.responde.includes("—"), id).toBe(false);
      }
    }
  });
});
