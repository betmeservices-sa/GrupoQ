import { describe, it, expect, beforeEach } from "vitest";
import {
  construirMes,
  diaSemanaLunes,
  diasDelMes,
  fechaDe,
  type EntradaMes,
} from "@/lib/hotel-calendario";
import { borrarReservasSimuladas } from "@/lib/hotel-reservas";
import type { ReservaSimulada } from "@/lib/hotel-reservas";

const TIPOS = [
  { id: "t1", nombre: "Habitación 1", corto: "H01", maxHuespedes: 4, unidades: 1 },
  { id: "t2", nombre: "Habitación 2", corto: "H02", maxHuespedes: 4, unidades: 1 },
  { id: "t3", nombre: "Casa Divina", corto: "CDV", maxHuespedes: 16, unidades: 1 },
];

// Agosto 2026 tiene 31 días y arranca en sábado.
function entrada(over: Partial<EntradaMes> = {}): EntradaMes {
  const noches = Array.from({ length: 31 }, () => [
    { id: "t1", tarifa: 55, disponibles: 1 },
    { id: "t2", tarifa: 33, disponibles: 1 },
  ]);
  return {
    anio: 2026,
    mes: 8,
    hoy: "2026-08-11",
    huespedes: 1,
    tipos: TIPOS,
    noches,
    conTarifa: new Set(["t1", "t2"]),
    simuladas: [],
    ...over,
  };
}

function simulada(over: Partial<ReservaSimulada> = {}): ReservaSimulada {
  return {
    id: "SIM-AAA111",
    huesped: "Paula Marroquín",
    tipoId: "t1",
    tipoNombre: "Habitación 1",
    desde: "2026-08-14",
    hasta: "2026-08-16",
    adultos: 1,
    ninos: 0,
    tarifaTotal: 110,
    creada: "2026-08-11T10:00:00.000Z",
    origen: "panel",
    ...over,
  };
}

describe("utilidades de fecha del calendario", () => {
  it("cuenta los días de cada mes, incluidos los bisiestos", () => {
    expect(diasDelMes(2026, 8)).toBe(31);
    expect(diasDelMes(2026, 4)).toBe(30);
    expect(diasDelMes(2026, 2)).toBe(28);
    expect(diasDelMes(2028, 2)).toBe(29);
    expect(diasDelMes(2026, 12)).toBe(31);
  });

  it("la semana arranca en lunes", () => {
    expect(diaSemanaLunes("2026-08-10")).toBe(0); // lunes
    expect(diaSemanaLunes("2026-08-15")).toBe(5); // sábado
    expect(diaSemanaLunes("2026-08-16")).toBe(6); // domingo
  });

  it("arma la fecha con ceros a la izquierda", () => {
    expect(fechaDe(2026, 8, 1)).toBe("2026-08-01");
    expect(fechaDe(2026, 12, 25)).toBe("2026-12-25");
  });
});

describe("mes del calendario", () => {
  beforeEach(() => borrarReservasSimuladas());

  it("devuelve un día por cada día del mes", () => {
    const m = construirMes(entrada());
    expect(m.dias).toHaveLength(31);
    expect(m.dias[0].fecha).toBe("2026-08-01");
    expect(m.dias[30].fecha).toBe("2026-08-31");
  });

  it("marca como pasados los días anteriores a hoy", () => {
    const m = construirMes(entrada());
    expect(m.dias.find((d) => d.dia === 10)!.pasado).toBe(true);
    expect(m.dias.find((d) => d.dia === 11)!.pasado).toBe(false);
    expect(m.dias.find((d) => d.dia === 12)!.pasado).toBe(false);
  });

  it("lista las habitaciones libres de cada noche con su tarifa y capacidad", () => {
    const dia = construirMes(entrada()).dias[20];
    expect(dia.libres.map((l) => l.nombre)).toEqual(["Habitación 2", "Habitación 1"]);
    expect(dia.libres[0].tarifa).toBe(33);
    expect(dia.libres[0].maxHuespedes).toBe(4);
  });

  it("ordena las opciones de la más barata a la más cara", () => {
    const dia = construirMes(entrada()).dias[20];
    const tarifas = dia.libres.map((l) => l.tarifa);
    expect(tarifas).toEqual([...tarifas].sort((a, b) => a - b));
  });

  it("deja fuera lo que el sistema no devolvió, sin inventarlo", () => {
    const dia = construirMes(entrada()).dias[20];
    expect(dia.libres.some((l) => l.nombre === "Casa Divina")).toBe(false);
  });

  it("no ofrece como libre una habitación tarifada en cero", () => {
    const noches = Array.from({ length: 31 }, () => [
      { id: "t1", tarifa: 0, disponibles: 1 },
      { id: "t2", tarifa: 33, disponibles: 1 },
    ]);
    const dia = construirMes(entrada({ noches })).dias[20];
    expect(dia.libres.map((l) => l.nombre)).toEqual(["Habitación 2"]);
  });

  it("no ofrece como libre una habitación con cero unidades disponibles", () => {
    const noches = Array.from({ length: 31 }, () => [
      { id: "t1", tarifa: 55, disponibles: 0 },
      { id: "t2", tarifa: 33, disponibles: 1 },
    ]);
    const dia = construirMes(entrada({ noches })).dias[20];
    expect(dia.libres.map((l) => l.nombre)).toEqual(["Habitación 2"]);
  });

  // El 429 del sistema llega como null: esa noche no se sabe nada y no puede
  // aparecer como libre.
  it("una noche no leída queda marcada y sin habitaciones libres", () => {
    const noches = entrada().noches.slice();
    noches[13] = null;
    const m = construirMes(entrada({ noches }));
    const dia = m.dias[13];
    expect(dia.leido).toBe(false);
    expect(dia.libres).toHaveLength(0);
    expect(m.dias[14].leido).toBe(true);
  });

  it("una noche leída sin nada libre se distingue de una no leída", () => {
    const noches = entrada().noches.slice();
    noches[13] = [];
    const dia = construirMes(entrada({ noches })).dias[13];
    expect(dia.leido).toBe(true);
    expect(dia.libres).toHaveLength(0);
  });

  it("las reservas del demo se ven en las noches que ocupan, sin la de salida", () => {
    const m = construirMes(entrada({ simuladas: [simulada()] }));
    expect(m.dias[13].simuladas.map((s) => s.id)).toEqual(["SIM-AAA111"]); // 14
    expect(m.dias[14].simuladas.map((s) => s.id)).toEqual(["SIM-AAA111"]); // 15
    expect(m.dias[15].simuladas).toHaveLength(0); // 16, día de salida
    expect(m.dias[12].simuladas).toHaveLength(0); // 13
  });

  it("una habitación tomada por el demo deja de ofrecerse libre esa noche", () => {
    const m = construirMes(entrada({ simuladas: [simulada()] }));
    expect(m.dias[13].libres.map((l) => l.nombre)).toEqual(["Habitación 2"]);
    // La noche de salida vuelve a estar disponible.
    expect(m.dias[15].libres.map((l) => l.nombre)).toEqual(["Habitación 2", "Habitación 1"]);
  });

  it("varias reservas del demo en la misma noche se listan todas", () => {
    const m = construirMes(
      entrada({
        simuladas: [
          simulada(),
          simulada({
            id: "SIM-BBB222",
            tipoId: "t2",
            tipoNombre: "Habitación 2",
            huesped: "Steven Clark",
          }),
        ],
      }),
    );
    expect(m.dias[13].simuladas).toHaveLength(2);
    expect(m.dias[13].libres).toHaveLength(0);
  });

  it("informa cuántas habitaciones tienen tarifa, o null si no se pudo saber", () => {
    expect(construirMes(entrada()).reservables).toBe(2);
    expect(construirMes(entrada({ conTarifa: null })).reservables).toBeNull();
  });

  it("conserva el mes pedido y el número de huéspedes", () => {
    const m = construirMes(entrada({ anio: 2027, mes: 2, huespedes: 4, noches: Array(28).fill([]) }));
    expect(m.anio).toBe(2027);
    expect(m.mes).toBe(2);
    expect(m.huespedes).toBe(4);
    expect(m.dias).toHaveLength(28);
  });

  it("un mes entero en el pasado no reporta ninguna noche leída", () => {
    const m = construirMes(entrada({ mes: 7, noches: Array.from({ length: 31 }, () => null) }));
    expect(m.dias.every((d) => d.pasado)).toBe(true);
    expect(m.dias.every((d) => !d.leido)).toBe(true);
    expect(m.dias.every((d) => d.libres.length === 0)).toBe(true);
  });
});
