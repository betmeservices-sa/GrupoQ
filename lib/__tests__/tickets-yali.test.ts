// Lo que el kickoff del 24 de agosto de 2026 dejó decidido para Yali, en
// pruebas: a quién le cae cada caso y con qué reloj se mide.
//
// Va aparte de tickets-metricas.test.ts porque aquello prueba el motor (los dos
// relojes, los promedios) y esto prueba las reglas de ESTE cliente, que son las
// que se van a mover cuando el hotel cambie de opinión.

import { describe, expect, it } from "vitest";
import type { Ticket } from "@/lib/tickets";
import { calcularMetricas } from "@/lib/tickets-metricas";
import { formatearMinutos, horasPorDiaHabil, minutosHabiles } from "@/lib/tickets-sla";
import {
  areaYaliPara,
  configTickets,
  explicacionReloj,
  horarioDeArea,
} from "@/lib/tickets-tenant";
import { ticketsSemilla } from "@/lib/tickets-seed";

// 02:00 y 09:00 en El Salvador (UTC-6) el lunes 24 de agosto de 2026.
const MADRUGADA = "2026-08-24T08:00:00.000Z";
const MANANA = "2026-08-24T15:00:00.000Z";

function ticket(p: Partial<Ticket>): Ticket {
  return {
    id: "t",
    tenant: "yaly",
    numero: 1,
    titulo: "caso",
    detalle: "",
    tipo: "otro",
    estado: "abierto",
    prioridad: "normal",
    origen: "chat",
    creadoPor: "Sofía",
    contactoNombre: "Huésped",
    area: "reservas",
    creado: MADRUGADA,
    notas: [],
    ...p,
  };
}

describe("a quién le cae cada caso", () => {
  it("los socios y los interesados son de membresías, de nadie más", () => {
    expect(areaYaliPara("membresia", "a")).toBe("membresias");
    // Ni siquiera cuando sabemos de qué sede escribe: el canal es de Olga.
    expect(areaYaliPara("membresia", "c")).toBe("membresias");
  });

  it("lo que pasa adentro del hotel lo resuelve esa sede", () => {
    expect(areaYaliPara("objeto_perdido", "a")).toBe("yali");
    expect(areaYaliPara("mantenimiento", "b")).toBe("surf");
    expect(areaYaliPara("queja", "c")).toBe("linda");
  });

  it("sin sede, lo reparte reservas en vez de perderse", () => {
    expect(areaYaliPara("objeto_perdido", null)).toBe("reservas");
    expect(areaYaliPara("queja", undefined)).toBe("reservas");
  });

  it("todo lo de habitaciones y dinero es de reservas", () => {
    for (const t of ["pago", "reserva", "checkin_especial", "cotizacion"] as const) {
      expect(areaYaliPara(t, "a")).toBe("reservas");
    }
  });

  it("cada área que rutea Sofía existe de verdad en la configuración", () => {
    const ids = new Set(configTickets("yaly").areas.map((a) => a.id));
    for (const t of configTickets("yaly").tipos) {
      for (const sede of ["a", "b", "c", null]) {
        expect(ids).toContain(areaYaliPara(t, sede));
      }
    }
  });
});

describe("cada área con su reloj", () => {
  it("reservas cierra a las cinco y las sedes no cierran", () => {
    const sede = horarioDeArea("yaly", "yali");
    const reservas = horarioDeArea("yaly", "reservas");
    // De 2 a 9 de la mañana: la sede acumula las siete horas, reservas solo la
    // que va desde que abre.
    expect(minutosHabiles(MADRUGADA, MANANA, sede)).toBe(7 * 60);
    expect(minutosHabiles(MADRUGADA, MANANA, reservas)).toBe(60);
  });

  it("membresías se mide contra lo que se le promete al cliente, de 9 a 8", () => {
    const h = horarioDeArea("yaly", "membresias");
    expect(horasPorDiaHabil(h)).toBe(11);
  });

  it("un área desconocida cae al reloj del negocio, no revienta", () => {
    expect(horarioDeArea("yaly", "no-existe")).toBe(configTickets("yaly").horario);
  });

  it("las métricas miden cada ticket con el reloj de SU área", () => {
    const m = calcularMetricas(
      [
        ticket({ id: "sede", area: "yali" }),
        ticket({ id: "reservas", area: "reservas" }),
      ],
      { horario: (t) => horarioDeArea("yaly", t.area), ahora: MANANA },
    );
    // Los dos entraron a las 2 de la mañana y nadie los ha tomado a las 9. El
    // que más espera tiene que ser el de la sede, porque su reloj no se detuvo.
    expect(m.masEsperado?.ticket.id).toBe("sede");
    expect(m.masEsperado?.minutos).toBe(7 * 60);
  });

  it("un día de una sede son 24 horas, no la jornada del hospital", () => {
    const jornada = horasPorDiaHabil(configTickets("yaly").horario);
    expect(jornada).toBe(24);
    expect(formatearMinutos(30 * 60, jornada)).toBe("1 d 6 h");
    // Con el default de 12 daría "2 d 6 h", que para un hotel es mentira.
    expect(formatearMinutos(30 * 60)).toBe("2 d 6 h");
  });

  it("la nota del panel dice los horarios reales y no que todo es corrido", () => {
    const texto = explicacionReloj("yaly");
    expect(texto).toContain("8:00 a 17:00");
    expect(texto).toContain("9:00 a 20:00");
    expect(texto).not.toBe(explicacionReloj("hospital"));
  });
});

describe("el tablero con el que abre Yali", () => {
  it("arranca vacio, sin un solo caso inventado", () => {
    // Yali es un cliente en produccion. Un ticket de ejemplo en su tablero no
    // es una demostracion: es una tarea falsa mezclada con las de verdad, y
    // alguien del hotel la va a trabajar.
    expect(ticketsSemilla("yaly", Date.parse(MANANA))).toEqual([]);
  });

  it("el hospital, que sigue siendo demo, si trae su tablero", () => {
    const tickets = ticketsSemilla("hospital", Date.parse(MANANA));
    expect(tickets.length).toBeGreaterThan(0);

    const cfg = configTickets("hospital");
    const areas = new Set(cfg.areas.map((a) => a.id));
    for (const t of tickets) {
      expect(areas).toContain(t.area);
      expect(cfg.tipos).toContain(t.tipo);
    }
  });

  it("ningun cliente sin tablero se siembra por accidente", () => {
    for (const t of ["grupoq", "excel", "miagentia", "promerica"]) {
      expect(ticketsSemilla(t, Date.parse(MANANA))).toEqual([]);
    }
  });
});
