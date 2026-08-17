// El motor de las campañas. Lo que se prueba acá es la promesa que le hicimos
// al banco: "llamalos a todos, pero de N en N, en horario, y sin acosar a
// nadie". Cada uno de esos tres frenos tiene su test.
import { describe, expect, it } from "vitest";
import {
  CONCURRENCIA_MAX,
  VENTANA_POR_DEFECTO,
  campanaAgotada,
  cerrarItem,
  debeReintentar,
  duracionHumana,
  enVentana,
  estimarMinutos,
  planificarTanda,
  progresoDe,
  relojSv,
} from "../cobros-campanas";
import type { Campana, ItemCampana } from "../cobros-tipos";

// Un miércoles a las 10 de la mañana en El Salvador (UTC-6) = 16:00 UTC.
const MIERCOLES_10AM = new Date("2026-08-19T16:00:00Z");
// El mismo miércoles a las 11 de la noche.
const MIERCOLES_11PM = new Date("2026-08-20T05:00:00Z");
// Domingo al mediodía.
const DOMINGO_MEDIODIA = new Date("2026-08-16T18:00:00Z");

function item(n: number, extra: Partial<ItemCampana> = {}): ItemCampana {
  return {
    id: `it${n}`,
    deudorId: `d${n}`,
    nombre: `Cliente ${n}`,
    telefono: `+5037000000${n}`,
    estado: "pendiente",
    intentos: 0,
    actualizado: "2026-08-19T15:00:00Z",
    ...extra,
  };
}

function campana(items: ItemCampana[], extra: Partial<Campana> = {}): Campana {
  return {
    id: "camp1",
    nombre: "Prueba",
    estado: "corriendo",
    creada: "2026-08-19T14:00:00Z",
    assistantId: "a1",
    phoneNumberId: "n1",
    concurrencia: 10,
    maxIntentos: 3,
    minutosEntreIntentos: 120,
    ventana: VENTANA_POR_DEFECTO,
    simulada: true,
    items,
    ...extra,
  };
}

describe("la ventana horaria", () => {
  it("marca dentro del horario de un día hábil", () => {
    expect(enVentana(VENTANA_POR_DEFECTO, MIERCOLES_10AM)).toBe(true);
  });

  it("no marca de noche", () => {
    expect(enVentana(VENTANA_POR_DEFECTO, MIERCOLES_11PM)).toBe(false);
  });

  it("no marca en domingo", () => {
    expect(enVentana(VENTANA_POR_DEFECTO, DOMINGO_MEDIODIA)).toBe(false);
  });

  it("lee la hora de El Salvador, no la del servidor", () => {
    // 16:00 UTC son las 10:00 en SV (UTC-6, sin horario de verano).
    expect(relojSv(MIERCOLES_10AM)).toEqual({ hora: 10, dia: 3 });
  });
});

describe("el 'de N en N'", () => {
  it("entrega exactamente la concurrencia cuando no hay nada vivo", () => {
    const c = campana(Array.from({ length: 100 }, (_, i) => item(i)), { concurrencia: 10 });
    const t = planificarTanda(c, MIERCOLES_10AM);
    expect(t.marcar).toHaveLength(10);
    expect(t.vivas).toBe(0);
  });

  it("solo llena los cupos que quedan libres", () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) => item(i, { estado: "en_curso" })),
      ...Array.from({ length: 50 }, (_, i) => item(i + 100)),
    ];
    const t = planificarTanda(campana(items, { concurrencia: 10 }), MIERCOLES_10AM);
    expect(t.vivas).toBe(4);
    expect(t.marcar).toHaveLength(6);
  });

  it("no entrega nada si todas las líneas están ocupadas", () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i, { estado: "marcando" }));
    const t = planificarTanda(campana([...items, item(99)], { concurrencia: 10 }), MIERCOLES_10AM);
    expect(t.marcar).toHaveLength(0);
    expect(t.motivo).toContain("10 líneas");
  });

  it("una base de 10,000 sale de 10 en 10 sin desbordarse", () => {
    let c = campana(Array.from({ length: 10_000 }, (_, i) => item(i)), { concurrencia: 10 });
    let lanzadas = 0;
    // Se simulan 20 vueltas: en cada una se marca la tanda y se cierra entera.
    for (let vuelta = 0; vuelta < 20; vuelta++) {
      const tanda = planificarTanda(c, MIERCOLES_10AM);
      expect(tanda.marcar.length).toBeLessThanOrEqual(10);
      lanzadas += tanda.marcar.length;
      const ids = new Set(tanda.marcar.map((i) => i.id));
      c = {
        ...c,
        items: c.items.map((i) =>
          ids.has(i.id) ? { ...i, estado: "terminada", intentos: 1, resultado: "ya_pago" } : i,
        ),
      };
    }
    expect(lanzadas).toBe(200);
    expect(c.items.filter((i) => i.estado === "pendiente")).toHaveLength(9800);
  });

  it("respeta la espera de reintento", () => {
    const enEspera = item(1, {
      estado: "reprogramada",
      intentos: 1,
      reintentarDespues: "2026-08-19T18:00:00Z", // todavía no toca
    });
    const listo = item(2, {
      estado: "reprogramada",
      intentos: 1,
      reintentarDespues: "2026-08-19T15:00:00Z", // ya pasó
    });
    const t = planificarTanda(campana([enEspera, listo]), MIERCOLES_10AM);
    expect(t.marcar.map((i) => i.id)).toEqual(["it2"]);
  });

  it("no marca fuera de la ventana aunque la campaña esté corriendo", () => {
    const t = planificarTanda(campana([item(1)]), MIERCOLES_11PM);
    expect(t.marcar).toHaveLength(0);
    expect(t.motivo).toContain("horario");
  });

  it("no marca si la campaña está pausada", () => {
    const t = planificarTanda(campana([item(1)], { estado: "pausada" }), MIERCOLES_10AM);
    expect(t.marcar).toHaveLength(0);
    expect(t.motivo).toContain("pausada");
  });

  it("no entrega a quien ya agotó sus intentos", () => {
    const agotado = item(1, { estado: "reprogramada", intentos: 3 });
    const t = planificarTanda(campana([agotado], { maxIntentos: 3 }), MIERCOLES_10AM);
    expect(t.marcar).toHaveLength(0);
  });
});

describe("los reintentos", () => {
  it("reintenta a quien no contestó", () => {
    expect(debeReintentar("no_contesto", 1, 3)).toBe(true);
  });

  it("reintenta cuando la llamada falló por lado técnico", () => {
    expect(debeReintentar(undefined, 0, 3)).toBe(true);
  });

  it("NO insiste con quien pidió que no lo llamen", () => {
    expect(debeReintentar("solicita_no_llamar", 0, 3)).toBe(false);
  });

  it("NO insiste con quien ya prometió, ya pagó o reclamó", () => {
    for (const r of ["promesa_pago", "ya_pago", "disputa", "quiere_negociar"] as const) {
      expect(debeReintentar(r, 0, 3)).toBe(false);
    }
  });

  it("NO insiste con un número equivocado", () => {
    expect(debeReintentar("numero_equivocado", 0, 3)).toBe(false);
  });

  it("para en el tope de intentos", () => {
    expect(debeReintentar("no_contesto", 3, 3)).toBe(false);
  });

  it("cerrarItem reprograma con la espera configurada", () => {
    const cerrado = cerrarItem(
      item(1, { intentos: 1 }),
      { resultado: "no_contesto" },
      { maxIntentos: 3, minutosEntreIntentos: 120 },
      MIERCOLES_10AM,
    );
    expect(cerrado.estado).toBe("reprogramada");
    expect(cerrado.reintentarDespues).toBe("2026-08-19T18:00:00.000Z");
  });

  it("cerrarItem deja terminado lo que no se reintenta", () => {
    const cerrado = cerrarItem(
      item(1, { intentos: 1 }),
      { resultado: "promesa_pago", duracionSeg: 120 },
      { maxIntentos: 3, minutosEntreIntentos: 120 },
      MIERCOLES_10AM,
    );
    expect(cerrado.estado).toBe("terminada");
    expect(cerrado.reintentarDespues).toBeUndefined();
  });
});

describe("el progreso", () => {
  it("cuenta contactos efectivos, no llamadas", () => {
    const items = [
      item(1, { estado: "terminada", resultado: "promesa_pago", duracionSeg: 120 }),
      item(2, { estado: "terminada", resultado: "no_contesto", duracionSeg: 0 }),
      item(3, { estado: "terminada", resultado: "ya_pago", duracionSeg: 60 }),
      item(4, { estado: "pendiente" }),
    ];
    const p = progresoDe(campana(items), { cuenta: 1, monto: 312.5 });
    expect(p.contactos).toBe(2);
    expect(p.tasaContactoPct).toBe(67);
    expect(p.promesas).toBe(1);
    expect(p.montoPrometido).toBe(312.5);
    expect(p.minutos).toBe(3);
    expect(p.completadoPct).toBe(75);
  });

  it("una campaña sin resultados no reporta 0% de contacto falso", () => {
    const p = progresoDe(campana([item(1), item(2)]));
    expect(p.tasaContactoPct).toBe(0);
    expect(p.completadoPct).toBe(0);
  });
});

describe("cuándo termina", () => {
  it("no está agotada mientras quede algo por marcar", () => {
    expect(campanaAgotada(campana([item(1)]))).toBe(false);
  });

  it("está agotada cuando todo cerró", () => {
    const items = [
      item(1, { estado: "terminada" }),
      item(2, { estado: "fallida" }),
      item(3, { estado: "reprogramada", intentos: 3 }),
    ];
    expect(campanaAgotada(campana(items, { maxIntentos: 3 }))).toBe(true);
  });
});

describe("la estimación de tiempo", () => {
  it("avisa lo que tarda una base grande de 10 en 10", () => {
    // 10,000 llamadas de ~95 s, de 10 en 10, son más de 26 horas.
    const min = estimarMinutos(10_000, 10);
    expect(min).toBe(1584);
    expect(duracionHumana(min)).toBe("26 h 24 min");
  });

  it("subir la concurrencia baja el tiempo casi en proporción", () => {
    // "Casi" porque el resultado se redondea hacia arriba a minutos enteros.
    const diez = estimarMinutos(1000, 10);
    const veinte = estimarMinutos(1000, 20);
    expect(Math.abs(diez - veinte * 2)).toBeLessThanOrEqual(1);
  });

  it("no divide por cero", () => {
    expect(estimarMinutos(100, 0)).toBe(0);
    expect(estimarMinutos(0, 10)).toBe(0);
  });
});

it("el tope de concurrencia es un número razonable", () => {
  expect(CONCURRENCIA_MAX).toBeGreaterThan(0);
  expect(CONCURRENCIA_MAX).toBeLessThanOrEqual(100);
});
