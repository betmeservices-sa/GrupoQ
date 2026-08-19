// El motor de ocupación de Yali Hospitality. Lo que cuidan estas pruebas:
//   - que sea DETERMINISTA (dos corridas del demo tienen que dar igual);
//   - que no venda dos veces la misma habitación la misma noche;
//   - que la disponibilidad respete capacidad y todas las noches del rango;
//   - que el panel no invente ocupación ni ingresos.
import { describe, it, expect, beforeEach } from "vitest";
import {
  construirPanelYali,
  cubre,
  disponibilidad,
  libroDeSede,
  ruido,
  type ReservaYali,
} from "@/lib/yali-pms";
import { SEDES_YALI, unidadesDeSede } from "@/lib/tenants/yali-inventario";
import { borrarReservasYali } from "@/lib/yali-reservas";

const DESDE = "2026-08-17"; // lunes
const DIAS = 14;
const SEDE = SEDES_YALI[0];

beforeEach(() => {
  borrarReservasYali();
});

describe("ruido determinista", () => {
  it("la misma llave siempre da el mismo número, y está en [0,1)", () => {
    const a = ruido("yali|bungalow|0|2026-08-17");
    expect(ruido("yali|bungalow|0|2026-08-17")).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it("llaves distintas dan números distintos", () => {
    expect(ruido("a")).not.toBe(ruido("b"));
  });
});

describe("libro de reservas", () => {
  const libro = libroDeSede(SEDE, DESDE, DIAS);

  it("se repite igual entre corridas", () => {
    expect(libroDeSede(SEDE, DESDE, DIAS)).toEqual(libro);
  });

  it("genera reservas y todas son de esa sede", () => {
    expect(libro.length).toBeGreaterThan(0);
    for (const r of libro) expect(r.sedeId).toBe(SEDE.id);
  });

  it("cada estadía dura al menos una noche y como mucho tres", () => {
    for (const r of libro) {
      expect(r.desde < r.hasta).toBe(true);
      const noches = (Date.parse(r.hasta) - Date.parse(r.desde)) / 86400000;
      expect(noches).toBeGreaterThanOrEqual(1);
      expect(noches).toBeLessThanOrEqual(3);
    }
  });

  it("nunca vende más unidades de las que existen", () => {
    for (const hab of SEDE.habitaciones) {
      for (let i = 0; i < DIAS; i++) {
        const fecha = new Date(Date.parse(DESDE) + i * 86400000).toISOString().slice(0, 10);
        const ocupadas = libro.filter((r) => r.habitacionId === hab.id && cubre(r, fecha)).length;
        expect(ocupadas, `${hab.nombre} el ${fecha}`).toBeLessThanOrEqual(hab.unidades);
      }
    }
  });

  it("el total cuadra con la tarifa por las noches", () => {
    for (const r of libro) {
      const hab = SEDE.habitaciones.find((h) => h.id === r.habitacionId)!;
      const noches = (Date.parse(r.hasta) - Date.parse(r.desde)) / 86400000;
      expect(r.total).toBe(hab.tarifaDemo * noches);
    }
  });

  it("el grupo nunca supera la capacidad de la habitación", () => {
    for (const r of libro) {
      const hab = SEDE.habitaciones.find((h) => h.id === r.habitacionId)!;
      expect(r.huespedes).toBeGreaterThanOrEqual(1);
      expect(r.huespedes).toBeLessThanOrEqual(hab.maxHuespedes);
    }
  });
});

describe("la noche de salida ya no ocupa", () => {
  it("cubre la entrada pero no la salida", () => {
    const r = { desde: "2026-08-20", hasta: "2026-08-22" };
    expect(cubre(r, "2026-08-19")).toBe(false);
    expect(cubre(r, "2026-08-20")).toBe(true);
    expect(cubre(r, "2026-08-21")).toBe(true);
    expect(cubre(r, "2026-08-22")).toBe(false);
  });
});

describe("disponibilidad", () => {
  const libro = libroDeSede(SEDE, DESDE, DIAS);

  it("un rango invertido no ofrece nada", () => {
    expect(disponibilidad(SEDE, libro, "2026-08-20", "2026-08-20", 2)).toEqual([]);
    expect(disponibilidad(SEDE, libro, "2026-08-20", "2026-08-19", 2)).toEqual([]);
  });

  it("solo ofrece habitaciones que aguanten al grupo", () => {
    const ops = disponibilidad(SEDE, libro, "2026-08-20", "2026-08-22", 6);
    for (const o of ops) expect(o.hasta_huespedes).toBeGreaterThanOrEqual(6);
  });

  it("una habitación ofrecida está libre TODAS las noches del rango", () => {
    const ops = disponibilidad(SEDE, libro, "2026-08-20", "2026-08-23", 2);
    for (const o of ops) {
      const hab = SEDE.habitaciones.find((h) => h.id === o.habitacion_id)!;
      for (const fecha of ["2026-08-20", "2026-08-21", "2026-08-22"]) {
        const ocupadas = libro.filter((r) => r.habitacionId === hab.id && cubre(r, fecha)).length;
        expect(hab.unidades - ocupadas, `${hab.nombre} el ${fecha}`).toBeGreaterThan(0);
      }
    }
  });

  it("el total de la estadía es la tarifa por las noches, y ordena de menor a mayor", () => {
    const ops = disponibilidad(SEDE, libro, "2026-08-20", "2026-08-23", 2);
    for (const o of ops) expect(o.total_estadia).toBe(o.tarifa_por_noche * 3);
    const totales = ops.map((o) => o.total_estadia);
    expect([...totales].sort((a, b) => a - b)).toEqual(totales);
  });

  it("si una reserva del demo tapa la última unidad, esa habitación deja de ofrecerse", () => {
    const hab = SEDE.habitaciones.find((h) => h.unidades >= 1)!;
    // Se llena a mano ese tipo para las tres noches del rango.
    const tapon: ReservaYali[] = Array.from({ length: hab.unidades }, (_, i) => ({
      id: `tap-${i}`,
      sedeId: SEDE.id,
      sedeNombre: SEDE.nombre,
      habitacionId: hab.id,
      habitacionNombre: hab.nombre,
      huesped: "Prueba",
      desde: "2026-09-10",
      hasta: "2026-09-13",
      huespedes: 1,
      total: 0,
      canal: "Directo" as const,
      origen: "demo" as const,
    }));
    const ops = disponibilidad(SEDE, tapon, "2026-09-10", "2026-09-13", 1);
    expect(ops.find((o) => o.habitacion_id === hab.id)).toBeUndefined();
  });
});

describe("panel del dueño", () => {
  const libro = SEDES_YALI.flatMap((s) => libroDeSede(s, DESDE, DIAS));
  const panel = construirPanelYali({
    sedes: SEDES_YALI,
    libro,
    hoy: DESDE,
    dias: DIAS,
    ahora: "2026-08-17T12:00:00.000Z",
  });

  it("cuenta las tres sedes y todas sus habitaciones", () => {
    expect(panel.sedes).toHaveLength(3);
    expect(panel.kpis.unidades).toBe(SEDES_YALI.reduce((n, s) => n + unidadesDeSede(s), 0));
  });

  it("la ocupación de hoy nunca pasa del 100 por ciento", () => {
    expect(panel.kpis.ocupacionHoyPct).toBeGreaterThanOrEqual(0);
    expect(panel.kpis.ocupacionHoyPct).toBeLessThanOrEqual(100);
    for (const s of panel.sedes) expect(s.ocupadasHoy).toBeLessThanOrEqual(s.unidades);
  });

  it("las noches vendidas no pasan de las vendibles", () => {
    expect(panel.kpis.nochesVendidas).toBeLessThanOrEqual(panel.kpis.nochesVendibles);
  });

  it("la tarifa media sale del ingreso entre las noches REALMENTE vendidas", () => {
    expect(panel.kpis.tarifaMedia).toBe(
      Math.round(panel.kpis.ingresoVentana / panel.kpis.nochesVendidas),
    );
  });

  it("marca las tarifas como sin confirmar mientras el hotel no las dé", () => {
    expect(panel.tarifasConfirmadas).toBe(false);
  });

  it("las llegadas que muestra son futuras y van ordenadas", () => {
    for (const l of panel.llegadas) expect(l.desde >= panel.hoy).toBe(true);
    const fechas = panel.llegadas.map((l) => l.desde);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it("el reparto por canal suma las reservas de la ventana", () => {
    const suma = panel.porCanal.reduce((n, c) => n + c.reservas, 0);
    expect(suma).toBe(panel.kpis.reservasVentana);
  });

  // La pestaña de cada hotel muestra SUS cifras: si se colara una reserva de
  // otra sede, el dueño estaría mirando el negocio equivocado.
  it("cada sede trae su propio corte, y lo que suma cuadra con el total", () => {
    for (const s of panel.sedes) {
      expect(s.porCanal.reduce((n, c) => n + c.reservas, 0)).toBe(s.reservasVentana);
      for (const l of s.llegadas) {
        expect(l.sedeId).toBe(s.id);
        expect(l.desde >= panel.hoy).toBe(true);
      }
      expect(s.tarifaMedia).toBe(
        s.nochesVendidas === 0 ? 0 : Math.round(s.ingresoVentana / s.nochesVendidas),
      );
    }
    expect(panel.sedes.reduce((n, s) => n + s.reservasVentana, 0)).toBe(panel.kpis.reservasVentana);
    expect(panel.sedes.reduce((n, s) => n + s.ingresoVentana, 0)).toBe(panel.kpis.ingresoVentana);
    expect(panel.sedes.reduce((n, s) => n + s.huespedesEnCasa, 0)).toBe(panel.kpis.huespedesEnCasa);
  });

  // REGRESIÓN: quien se va hoy entró antes y ya no ocupa ninguna noche de la
  // ventana. Contándolo solo dentro de la ventana, recepción veía siempre cero
  // salidas y el panel parecía roto.
  it("cuenta las salidas de hoy aunque la reserva ya no ocupe noches", () => {
    const seVa: ReservaYali = {
      id: "salida-1",
      sedeId: SEDES_YALI[0].id,
      sedeNombre: SEDES_YALI[0].nombre,
      habitacionId: SEDES_YALI[0].habitaciones[0].id,
      habitacionNombre: SEDES_YALI[0].habitaciones[0].nombre,
      huesped: "Se va hoy",
      desde: "2026-08-15",
      hasta: DESDE,
      huespedes: 2,
      total: 290,
      canal: "Directo",
      origen: "demo",
    };
    const p = construirPanelYali({
      sedes: SEDES_YALI,
      libro: [seVa],
      hoy: DESDE,
      dias: DIAS,
      ahora: "2026-08-17T12:00:00.000Z",
    });
    expect(p.kpis.salidasHoy).toBe(1);
    expect(p.sedes[0].salidasHoy).toBe(1);
    // Y no infla ni la ocupación ni el ingreso de la ventana.
    expect(p.kpis.ocupadasHoy).toBe(0);
    expect(p.kpis.ingresoVentana).toBe(0);
  });

  it("sin reservas no divide entre cero", () => {
    const vacio = construirPanelYali({
      sedes: SEDES_YALI,
      libro: [],
      hoy: DESDE,
      dias: DIAS,
      ahora: "2026-08-17T12:00:00.000Z",
    });
    expect(vacio.kpis.ocupacionHoyPct).toBe(0);
    expect(vacio.kpis.tarifaMedia).toBe(0);
    expect(vacio.porCanal).toEqual([]);
    expect(vacio.llegadas).toEqual([]);
  });
});
