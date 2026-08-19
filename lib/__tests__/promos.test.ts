// Las promociones son la única fuente de ofertas del agente. Lo que cuidan
// estas pruebas: que una promo apagada o vencida DESAPAREZCA del guion, y que
// cuando no hay ninguna el guion se lo diga con todas las letras (si no, el
// agente inventa un descuento para cerrar la venta).
import { describe, it, expect } from "vitest";
import {
  bloquePromociones,
  estaVigente,
  promocionesVigentes,
  usaPromos,
  type Promocion,
} from "@/lib/promos";

function promo(p: Partial<Promocion>): Promocion {
  return {
    id: "p1",
    tenant: "yaly",
    nombre: "Escapada de fin de semana",
    descripcion: "Dos noches en Bungalow para dos personas.",
    precio: "$260 las dos noches",
    restricciones: "No aplica en feriados",
    activa: true,
    actualizada: "2026-08-19T00:00:00.000Z",
    ...p,
  };
}

const HOY = "2026-08-19";

describe("vigencia", () => {
  it("una promoción apagada no está vigente aunque esté en fechas", () => {
    expect(estaVigente(promo({ activa: false }), HOY)).toBe(false);
  });

  it("sin fechas, encendida basta", () => {
    expect(estaVigente(promo({}), HOY)).toBe(true);
  });

  it("todavía no arranca o ya venció", () => {
    expect(estaVigente(promo({ desde: "2026-09-01" }), HOY)).toBe(false);
    expect(estaVigente(promo({ hasta: "2026-08-18" }), HOY)).toBe(false);
  });

  it("el último día de vigencia todavía cuenta", () => {
    expect(estaVigente(promo({ hasta: HOY }), HOY)).toBe(true);
    expect(estaVigente(promo({ desde: HOY }), HOY)).toBe(true);
  });

  it("filtra la lista completa", () => {
    const lista = [
      promo({ id: "a" }),
      promo({ id: "b", activa: false }),
      promo({ id: "c", hasta: "2026-01-01" }),
    ];
    expect(promocionesVigentes(lista, HOY).map((p) => p.id)).toEqual(["a"]);
  });
});

describe("bloque que se le pega al guion", () => {
  it("sin promociones le PROHÍBE inventar una", () => {
    const b = bloquePromociones([], HOY);
    expect(b).toMatch(/ninguna en este momento/);
    expect(b).toMatch(/NO ofrezcas, insinúes ni inventes/);
  });

  it("una promo apagada no aparece en el texto", () => {
    const b = bloquePromociones([promo({ activa: false })], HOY);
    expect(b).not.toContain("Escapada de fin de semana");
    expect(b).toMatch(/ninguna en este momento/);
  });

  it("la vigente aparece con precio y restricciones tal cual", () => {
    const b = bloquePromociones([promo({})], HOY);
    expect(b).toContain("Escapada de fin de semana");
    expect(b).toContain("$260 las dos noches");
    expect(b).toContain("No aplica en feriados");
    expect(b).toMatch(/sin redondear ni mejorar la oferta/);
  });

  it("numera varias y respeta el orden recibido", () => {
    const b = bloquePromociones([promo({ id: "a", nombre: "Uno" }), promo({ id: "b", nombre: "Dos" })], HOY);
    expect(b.indexOf("1. \"Uno\"")).toBeGreaterThan(-1);
    expect(b.indexOf("2. \"Dos\"")).toBeGreaterThan(b.indexOf("1. \"Uno\""));
  });

  it("no usa guiones largos", () => {
    expect(bloquePromociones([promo({})], HOY)).not.toContain("—");
    expect(bloquePromociones([], HOY)).not.toContain("—");
  });
});

describe("qué clientes tienen promociones", () => {
  it("hoy solo Yali", () => {
    expect(usaPromos("yaly")).toBe(true);
    expect(usaPromos("hospital")).toBe(false);
    expect(usaPromos("hotel")).toBe(false);
  });
});
