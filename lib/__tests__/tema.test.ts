import { describe, expect, it } from "vitest";
import { temaDe } from "../tema";

describe("temaDe", () => {
  it("las preguntas de Yali de estos dias", () => {
    expect(temaDe("buen dia, que incluye el day pass premium?")).toBe("day_pass");
    expect(temaDe("Cuando cuesta por Persona y la entrada")).toBe("precio");
    expect(temaDe("Donde queda el hotel")).toBe("ubicacion");
    expect(temaDe("Requisitos para adquirir la membresía")).toBe("membresia");
    expect(temaDe("Estaba interesado en reservar para mañana")).toBe("reserva");
    expect(temaDe("Hay habitaciones para pasar el día?")).toBe("day_pass");
    expect(temaDe("Que es el menu salvadoreño")).toBe("menu");
    expect(temaDe("Locación?")).toBe("ubicacion");
    expect(temaDe("A que hora abren")).toBe("horarios");
  });

  it("un reclamo es reclamo aunque hable de otra cosa", () => {
    expect(temaDe("nos discriminaron y nos sacaron de la piscina. Supuestamente por no ser miembros")).toBe("reclamo");
    expect(temaDe("Mentiras, no existe el DePass para otros")).toBe("reclamo");
  });

  it("sin señales, otro", () => {
    expect(temaDe("Gracias")).toBe("otro");
    expect(temaDe("")).toBe("otro");
    expect(temaDe(null)).toBe("otro");
  });
});
