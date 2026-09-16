// El monto dicho POR ESCRITO en el chat.
//
// Acá pesan más los "no" que los "sí": en un chat de concesionario casi ningún
// número es el monto del crédito (son fechas, horas, plazos, cuotas, teléfonos
// y años de vehículo), y un monto inventado mete plata falsa en el embudo, que
// se ve igual de bien que la verdadera.

import { describe, expect, it } from "vitest";
import { montoDelChat } from "@/lib/monto-del-chat";

describe("cuando SÍ está diciendo cuánto quiere", () => {
  const si: Array<[string, number]> = [
    ["ando buscando financiamiento de 15 mil", 15000],
    ["quiero un credito de $12,500", 12500],
    ["necesito financiar 20 mil dolares", 20000],
    ["busco algo de quince mil", 15000],
    ["me interesa, ando viendo algo de 18 mil", 18000],
    ["quisiera un prestamo de 9500", 9500],
    ["tengo como 3 mil de prima y quiero financiar 12 mil", 3000],
  ];
  for (const [texto, esperado] of si) {
    it(JSON.stringify(texto), () => expect(montoDelChat(texto)).toBe(esperado));
  }
});

describe("cuando NO, aunque haya números", () => {
  const no: Array<[string, string]> = [
    ["puedo pasar el 15 de octubre", "fecha"],
    ["le caigo el 15/10", "fecha con barras"],
    ["me interesa, nos vemos a las 3", "hora"],
    ["quiero financiar a 36 meses", "plazo"],
    ["busco algo a 5 años", "plazo"],
    ["quiero pagar 250 al mes", "cuota"],
    ["necesito cuotas de 300 mensuales", "cuota"],
    ["mi numero es 75391721", "teléfono"],
    ["ando viendo un hyundai 2018", "año del vehículo"],
    ["quiero 15", "número suelto sin mil ni dólar"],
    ["hola buenas tardes", "sin números"],
    ["el carro tiene 90000 km", "kilometraje"],
    ["", "vacío"],
  ];
  for (const [texto, por] of no) {
    it(`${por}: ${JSON.stringify(texto)}`, () => expect(montoDelChat(texto)).toBeNull());
  }

  it("un número grande sin ninguna intención tampoco cuenta", () => {
    // Sin señal de que esté hablando de plata, 15000 puede ser cualquier cosa.
    expect(montoDelChat("el recorrido son 15000")).toBeNull();
  });

  it("fuera del rango de un crédito de vehículo", () => {
    expect(montoDelChat("quiero financiar 2 millones")).toBeNull();
    expect(montoDelChat("busco algo de $300")).toBeNull();
  });
});

describe("la plata del mensaje gana a los números de al lado", () => {
  it("toma el monto aunque venga con plazo en la misma frase", () => {
    expect(montoDelChat("quiero financiar 14 mil a 48 meses")).toBe(14000);
  });

  it("no confunde la cuota con el monto", () => {
    expect(montoDelChat("busco un credito de 16 mil, pagando 350 al mes")).toBe(16000);
  });
});
