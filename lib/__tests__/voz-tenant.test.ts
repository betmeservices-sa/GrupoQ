import { describe, expect, it } from "vitest";
import {
  assistantIdDeTenant,
  esAgencia,
  soloDelTenant,
  veModuloVoz,
} from "../tenants/voz";

// El agente de Excel es el que sostiene el modulo del cliente; el resto entra
// para probar que NO se cuela nada de otro cliente.
const EXCEL = "4f589f34-f3e0-43e2-bbeb-baf8854668e7";
const GRUPOQ = "f4e60d15-31f9-4278-b014-fb1e0ab1eaff";
const HOSPITAL = "a934532e-a9c5-43c5-83d5-c95092bac36b";

const llamadas = [
  { id: "1", assistantId: EXCEL },
  { id: "2", assistantId: GRUPOQ },
  { id: "3", assistantId: HOSPITAL },
  { id: "4", assistantId: "otro-cliente-cualquiera" },
  { id: "5" },
];

describe("agente por tenant", () => {
  it("cada tenant declara el suyo", () => {
    expect(assistantIdDeTenant("excel")).toBe(EXCEL);
    expect(assistantIdDeTenant("grupoq")).toBe(GRUPOQ);
    expect(assistantIdDeTenant("hospital")).toBe(HOSPITAL);
  });

  it("hotel e inmobiliaria no tienen voz, asi que no ven el modulo", () => {
    expect(assistantIdDeTenant("hotel")).toBeNull();
    expect(assistantIdDeTenant("inmobiliaria")).toBeNull();
    expect(veModuloVoz("hotel")).toBe(false);
    expect(veModuloVoz("inmobiliaria")).toBe(false);
  });

  it("la agencia es miagentia y ve el modulo aunque no declare agente", () => {
    expect(esAgencia("miagentia")).toBe(true);
    expect(esAgencia("excel")).toBe(false);
    expect(veModuloVoz("miagentia")).toBe(true);
    expect(veModuloVoz("excel")).toBe(true);
  });
});

describe("soloDelTenant", () => {
  it("a un cliente solo le llegan las llamadas de SU agente", () => {
    expect(soloDelTenant(llamadas, "excel").map((c) => c.id)).toEqual(["1"]);
    expect(soloDelTenant(llamadas, "grupoq").map((c) => c.id)).toEqual(["2"]);
    expect(soloDelTenant(llamadas, "hospital").map((c) => c.id)).toEqual(["3"]);
  });

  it("la agencia recibe la cuenta completa", () => {
    expect(soloDelTenant(llamadas, "miagentia")).toHaveLength(llamadas.length);
  });

  it("un tenant sin agente recibe vacio, nunca todo", () => {
    expect(soloDelTenant(llamadas, "hotel")).toEqual([]);
    expect(soloDelTenant(llamadas, "inmobiliaria")).toEqual([]);
  });

  it("una llamada sin agente no cae en ningun cliente", () => {
    for (const t of ["excel", "grupoq", "hospital"] as const) {
      expect(soloDelTenant(llamadas, t).some((c) => c.id === "5")).toBe(false);
    }
  });
});
