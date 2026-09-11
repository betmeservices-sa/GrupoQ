// Quién cerró cada reserva y a qué hora pasó cada cosa.
//
// Esto se lee para decidir si el agente vale lo que cuesta, así que un número
// mal contado acá vale más caro que un bug de pantalla.

import { describe, expect, it } from "vitest";
import { comoSeCerro, resumirCierres, tandaDelCierre } from "@/lib/cierre-de-reserva";

const T = (dia: number, hora: number, min = 0) =>
  new Date(Date.UTC(2026, 8, dia, hora, min)).toISOString();

const huesped = (ts: string) => ({ direction: "in" as const, ts });
const sofia = (ts: string) => ({ direction: "out" as const, ts, staffId: "ia", staffNombre: "Sofía" });
const vero = (ts: string) => ({ direction: "out" as const, ts, staffId: "s2", staffNombre: "Verónica Viches" });

describe("cuándo empezó de verdad la conversación", () => {
  it("corta donde hubo un silencio largo", () => {
    // El caso real: alguien escribió en abril y volvió en septiembre. Tomar el
    // primer mensaje daría "tardó cinco meses en cerrar" y el trato se hizo en
    // dos días.
    const t = tandaDelCierre(
      [
        huesped(new Date(Date.UTC(2026, 3, 1, 17, 55)).toISOString()),
        sofia(new Date(Date.UTC(2026, 3, 1, 18, 0)).toISOString()),
        huesped(T(9, 14)),
        vero(T(9, 15)),
      ],
      T(9, 16),
    );
    expect(t).toHaveLength(2);
    expect(t[0].ts).toBe(T(9, 14));
  });

  it("sin silencios, la tanda es el hilo entero", () => {
    const hilo = [huesped(T(8, 12)), sofia(T(8, 13)), huesped(T(9, 9))];
    expect(tandaDelCierre(hilo, T(9, 10))).toHaveLength(3);
  });

  it("lo que se hablÓ DESPUÉS del cierre no cuenta", () => {
    // Si no, un "gracias, ahí nos vemos" del día siguiente movería la hora de
    // cierre y el reporte diría que tardó un día más.
    const t = tandaDelCierre([huesped(T(9, 9)), vero(T(9, 10)), huesped(T(9, 20))], T(9, 11));
    expect(t).toHaveLength(2);
  });

  it("sin mensajes, no hay tanda", () => {
    expect(tandaDelCierre([], T(9, 10))).toEqual([]);
  });

  it("las fechas rotas se descartan sin tumbar nada", () => {
    const t = tandaDelCierre([{ direction: "in", ts: "no es fecha" }, huesped(T(9, 9))], T(9, 10));
    expect(t).toHaveLength(1);
  });
});

describe("quién se lleva el trato", () => {
  it("si una persona se metió antes del cierre, es de la persona", () => {
    const c = comoSeCerro([huesped(T(9, 9)), sofia(T(9, 9, 5)), vero(T(9, 10)), huesped(T(9, 11))], T(9, 12));
    expect(c.cerro).toBe("persona");
    expect(c.persona).toBe("Verónica Viches");
    expect(c.pasoAPersona).toBe(T(9, 10));
    expect(c.mensajesAgente).toBe(1);
    expect(c.mensajesPersona).toBe(1);
  });

  it("si Sofía habló sola hasta el final, el trato es de Sofía", () => {
    // Aunque después alguien le dé al botón de confirmar: apretar el botón no
    // es haber cerrado el trato.
    const c = comoSeCerro([huesped(T(9, 9)), sofia(T(9, 9, 5)), huesped(T(9, 9, 30))], T(9, 10));
    expect(c.cerro).toBe("sofia");
    expect(c.pasoAPersona).toBeNull();
    expect(c.persona).toBeNull();
  });

  it("una persona que escribe DESPUÉS del cierre no le quita el trato a Sofía", () => {
    const c = comoSeCerro([huesped(T(9, 9)), sofia(T(9, 9, 5)), vero(T(9, 14))], T(9, 10));
    expect(c.cerro).toBe("sofia");
  });

  it("las horas y los tiempos", () => {
    const c = comoSeCerro([huesped(T(9, 9)), sofia(T(9, 9, 10)), vero(T(9, 11))], T(9, 12, 30));
    expect(c.inicio).toBe(T(9, 9));
    expect(c.minutosHastaPersona).toBe(120);
    expect(c.minutosTotales).toBe(210);
  });

  it("sin hora de cierre no se inventa una duración", () => {
    const c = comoSeCerro([huesped(T(9, 9)), vero(T(9, 10))], null);
    expect(c.minutosTotales).toBeNull();
    expect(c.cerro).toBe("persona");
  });

  it("un hilo vacío no rompe", () => {
    const c = comoSeCerro([], T(9, 10));
    expect(c.cerro).toBe("sofia");
    expect(c.inicio).toBeNull();
    expect(c.mensajesAgente).toBe(0);
  });
});

describe("el titular", () => {
  const cierre = (cerro: "sofia" | "persona", persona: string | null, minutos: number | null) => ({
    inicio: T(9, 9),
    pasoAPersona: persona ? T(9, 10) : null,
    persona,
    cerro,
    mensajesAgente: 3,
    mensajesPersona: persona ? 5 : 0,
    minutosTotales: minutos,
    minutosHastaPersona: persona ? 60 : null,
  });

  const reservas = [
    { total: 100, cierre: cierre("persona", "Verónica Viches", 120) },
    { total: 55, cierre: cierre("persona", "Verónica Viches", 60) },
    { total: 170, cierre: cierre("persona", "Jaime Quintanilla", 300) },
    { total: 65, cierre: cierre("sofia", null, 30) },
  ];

  it("parte la plata entre el agente y la gente", () => {
    const r = resumirCierres(reservas);
    expect(r.total).toBe(4);
    expect(r.sofia).toEqual({ n: 1, total: 65 });
    expect(r.persona).toEqual({ n: 3, total: 325 });
  });

  it("dice quién cerró cuánto, de la que más a la que menos", () => {
    const r = resumirCierres(reservas);
    expect(r.porPersona).toEqual([
      { nombre: "Verónica Viches", n: 2, total: 155 },
      { nombre: "Jaime Quintanilla", n: 1, total: 170 },
    ]);
  });

  it("la mediana de lo que tarda un trato", () => {
    expect(resumirCierres(reservas).medianaMinutos).toBe(120);
  });

  it("sin reservas no inventa nada", () => {
    const r = resumirCierres([]);
    expect(r.total).toBe(0);
    expect(r.medianaMinutos).toBeNull();
    expect(r.porPersona).toEqual([]);
  });

  it("una reserva sin monto suma cero, no rompe", () => {
    const r = resumirCierres([{ cierre: cierre("sofia", null, 10) }]);
    expect(r.sofia).toEqual({ n: 1, total: 0 });
  });

  it("una persona sin nombre no desaparece del reporte", () => {
    const r = resumirCierres([{ total: 40, cierre: cierre("persona", null, 10) }]);
    expect(r.porPersona).toEqual([{ nombre: "El equipo", n: 1, total: 40 }]);
  });
});
