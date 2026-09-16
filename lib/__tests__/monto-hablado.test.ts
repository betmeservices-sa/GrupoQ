// Cuánto quiere financiar, leído de lo que se dijo por teléfono.
//
// Esto alimenta la plata del embudo de Grupo Q, así que un número inventado
// sale caro: se ve igual de bien que uno real y nadie lo revisa. Por eso pesan
// más las pruebas de lo que NO se acepta.

import { describe, expect, it } from "vitest";
import { MAXIMO, MINIMO, comoDinero, montoHablado } from "@/lib/monto-hablado";

describe("lo que se dijo en palabras", () => {
  it("entiende el monto completo", () => {
    expect(montoHablado("quince mil")).toBe(15000);
    expect(montoHablado("veinte mil dolares")).toBe(20000);
    expect(montoHablado("doce mil quinientos")).toBe(12500);
  });

  it("quien dice 'quince' quiere decir quince mil", () => {
    // El agente transcribe lo que oye, y nadie financia quince dólares.
    expect(montoHablado("quince")).toBe(15000);
    expect(montoHablado("como unos ocho")).toBe(8000);
  });
});

describe("lo que se dijo con números", () => {
  it("lee el número con o sin separadores", () => {
    expect(montoHablado("$12,500")).toBe(12500);
    expect(montoHablado("12500")).toBe(12500);
    expect(montoHablado("15.000")).toBe(15000);
  });

  it("aplica el mil que viene suelto", () => {
    expect(montoHablado("15 mil")).toBe(15000);
    expect(montoHablado("unos 20 mil dolares")).toBe(20000);
  });

  it("toma el primer número de la frase", () => {
    expect(montoHablado("entre 10 mil y 12 mil")).toBe(10000);
  });
});

describe("lo que NO se acepta", () => {
  it("sin dato es null, no cero", () => {
    // Cero sumaría al embudo como un lead que vale nada, y no es lo mismo que
    // uno del que todavía no sabemos cuánto quiere.
    expect(montoHablado(null)).toBeNull();
    expect(montoHablado("")).toBeNull();
    expect(montoHablado("no sabe todavia")).toBeNull();
    expect(montoHablado("no especificado")).toBeNull();
    expect(montoHablado("ninguno")).toBeNull();
  });

  it("descarta lo que se sale del rango de un crédito de vehículo", () => {
    expect(montoHablado("1.5 millones")).toBeNull();
    expect(montoHablado(`${MAXIMO + 1}`)).toBeNull();
    expect(montoHablado("300")).toBeNull();
  });

  it("acepta los bordes", () => {
    expect(montoHablado(MINIMO)).toBe(MINIMO);
    expect(montoHablado(MAXIMO)).toBe(MAXIMO);
  });

  it("un texto sin ningún número no inventa nada", () => {
    expect(montoHablado("lo que se pueda")).toBeNull();
    expect(montoHablado("depende del carro")).toBeNull();
  });
});

describe("cómo se escribe en el historial", () => {
  it("con separador de miles", () => {
    expect(comoDinero(15000)).toBe("$15,000");
  });
});
