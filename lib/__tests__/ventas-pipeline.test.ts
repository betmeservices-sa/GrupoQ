// El embudo de ventas con expediente.
//
// Lo que cuidan estas pruebas: que la etapa salga del expediente y no de un
// campo que alguien pudo dejar viejo, que un documento devuelto pese más que
// uno que falta (al devuelto hay que volver a pedirlo), que el reparto entre
// vendedores no cargue siempre al mismo, que los plazos de 48 y 72 horas
// disparen cuando toca, y que el reporte del gerente cuente lo del periodo sin
// mezclarlo con la foto de hoy.
import { describe, it, expect } from "vitest";
import { rangoDePeriodo } from "@/lib/periodos";
import {
  alertasDe,
  detalleDocumentacion,
  estancados,
  etapaDe,
  expedienteCompleto,
  nivelDeAlerta,
  reporteVentas,
  siguienteVendedor,
  type Expediente,
  type Solicitud,
  type Vendedor,
} from "@/lib/ventas-pipeline";

const AHORA = new Date("2026-09-03T02:30:00.000Z"); // miércoles 2 de sept, 8:30 p.m. en El Salvador

const VENDEDORES: Vendedor[] = [
  { id: "s2", nombre: "Ana Rivas", iniciales: "AR" },
  { id: "s5", nombre: "Mauricio Alfaro", iniciales: "MA" },
  { id: "s10", nombre: "Roberto Cáceres", iniciales: "RC" },
];

const TODOS_OK: Expediente = {
  dui: { estado: "aprobado" },
  salario: { estado: "aprobado" },
  recibo: { estado: "aprobado" },
  referencias: { estado: "aprobado" },
};

function solicitud(over: Partial<Solicitud> & { telefono: string }): Solicitud {
  return {
    tenant: "grupoq",
    nombre: "Prospecto",
    vehiculo: null,
    expediente: {},
    vendedor: null,
    creado: "2026-08-25T15:00:00.000Z",
    contactado: null,
    pedidos: null,
    completado: null,
    asignado: null,
    tomado: null,
    cerrado: null,
    resultado: null,
    motivoCierre: null,
    avisado: null,
    escalado: null,
    actualizado: "2026-08-25T15:00:00.000Z",
    ...over,
  };
}

describe("etapa", () => {
  it("sale del expediente y las marcas de tiempo, en orden", () => {
    expect(etapaDe(solicitud({ telefono: "1" }))).toBe("nuevo");
    expect(etapaDe(solicitud({ telefono: "1", contactado: "2026-08-26T15:00:00.000Z" }))).toBe("contactado");
    expect(etapaDe(solicitud({ telefono: "1", contactado: "x", pedidos: "y" }))).toBe("documentacion");
    expect(etapaDe(solicitud({ telefono: "1", expediente: { dui: { estado: "recibido" } } }))).toBe("documentacion");
    expect(etapaDe(solicitud({ telefono: "1", expediente: TODOS_OK }))).toBe("completa");
    expect(etapaDe(solicitud({ telefono: "1", expediente: TODOS_OK, asignado: "a" }))).toBe("asignado");
    expect(etapaDe(solicitud({ telefono: "1", expediente: TODOS_OK, asignado: "a", tomado: "b" }))).toBe("gestion");
    expect(etapaDe(solicitud({ telefono: "1", expediente: TODOS_OK, asignado: "a", tomado: "b", cerrado: "c" }))).toBe("cerrado");
  });

  it("un expediente incompleto no queda en completa aunque diga que sí", () => {
    const s = solicitud({ telefono: "1", expediente: { ...TODOS_OK, recibo: { estado: "rechazado", motivo: "vencido" } } });
    expect(expedienteCompleto(s.expediente)).toBe(false);
    expect(etapaDe(s)).toBe("documentacion");
  });
});

describe("detalle de la documentación", () => {
  it("sin nada entregado", () => {
    const d = detalleDocumentacion({});
    expect(d.sub).toBe("sin_entregar");
    expect(d.resumen).toBe("no ha mandado nada todavía");
    expect(d.aprobados).toBe(0);
  });

  it("entregó parte y dice cuáles faltan", () => {
    const d = detalleDocumentacion({ dui: { estado: "aprobado" }, salario: { estado: "aprobado" } });
    expect(d.sub).toBe("parcial");
    expect(d.resumen).toBe("faltan recibo de agua o luz y referencias personales");
    expect(d.aprobados).toBe(2);
  });

  it("un documento devuelto manda sobre los que faltan, y dice por qué", () => {
    const d = detalleDocumentacion({
      dui: { estado: "aprobado" },
      salario: { estado: "rechazado", motivo: "monto" },
    });
    expect(d.sub).toBe("con_observacion");
    expect(d.resumen).toBe("hay que volver a pedir constancia de salario: no se ve el monto");
    expect(d.rechazados).toHaveLength(1);
    expect(d.faltan).toHaveLength(2);
  });

  it("entregó todo pero falta revisar", () => {
    const d = detalleDocumentacion({
      dui: { estado: "aprobado" },
      salario: { estado: "recibido" },
      recibo: { estado: "recibido" },
      referencias: { estado: "aprobado" },
    });
    expect(d.sub).toBe("en_revision");
    expect(d.resumen).toBe("entregó todo, falta revisar 2 documentos");
  });
});

describe("plazos", () => {
  const base = { telefono: "1", expediente: TODOS_OK, vendedor: "s2" };

  it("no alerta si va en tiempo, ni si el vendedor ya lo tomó", () => {
    const reciente = solicitud({ ...base, asignado: new Date(AHORA.getTime() - 10 * 3_600_000).toISOString() });
    expect(nivelDeAlerta(reciente, AHORA.getTime())).toBeNull();
    const tomado = solicitud({
      ...base,
      asignado: new Date(AHORA.getTime() - 80 * 3_600_000).toISOString(),
      tomado: new Date(AHORA.getTime() - 70 * 3_600_000).toISOString(),
    });
    expect(nivelDeAlerta(tomado, AHORA.getTime())).toBeNull();
  });

  it("a las 48 horas avisa y a las 72 vence", () => {
    const h = (n: number) => new Date(AHORA.getTime() - n * 3_600_000).toISOString();
    expect(nivelDeAlerta(solicitud({ ...base, asignado: h(47.9) }), AHORA.getTime())).toBeNull();
    expect(nivelDeAlerta(solicitud({ ...base, asignado: h(48) }), AHORA.getTime())).toBe("aviso");
    expect(nivelDeAlerta(solicitud({ ...base, asignado: h(71) }), AHORA.getTime())).toBe("aviso");
    expect(nivelDeAlerta(solicitud({ ...base, asignado: h(72) }), AHORA.getTime())).toBe("vencido");
  });

  it("las alertas salen ordenadas por lo que más lleva esperando", () => {
    const h = (n: number) => new Date(AHORA.getTime() - n * 3_600_000).toISOString();
    const alertas = alertasDe(
      [
        solicitud({ ...base, telefono: "1", asignado: h(50) }),
        solicitud({ ...base, telefono: "2", asignado: h(100) }),
        solicitud({ ...base, telefono: "3", asignado: h(2) }),
      ],
      AHORA.getTime(),
    );
    expect(alertas.map((a) => [a.telefono, a.nivel, a.horas])).toEqual([
      ["2", "vencido", 100],
      ["1", "aviso", 50],
    ]);
  });

  it("estancado es el expediente que lleva días sin moverse", () => {
    const viejo = solicitud({ telefono: "1", pedidos: "x", actualizado: new Date(AHORA.getTime() - 5 * 86_400_000).toISOString() });
    const fresco = solicitud({ telefono: "2", pedidos: "x", actualizado: new Date(AHORA.getTime() - 3_600_000).toISOString() });
    expect(estancados([viejo, fresco], AHORA.getTime()).map((s) => s.telefono)).toEqual(["1"]);
  });
});

describe("reparto entre vendedores", () => {
  it("le toca al que menos casos activos tiene", () => {
    const abiertas = [
      solicitud({ telefono: "1", expediente: TODOS_OK, vendedor: "s2", asignado: "2026-09-01T10:00:00.000Z" }),
      solicitud({ telefono: "2", expediente: TODOS_OK, vendedor: "s2", asignado: "2026-09-01T11:00:00.000Z" }),
      solicitud({ telefono: "3", expediente: TODOS_OK, vendedor: "s5", asignado: "2026-09-01T12:00:00.000Z" }),
    ];
    expect(siguienteVendedor(VENDEDORES, abiertas)?.id).toBe("s10");
  });

  it("si empatan, al que hace más rato no recibe uno", () => {
    const cerradas = [
      solicitud({ telefono: "1", vendedor: "s2", asignado: "2026-09-02T10:00:00.000Z", cerrado: "2026-09-02T12:00:00.000Z", resultado: "venta" }),
      solicitud({ telefono: "2", vendedor: "s5", asignado: "2026-08-30T10:00:00.000Z", cerrado: "2026-08-30T12:00:00.000Z", resultado: "venta" }),
      solicitud({ telefono: "3", vendedor: "s10", asignado: "2026-09-01T10:00:00.000Z", cerrado: "2026-09-01T12:00:00.000Z", resultado: "venta" }),
    ];
    expect(siguienteVendedor(VENDEDORES, cerradas)?.id).toBe("s5");
  });

  it("sin vendedores no revienta", () => {
    expect(siguienteVendedor([], [])).toBeNull();
  });
});

describe("reporte del gerente", () => {
  const h = (n: number) => new Date(AHORA.getTime() - n * 3_600_000).toISOString();
  const solicitudes = [
    // Nadie lo ha tocado.
    solicitud({ telefono: "70000001", nombre: "Nuevo", creado: h(3) }),
    // Pendientes de documentación, cada uno en su sub-estado.
    solicitud({ telefono: "70000002", nombre: "Sin nada", creado: h(30), contactado: h(29), pedidos: h(29), actualizado: h(29) }),
    solicitud({ telefono: "70000003", nombre: "Parcial", creado: h(40), contactado: h(39), pedidos: h(39), actualizado: h(10), expediente: { dui: { estado: "aprobado" } } }),
    solicitud({
      telefono: "70000004",
      nombre: "Devuelto",
      creado: h(100),
      contactado: h(99),
      pedidos: h(99),
      actualizado: h(96),
      expediente: { dui: { estado: "aprobado" }, salario: { estado: "rechazado", motivo: "ilegible" } },
    }),
    // Completo y sin vendedor.
    solicitud({ telefono: "70000005", nombre: "Listo", creado: h(60), contactado: h(59), pedidos: h(59), completado: h(20), expediente: TODOS_OK, actualizado: h(20) }),
    // Asignado y vencido (nadie lo tomó en 80 horas).
    solicitud({ telefono: "70000006", nombre: "Vencido", creado: h(120), completado: h(85), expediente: TODOS_OK, vendedor: "s2", asignado: h(80), actualizado: h(80) }),
    // Tomado y vendido dentro del periodo.
    solicitud({
      telefono: "70000007",
      nombre: "Venta",
      creado: h(100),
      completado: h(50),
      expediente: TODOS_OK,
      vendedor: "s5",
      asignado: h(48),
      tomado: h(44),
      cerrado: h(5),
      resultado: "venta",
      actualizado: h(5),
    }),
    // Perdido dentro del periodo.
    solicitud({
      telefono: "70000008",
      nombre: "Perdido",
      creado: h(100),
      completado: h(60),
      expediente: TODOS_OK,
      vendedor: "s5",
      asignado: h(55),
      tomado: h(50),
      cerrado: h(6),
      resultado: "perdido",
      motivoCierre: "Se fue con otra marca",
      actualizado: h(6),
    }),
  ];

  const r = reporteVentas(solicitudes, VENDEDORES, rangoDePeriodo("7d", AHORA), AHORA);

  it("el embudo es la foto de ahora", () => {
    expect(Object.fromEntries(r.embudo.map((e) => [e.etapa, e.n]))).toEqual({
      nuevo: 1,
      contactado: 0,
      documentacion: 3,
      completa: 1,
      asignado: 1,
      gestion: 0,
      cerrado: 2,
    });
    expect(r.sinAsignar).toBe(1);
  });

  it("el movimiento cuenta lo que pasó en el periodo", () => {
    expect(r.movimiento.ventas).toBe(1);
    expect(r.movimiento.perdidos).toBe(1);
    expect(r.movimiento.tasaCierre).toBe(50);
    expect(r.movimiento.nuevos).toBe(8);
  });

  it("dice qué documento debe cada quien y por qué se devuelven", () => {
    expect(r.documentos.faltantes).toEqual([
      { id: "dui", nombre: "DUI", n: 1 },
      { id: "salario", nombre: "Constancia de salario", n: 3 },
      { id: "recibo", nombre: "Recibo de agua o luz", n: 3 },
      { id: "referencias", nombre: "Referencias personales", n: 3 },
    ]);
    expect(r.documentos.rechazos).toEqual([{ motivo: "ilegible", nombre: "No se lee", n: 1 }]);
    expect(r.documentos.subEstados.map((s) => [s.sub, s.n])).toEqual([
      ["sin_entregar", 1],
      ["parcial", 1],
      ["con_observacion", 1],
    ]);
  });

  it("por vendedor: quién no ha tomado lo suyo y quién cierra", () => {
    const por = Object.fromEntries(r.vendedores.map((v) => [v.id, v]));
    expect(por.s2.activos).toBe(1);
    expect(por.s2.sinTomar).toBe(1);
    expect(por.s2.vencidos).toBe(1);
    expect(por.s2.ventas).toBe(0);
    expect(por.s5.cerrados).toBe(2);
    expect(por.s5.ventas).toBe(1);
    expect(por.s5.tasaCierre).toBe(50);
    expect(por.s5.horasEnTomar).toBe(4.5); // 4 h y 5 h
    expect(por.s10.activos).toBe(0);
    expect(por.s10.tasaCierre).toBeNull();
  });

  it("alertas y estancados salen listos para actuar", () => {
    expect(r.alertas.map((a) => [a.nombre, a.nivel])).toEqual([["Vencido", "vencido"]]);
    expect(r.estancados.map((e) => [e.nombre, e.dias])).toEqual([["Devuelto", 4]]);
    expect(r.estancados[0].resumen).toContain("volver a pedir");
  });

  it("los tiempos promedio del proceso", () => {
    expect(r.tiempos.aExpedienteCompleto).toBe(41.3); // 40, 35, 50 y 40 horas
    expect(r.tiempos.aPrimerContacto).toBe(4.5);
    expect(r.tiempos.aCierre).toBe(46); // 43 y 49 horas
  });
});
