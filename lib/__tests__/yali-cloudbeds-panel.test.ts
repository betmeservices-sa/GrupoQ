import { describe, expect, it } from "vitest";
import { canalDeFuente, reservasDeDetalle, sedeConTiposDeCloudbeds, type DetalleReservaApi } from "../yali-cloudbeds-panel";
import { construirPanelYali } from "../yali-pms";
import { SEDES_YALI } from "../tenants/yali-inventario";

const SEDE = { id: "a" as const, nombre: "Yalí" };

// Con la forma exacta que devolvió getReservation en Yalí (27 ago 2026).
const RESERVA: DetalleReservaApi = {
  reservationID: "5PMKT95BU4",
  status: "confirmed",
  guestName: "RICARDO CASTRO",
  sourceName: "On Site",
  total: 65,
  assigned: [
    {
      roomTypeID: "8077354164424",
      roomTypeName: "Planta Baja",
      startDate: "2026-08-27",
      endDate: "2026-08-28",
      adults: "2",
      children: "0",
      roomTotal: "65.00",
      dailyRates: [{ date: "2026-08-27", rate: 65 }],
    },
  ],
  unassigned: [],
};

describe("canalDeFuente", () => {
  it("reparte las fuentes de Cloudbeds en los canales del panel", () => {
    expect(canalDeFuente("Whatsapp")).toBe("WhatsApp");
    expect(canalDeFuente("Booking.com")).toBe("Booking");
    expect(canalDeFuente("Website/Booking Engine")).toBe("Web");
    expect(canalDeFuente("Expedia")).toBe("Expedia");
    expect(canalDeFuente("Airbnb")).toBe("Airbnb");
    expect(canalDeFuente("Redes sociales")).toBe("Redes");
    expect(canalDeFuente("On Site")).toBe("Directo");
    expect(canalDeFuente("Walk-In")).toBe("Directo");
    expect(canalDeFuente(undefined)).toBe("Directo");
  });
});

describe("reservasDeDetalle", () => {
  it("una habitación = una fila del libro, con lo que cobró Cloudbeds", () => {
    const [r] = reservasDeDetalle(RESERVA, SEDE);
    expect(r).toMatchObject({
      id: "5PMKT95BU4",
      sedeId: "a",
      habitacionId: "8077354164424",
      habitacionNombre: "Planta Baja",
      huesped: "RICARDO CASTRO",
      desde: "2026-08-27",
      hasta: "2026-08-28",
      huespedes: 2,
      total: 65,
      canal: "Directo",
      origen: "pms",
    });
  });

  it("canceladas y no-show no ocupan", () => {
    expect(reservasDeDetalle({ ...RESERVA, status: "canceled" }, SEDE)).toEqual([]);
    expect(reservasDeDetalle({ ...RESERVA, status: "no_show" }, SEDE)).toEqual([]);
  });

  it("una reserva con dos habitaciones da dos filas con ids distintos", () => {
    const dos = reservasDeDetalle(
      {
        ...RESERVA,
        assigned: [RESERVA.assigned![0], { ...RESERVA.assigned![0], roomTypeID: "x", roomTypeName: "Bungalow", roomTotal: "120" }],
      },
      SEDE,
    );
    expect(dos.map((r) => r.id)).toEqual(["5PMKT95BU4-1", "5PMKT95BU4-2"]);
    expect(dos[1].total).toBe(120);
  });

  it("sin roomTotal suma las tarifas diarias; sin nada, el total de la reserva", () => {
    const h = { ...RESERVA.assigned![0], roomTotal: undefined, dailyRates: [{ date: "2026-08-27", rate: "40" }, { date: "2026-08-28", rate: 50 }], endDate: "2026-08-29" };
    expect(reservasDeDetalle({ ...RESERVA, assigned: [h] }, SEDE)[0].total).toBe(90);
    expect(reservasDeDetalle({ ...RESERVA, total: "77", assigned: [{ ...h, dailyRates: [] }] }, SEDE)[0].total).toBe(77);
  });

  it("también cuenta las habitaciones sin asignar y las salidas de hoy", () => {
    const r = reservasDeDetalle({ ...RESERVA, status: "checked_out", assigned: [], unassigned: RESERVA.assigned }, SEDE);
    expect(r).toHaveLength(1);
  });
});

describe("sedeConTiposDeCloudbeds", () => {
  const tipos = [
    { roomTypeID: "1", roomTypeName: "Bungalow", maxGuests: "2", roomTypeUnits: "3" },
    { roomTypeID: "2", roomTypeName: "Garden View (Dobles)", maxGuests: 4, roomTypeUnits: 6 },
  ];

  it("usa las unidades reales y la tarifa cobrada; si no hubo, la del inventario", () => {
    const libro = reservasDeDetalle(
      { ...RESERVA, assigned: [{ ...RESERVA.assigned![0], roomTypeID: "1", roomTypeName: "Bungalow", roomTotal: "300", endDate: "2026-08-29" }] },
      SEDE,
    );
    const s = sedeConTiposDeCloudbeds(SEDES_YALI[0], tipos, libro);
    expect(s.tarifasConfirmadas).toBe(true);
    expect(s.habitaciones.map((h) => h.id)).toEqual(["1", "2"]);
    expect(s.habitaciones[0]).toMatchObject({ nombre: "Bungalow", unidades: 3, tarifaDemo: 150, maxHuespedes: 2 });
    // "Garden View (Dobles)" no existe en Yalí: queda con lo que dice Cloudbeds.
    expect(s.habitaciones[1]).toMatchObject({ nombre: "Garden View (Dobles)", unidades: 6, tarifaDemo: 0 });
  });

  it("empareja 'Garden View (Dobles)' con 'Garden View' del inventario", () => {
    const s = sedeConTiposDeCloudbeds(SEDES_YALI[1], tipos, []);
    const gv = SEDES_YALI[1].habitaciones.find((h) => h.nombre === "Garden View")!;
    expect(s.habitaciones[1].tarifaDemo).toBe(gv.tarifaDemo);
    expect(s.habitaciones[1].descripcion).toBe(gv.descripcion);
  });
});

describe("construirPanelYali con sedes en vivo", () => {
  it("marca qué sede es real y cuáles siguen en demostración", () => {
    const p = construirPanelYali({
      sedes: SEDES_YALI,
      libro: reservasDeDetalle(RESERVA, SEDE),
      hoy: "2026-08-27",
      dias: 7,
      ahora: "2026-08-27T18:00:00.000Z",
      enVivo: ["a"],
    });
    expect(p.sedes.map((s) => s.enVivo)).toEqual([true, false, false]);
    expect(p.sedesDemo).toEqual(["Costa del Surf", "Playa Linda"]);
    expect(p.tarifasConfirmadas).toBe(false);
    expect(p.sedes[0].llegadasHoy).toBe(1);
    expect(p.sedes[0].ingresoVentana).toBe(65);
  });

  it("con las tres en vivo ya no hay nada de demostración", () => {
    const p = construirPanelYali({
      sedes: SEDES_YALI,
      libro: [],
      hoy: "2026-08-27",
      dias: 7,
      ahora: "2026-08-27T18:00:00.000Z",
      enVivo: ["a", "b", "c"],
    });
    expect(p.sedesDemo).toEqual([]);
    expect(p.tarifasConfirmadas).toBe(true);
  });
});
