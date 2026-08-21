// Las métricas de tickets.
//
// Lo que se protege acá es que los dos relojes NO se mezclen. Roberto los pidió
// separados: uno mide la cola (cuánto tardaron en agarrarlo) y el otro mide a
// la persona (cuánto tardó en cerrarlo). Un promedio único haría que un equipo
// rápido con una cola saturada se vea igual que un equipo lento sin cola.
import { describe, it, expect } from "vitest";
import type { Ticket } from "@/lib/tickets";
import { calcularMetricas, tiempoAtencion, tiempoResolucion } from "@/lib/tickets-metricas";
import { HORARIO_HOSPITAL } from "@/lib/tickets-sla";

const sv = (dia: string, hora: string) => {
  const [h, m = 0] = hora.split(":").map(Number);
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) + (h + 6) * 3_600_000 + m * 60_000).toISOString();
};
const LUN = "2026-08-24";
const MAR = "2026-08-25";

function ticket(p: Partial<Ticket> & { id: string }): Ticket {
  return {
    tenant: "hospital",
    numero: 1,
    titulo: "Caso",
    detalle: "",
    tipo: "informacion",
    estado: "abierto",
    prioridad: "normal",
    origen: "llamada",
    creadoPor: "Sofía",
    contactoNombre: "Paciente",
    area: "atencion",
    creado: sv(LUN, "09:00"),
    notas: [],
    ...p,
  };
}

describe("los dos relojes van por separado", () => {
  const t = ticket({
    id: "t1",
    creado: sv(LUN, "09:00"),
    asignado: sv(LUN, "09:30"),
    resuelto: sv(LUN, "11:30"),
    estado: "resuelto",
    asignadoA: "s6",
  });

  it("atención mide la cola: de creado a tomado", () => {
    expect(tiempoAtencion(t, HORARIO_HOSPITAL)).toBe(30);
  });

  it("resolución mide a la persona: de tomado a cerrado", () => {
    expect(tiempoResolucion(t, HORARIO_HOSPITAL)).toBe(120);
  });

  it("sin tomar no hay tiempo de resolución, y eso NO es cero", () => {
    // Cero se leería como "lo cerró al instante", que es lo contrario.
    const enCola = ticket({ id: "t2" });
    expect(tiempoResolucion(enCola, HORARIO_HOSPITAL)).toBeNull();
  });

  it("los dos descuentan la noche", () => {
    // Entra 18:30 del lunes, lo toman 07:30 del martes, lo cierran 08:00.
    // Atención: 30 (lun) + 30 (mar) = 60. Resolución: 30.
    const nocturno = ticket({
      id: "t3",
      creado: sv(LUN, "18:30"),
      asignado: sv(MAR, "07:30"),
      resuelto: sv(MAR, "08:00"),
      estado: "resuelto",
      asignadoA: "s6",
    });
    expect(tiempoAtencion(nocturno, HORARIO_HOSPITAL)).toBe(60);
    expect(tiempoResolucion(nocturno, HORARIO_HOSPITAL)).toBe(30);
  });
});

describe("el promedio de atención no se contamina con la cola viva", () => {
  it("solo promedia los que alguien ya tomó", () => {
    // Si el que sigue esperando entrara al promedio, el número subiría solo con
    // el paso del tiempo y dos semanas no se podrían comparar.
    const m = calcularMetricas(
      [
        ticket({ id: "a", creado: sv(LUN, "09:00"), asignado: sv(LUN, "09:20"), asignadoA: "s6", estado: "asignado" }),
        ticket({ id: "b", creado: sv(LUN, "09:00"), asignado: sv(LUN, "10:00"), asignadoA: "s6", estado: "asignado" }),
        ticket({ id: "c", creado: sv(LUN, "09:00") }), // sigue en cola
      ],
      { horario: HORARIO_HOSPITAL, ahora: sv(LUN, "17:00") },
    );
    expect(m.promedioAtencion).toBe(40); // (20 + 60) / 2
    expect(m.sinTomar).toBe(1);
  });
});

describe("el que más lleva esperando", () => {
  it("señala el más viejo de los que nadie tomó", () => {
    const m = calcularMetricas(
      [
        ticket({ id: "viejo", creado: sv(LUN, "07:30") }),
        ticket({ id: "nuevo", creado: sv(LUN, "16:00") }),
        // Este es más viejo que todos, pero ya tiene dueño: no cuenta.
        ticket({ id: "tomado", creado: sv(LUN, "07:00"), asignado: sv(LUN, "07:05"), asignadoA: "s6", estado: "asignado" }),
      ],
      { horario: HORARIO_HOSPITAL, ahora: sv(LUN, "17:00") },
    );
    expect(m.masEsperado?.ticket.id).toBe("viejo");
    expect(m.masEsperado?.minutos).toBe(570); // 07:30 a 17:00
  });

  it("sin cola, no hay nadie esperando", () => {
    const m = calcularMetricas([ticket({ id: "x", estado: "resuelto", asignadoA: "s6", asignado: sv(LUN, "09:10"), resuelto: sv(LUN, "09:40") })], {
      horario: HORARIO_HOSPITAL,
      ahora: sv(LUN, "17:00"),
    });
    expect(m.masEsperado).toBeNull();
  });
});

describe("la tabla por persona", () => {
  it("separa lo que cada uno cerró de lo que tiene encima", () => {
    const m = calcularMetricas(
      [
        ticket({ id: "1", asignadoA: "s6", asignado: sv(LUN, "09:00"), resuelto: sv(LUN, "09:30"), estado: "resuelto" }),
        ticket({ id: "2", asignadoA: "s6", asignado: sv(LUN, "10:00"), resuelto: sv(LUN, "11:30"), estado: "resuelto" }),
        ticket({ id: "3", asignadoA: "s6", asignado: sv(LUN, "12:00"), estado: "en_proceso" }),
        ticket({ id: "4", asignadoA: "s8", asignado: sv(LUN, "09:00"), resuelto: sv(LUN, "09:10"), estado: "resuelto" }),
      ],
      { horario: HORARIO_HOSPITAL, ahora: sv(LUN, "17:00") },
    );
    const karla = m.porPersona.find((p) => p.staffId === "s6");
    expect(karla).toMatchObject({ asignados: 3, resueltos: 2, abiertos: 1, promedioResolucion: 60 });
    expect(m.porPersona.find((p) => p.staffId === "s8")?.promedioResolucion).toBe(10);
    // Ordenada por quién cerró más.
    expect(m.porPersona[0].staffId).toBe("s6");
  });

  it("no inventa un promedio para quien no cerró nada", () => {
    const m = calcularMetricas([ticket({ id: "1", asignadoA: "s6", asignado: sv(LUN, "09:00"), estado: "en_proceso" })], {
      horario: HORARIO_HOSPITAL,
      ahora: sv(LUN, "17:00"),
    });
    expect(m.porPersona[0].promedioResolucion).toBeNull();
  });
});

describe("el conteo grueso", () => {
  it("cuadra abiertos, resueltos y sin tomar", () => {
    const m = calcularMetricas(
      [
        ticket({ id: "1" }),
        ticket({ id: "2", estado: "asignado", asignadoA: "s6", asignado: sv(LUN, "09:10") }),
        ticket({ id: "3", estado: "en_proceso", asignadoA: "s6", asignado: sv(LUN, "09:10") }),
        ticket({ id: "4", estado: "resuelto", asignadoA: "s6", asignado: sv(LUN, "09:10"), resuelto: sv(LUN, "09:40") }),
      ],
      { horario: HORARIO_HOSPITAL, ahora: sv(LUN, "17:00") },
    );
    expect(m.total).toBe(4);
    expect(m.abiertos).toBe(3);
    expect(m.sinTomar).toBe(1);
    expect(m.resueltos).toBe(1);
    expect(m.porEstado).toEqual({ abierto: 1, asignado: 1, en_proceso: 1, resuelto: 1 });
  });

  it("el filtro por período deja fuera lo de antes", () => {
    const m = calcularMetricas([ticket({ id: "viejo", creado: sv("2026-08-10", "09:00") }), ticket({ id: "nuevo", creado: sv(LUN, "09:00") })], {
      horario: HORARIO_HOSPITAL,
      periodo: { desde: sv(LUN, "00:00"), hasta: sv(MAR, "23:59") },
      ahora: sv(MAR, "17:00"),
    });
    expect(m.total).toBe(1);
  });

  it("cuenta los que se cerraron sin que nadie los tocara", () => {
    const m = calcularMetricas(
      [
        ticket({ id: "1", estado: "resuelto", resuelto: sv(LUN, "09:40") }),
        ticket({ id: "2", estado: "resuelto", asignadoA: "s6", asignado: sv(LUN, "09:10"), resuelto: sv(LUN, "09:40") }),
      ],
      { horario: HORARIO_HOSPITAL, ahora: sv(LUN, "17:00") },
    );
    expect(m.resueltosSinPersona).toBe(1);
  });

  it("sin tickets no explota ni inventa promedios", () => {
    const m = calcularMetricas([], { horario: HORARIO_HOSPITAL, ahora: sv(LUN, "17:00") });
    expect(m.total).toBe(0);
    expect(m.promedioAtencion).toBeNull();
    expect(m.promedioResolucion).toBeNull();
    expect(m.masEsperado).toBeNull();
    expect(m.porPersona).toEqual([]);
  });
});
