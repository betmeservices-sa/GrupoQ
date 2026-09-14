// Lo que el filtro de periodo le hace al tablero de la agencia.
//
// El reclamo que lo originó: con "Hoy" cambiaba el consumo pero la plata y
// los tickets seguían mostrando 30 días. Estas pruebas cuidan que todo se corte
// con el mismo periodo y que los dos bloques de reservas cuadren entre sí.

import { describe, expect, it } from "vitest";
import {
  PERIODOS_AGENCIA,
  confirmadasDelPeriodo,
  enRango,
  reservasDelPeriodo,
  ticketsDelPeriodo,
} from "@/lib/agencia-resumen";

// "Hoy" del 14 de septiembre en El Salvador: de 06:00 UTC a 06:00 UTC del 15.
const DESDE = "2026-09-14T06:00:00.000Z";
const HASTA = "2026-09-15T06:00:00.000Z";

const reserva = (estado: string, creada: string, total = 100, confirmadaTs: string | null = null) => ({
  estado,
  creada,
  total,
  confirmadaTs,
});

describe("los filtros del tablero", () => {
  it("son hoy, ayer, 7 días, 30 días y rango, en ese orden", () => {
    expect(PERIODOS_AGENCIA).toEqual(["hoy", "ayer", "7d", "30d", "rango"]);
  });
});

describe("enRango", () => {
  it("incluye el inicio y deja afuera el final", () => {
    expect(enRango(DESDE, DESDE, HASTA)).toBe(true);
    expect(enRango(HASTA, DESDE, HASTA)).toBe(false);
  });

  it("entiende la fecha como la devuelve la base, con +00:00", () => {
    expect(enRango("2026-09-14T06:00:00+00:00", DESDE, HASTA)).toBe(true);
    expect(enRango("2026-09-14T05:59:59+00:00", DESDE, HASTA)).toBe(false);
  });

  it("sin fecha no cuenta", () => {
    expect(enRango(null, DESDE, HASTA)).toBe(false);
    expect(enRango("no es fecha", DESDE, HASTA)).toBe(false);
  });
});

describe("las estadías del periodo", () => {
  const reservas = [
    reserva("confirmada", "2026-09-14T15:00:00+00:00", 250.4),
    reserva("confirmada", "2026-09-13T15:00:00+00:00", 999),
    reserva("pendiente_pago", "2026-09-14T16:00:00+00:00", 80),
    reserva("comprobante_recibido", "2026-09-14T17:00:00+00:00", 120),
    reserva("rechazada", "2026-09-14T18:00:00+00:00", 60),
  ];

  it("solo cuenta lo que se apartó dentro del periodo", () => {
    const r = reservasDelPeriodo(reservas, DESDE, HASTA);
    expect(r.confirmadas).toEqual({ n: 1, total: 250 });
    expect(r.rechazadas).toBe(1);
  });

  it("esperando junta lo que no tiene comprobante con lo que falta verificar", () => {
    const r = reservasDelPeriodo(reservas, DESDE, HASTA);
    expect(r.esperando).toEqual({ n: 2, total: 200 });
  });

  it("quién cerró cuenta las mismas confirmadas que el bloque de la plata", () => {
    const r = reservasDelPeriodo(reservas, DESDE, HASTA);
    expect(confirmadasDelPeriodo(reservas, DESDE, HASTA)).toHaveLength(r.confirmadas.n);
  });

  it("la confirmada más reciente va primero", () => {
    const c = confirmadasDelPeriodo(
      [
        reserva("confirmada", "2026-09-14T08:00:00+00:00", 1, "2026-09-14T09:00:00+00:00"),
        reserva("confirmada", "2026-09-14T07:00:00+00:00", 2, "2026-09-14T20:00:00+00:00"),
      ],
      DESDE,
      HASTA,
    );
    expect(c.map((x) => x.total)).toEqual([2, 1]);
  });
});

describe("los tickets del periodo", () => {
  const ticket = (creado: string, estado: string, extra: { resuelto?: string; creadoPor?: string; tipo?: string } = {}) => ({
    creado,
    estado,
    resuelto: extra.resuelto,
    creadoPor: extra.creadoPor ?? "Verónica",
    tipo: extra.tipo ?? "pago",
  });

  const tickets = [
    ticket("2026-09-14T10:00:00+00:00", "abierto", { creadoPor: "Sofía", tipo: "pago" }),
    ticket("2026-09-14T11:00:00+00:00", "resuelto", { resuelto: "2026-09-14T11:30:00+00:00", tipo: "pago" }),
    ticket("2026-09-14T12:00:00+00:00", "resuelto", { resuelto: "2026-09-14T13:00:00+00:00", creadoPor: "sofia ", tipo: "queja" }),
    ticket("2026-09-10T10:00:00+00:00", "abierto", { creadoPor: "Sofía" }),
  ];

  it("un ticket de otro día no entra en ninguna cuenta", () => {
    const t = ticketsDelPeriodo(tickets, DESDE, HASTA);
    expect(t.periodo).toBe(3);
    expect(t.abiertos).toBe(1);
    expect(t.resueltos).toBe(2);
    expect(t.porSofia).toBe(2);
  });

  it("la mediana sale de los resueltos del periodo", () => {
    expect(ticketsDelPeriodo(tickets, DESDE, HASTA).medianaMinutos).toBe(30);
  });

  it("los tipos van del más repetido al menos", () => {
    expect(ticketsDelPeriodo(tickets, DESDE, HASTA).porTipo).toEqual([
      { tipo: "pago", n: 2 },
      { tipo: "queja", n: 1 },
    ]);
  });
});
