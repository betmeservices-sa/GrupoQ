import { describe, expect, it } from "vitest";
import { fmtDuracion, fmtPorcentaje, fmtUSD } from "../calls-format";

describe("fmtDuracion", () => {
  it("muestra solo segundos por debajo del minuto", () => {
    expect(fmtDuracion(26)).toBe("26s");
  });

  it("muestra minutos y segundos con relleno", () => {
    expect(fmtDuracion(208)).toBe("3m 28s");
  });

  it("muestra un guion cuando es cero", () => {
    expect(fmtDuracion(0)).toBe("—");
  });

  it("muestra un guion cuando es null", () => {
    expect(fmtDuracion(null)).toBe("—");
  });
});

describe("fmtUSD", () => {
  it("usa cuatro decimales para montos chicos", () => {
    expect(fmtUSD(0.0339)).toBe("$0.0339");
  });

  it("usa dos decimales a partir de un dolar", () => {
    expect(fmtUSD(12.5)).toBe("$12.50");
  });

  it("muestra un guion cuando es null", () => {
    expect(fmtUSD(null)).toBe("—");
  });
});

describe("fmtPorcentaje", () => {
  it("convierte una fraccion a porcentaje con un decimal", () => {
    expect(fmtPorcentaje(0.75)).toBe("75.0%");
  });

  it("maneja el cero", () => {
    expect(fmtPorcentaje(0)).toBe("0.0%");
  });
});
