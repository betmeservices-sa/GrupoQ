import { describe, expect, it } from "vitest";
import { claveDeDia, diaDelHilo } from "../format";

describe("diaDelHilo", () => {
  const ahora = new Date("2026-08-28T20:00:00Z"); // 2 p.m. en El Salvador
  it("hoy, ayer y el resto con día de la semana", () => {
    expect(diaDelHilo("2026-08-28T15:00:00Z", ahora)).toBe("Hoy");
    expect(diaDelHilo("2026-08-27T23:30:00Z", ahora)).toBe("Ayer");
    expect(diaDelHilo("2026-08-24T18:00:00Z", ahora)).toMatch(/lunes,? 24 de agosto/);
    expect(diaDelHilo("2025-12-24T18:00:00Z", ahora)).toMatch(/2025/);
  });
  it("la clave de día respeta la zona del panel (la medianoche UTC sigue siendo el día anterior en SV)", () => {
    expect(claveDeDia("2026-08-28T03:00:00Z")).toBe("2026-08-27");
    expect(claveDeDia("2026-08-28T12:00:00Z")).toBe("2026-08-28");
  });
});
