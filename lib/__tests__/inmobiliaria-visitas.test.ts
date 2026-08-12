// La agenda de visitas: que salga de los leads (y no de una lista paralela),
// que el día de hoy quede al frente, y que cante las visitas que quedaron tan
// pegadas que no se llega.
import { describe, it, expect, beforeEach } from "vitest";
import {
  aHora,
  aMinutos,
  armarMes,
  construirAgenda,
  fechaDeVisita,
  holguraEntre,
  horaHablada,
  marcarChoques,
  mesDe,
  sumarMeses,
  visitasDe,
  type Visita,
} from "@/lib/inmobiliaria-visitas";
import { LEADS, PROPIEDADES } from "@/lib/inmobiliaria-datos";
import { agendarVisita, cancelarVisita, cargarAgenda, cargarPipeline, limpiarDemo } from "@/lib/inmobiliaria-store";
import type { LeadSemilla, PropiedadSemilla } from "@/lib/inmobiliaria-tipos";

const HOY = "2026-08-12";

function propiedad(over: Partial<PropiedadSemilla> = {}): PropiedadSemilla {
  return {
    id: "p1",
    codigo: "TZ-901",
    operacion: "venta",
    tipo: "casa",
    titulo: "Casa",
    zona: "Las Colinas",
    municipio: "Santa Tecla",
    precio: 165000,
    estado: "disponible",
    publicada: true,
    habitaciones: 3,
    banos: 2,
    parqueos: 2,
    areaConstruccion: 150,
    areaTerreno: 200,
    propietario: { nombre: "Dueño", telefono: "+503 7000 0000" },
    exclusiva: false,
    caracteristicas: [],
    resumen: "Resumen",
    fotos: [],
    ...over,
  };
}

function lead(over: Partial<LeadSemilla> = {}): LeadSemilla {
  return {
    id: "l1",
    nombre: "Cliente Uno",
    canal: "whatsapp",
    operacion: "venta",
    etapa: "visita",
    formaPago: "banco",
    presupuesto: 180000,
    zona: "Santa Tecla",
    busca: "Casa de 3 habitaciones",
    hace: 1,
    asesorId: "s2",
    ...over,
  };
}

describe("horas como las dice el agente", () => {
  it("va y vuelve de minutos", () => {
    expect(aMinutos("09:30")).toBe(570);
    expect(aHora(570)).toBe("09:30");
    expect(aMinutos("")).toBe(0);
  });

  it("las escribe en 12 horas, que es como se habla", () => {
    expect(horaHablada("09:00")).toBe("9:00 a.m.");
    expect(horaHablada("14:30")).toBe("2:30 p.m.");
    expect(horaHablada("12:00")).toBe("12:00 p.m.");
    expect(horaHablada("00:15")).toBe("12:15 a.m.");
  });

  it("la fecha sale relativa en las semillas y absoluta cuando se agenda", () => {
    expect(fechaDeVisita({ propiedadId: "p1", enDias: 3, hora: "10:00", confirmada: true }, HOY)).toBe("2026-08-15");
    expect(fechaDeVisita({ propiedadId: "p1", fecha: "2026-09-01", hora: "10:00", confirmada: true }, HOY)).toBe("2026-09-01");
  });
});

describe("la agenda sale del pipeline, no de una lista aparte", () => {
  const propiedades = [propiedad(), propiedad({ id: "p2", codigo: "TZ-902", zona: "Escalón", municipio: "San Salvador" })];

  it("solo entran los leads en la etapa de visita y con día y hora", () => {
    const agenda = construirAgenda({
      leads: [
        lead({ id: "a", visita: { propiedadId: "p1", enDias: 0, hora: "09:00", confirmada: true } }),
        lead({ id: "b", etapa: "calificado", visita: { propiedadId: "p1", enDias: 0, hora: "11:00", confirmada: true } }),
        lead({ id: "c", etapa: "visita" }), // en la etapa pero sin fecha todavía
      ],
      propiedades,
      hoy: HOY,
    });
    expect(agenda.visitas.map((v) => v.id)).toEqual(["a"]);
  });

  it("cada visita trae quién, qué propiedad, en qué zona y por dónde entró", () => {
    const agenda = construirAgenda({
      leads: [lead({ canal: "instagram", visita: { propiedadId: "p2", enDias: 1, hora: "16:00", confirmada: false } })],
      propiedades,
      hoy: HOY,
    });
    const v = agenda.visitas[0];
    expect(v.cliente).toBe("Cliente Uno");
    expect(v.codigo).toBe("TZ-902");
    expect(v.zona).toBe("Escalón");
    expect(v.municipio).toBe("San Salvador");
    expect(v.canal).toBe("instagram");
    expect(v.fecha).toBe("2026-08-13");
    expect(v.confirmada).toBe(false);
  });

  it("hoy va aparte de lo que viene, y en orden de hora", () => {
    const agenda = construirAgenda({
      leads: [
        lead({ id: "tarde", visita: { propiedadId: "p1", enDias: 0, hora: "15:00", confirmada: true } }),
        lead({ id: "manana", visita: { propiedadId: "p1", enDias: 1, hora: "08:00", confirmada: true } }),
        lead({ id: "temprano", visita: { propiedadId: "p1", enDias: 0, hora: "08:30", confirmada: true } }),
      ],
      propiedades,
      hoy: HOY,
    });
    expect(agenda.hoyVisitas.map((v) => v.id)).toEqual(["temprano", "tarde"]);
    expect(agenda.proximas.map((v) => v.id)).toEqual(["manana"]);
    expect(visitasDe(agenda, HOY).map((v) => v.hora)).toEqual(["08:30", "15:00"]);
  });

  it("cuenta las que faltan confirmar de hoy en adelante", () => {
    const agenda = construirAgenda({
      leads: [
        lead({ id: "a", visita: { propiedadId: "p1", enDias: 0, hora: "09:00", confirmada: false } }),
        lead({ id: "b", visita: { propiedadId: "p1", enDias: -3, hora: "09:00", confirmada: false } }),
      ],
      propiedades,
      hoy: HOY,
    });
    expect(agenda.sinConfirmar).toBe(1);
  });

  it("funciona igual para alquiler", () => {
    const agenda = construirAgenda({
      leads: [
        lead({
          id: "r",
          operacion: "alquiler",
          formaPago: undefined,
          respaldo: "fiador",
          presupuesto: 950,
          visita: { propiedadId: "p2", enDias: 0, hora: "10:00", confirmada: true },
        }),
      ],
      propiedades: [propiedad(), propiedad({ id: "p2", codigo: "TZ-902", operacion: "alquiler", precio: 950 })],
      hoy: HOY,
    });
    expect(agenda.visitas[0].operacion).toBe("alquiler");
    expect(agenda.visitas[0].precio).toBe(950);
  });
});

// Perder una visita por llegar tarde cuesta plata, y en una lista de horas no
// se ve venir.
describe("visitas que quedaron demasiado pegadas", () => {
  const base: Visita = {
    id: "x",
    leadId: "x",
    fecha: HOY,
    hora: "09:00",
    inicio: 540,
    fin: 585,
    duracionMin: 45,
    confirmada: true,
    operacion: "venta",
    cliente: "Uno",
    canal: "whatsapp",
    telefonoBusca: "Casa",
    propiedadId: "p1",
    codigo: "TZ-901",
    tipo: "casa",
    zona: "Las Colinas",
    municipio: "Santa Tecla",
    precio: 165000,
    choque: null,
  };
  const otra = (over: Partial<Visita>): Visita => ({ ...base, ...over });

  it("pide más tiempo entre municipios que entre casas de la misma colonia", () => {
    expect(holguraEntre(base, otra({ zona: "Las Colinas" }))).toBe(15);
    expect(holguraEntre(base, otra({ zona: "Las Delicias" }))).toBe(30);
    expect(holguraEntre(base, otra({ zona: "Escalón", municipio: "San Salvador" }))).toBe(45);
  });

  it("marca la segunda cuando no se llega de una zona a la otra", () => {
    const dia = marcarChoques([
      base,
      otra({ id: "y", hora: "10:15", inicio: 615, fin: 660, zona: "Escalón", municipio: "San Salvador" }),
    ]);
    expect(dia[0].choque).toBeNull();
    expect(dia[1].choque).toContain("30 minutos");
    expect(dia[1].choque).toContain("9:00 a.m.");
  });

  it("no molesta cuando sí se llega", () => {
    const dia = marcarChoques([
      base,
      otra({ id: "y", hora: "11:00", inicio: 660, fin: 705, zona: "Escalón", municipio: "San Salvador" }),
    ]);
    expect(dia[1].choque).toBeNull();
  });

  it("dos en la misma colonia una detrás de otra no son problema", () => {
    const dia = marcarChoques([base, otra({ id: "y", hora: "10:00", inicio: 600, fin: 645 })]);
    expect(dia[1].choque).toBeNull();
  });

  it("si se encima con la anterior, lo dice con esa palabra", () => {
    const dia = marcarChoques([base, otra({ id: "y", hora: "09:30", inicio: 570, fin: 615 })]);
    expect(dia[1].choque).toContain("Se encima");
  });

  it("el choque va en la segunda, que es la que se pierde por llegar tarde", () => {
    const dia = marcarChoques([
      otra({ id: "y", hora: "10:15", inicio: 615, fin: 660, zona: "Escalón", municipio: "San Salvador" }),
      base,
    ]);
    expect(dia.map((v) => v.id)).toEqual(["x", "y"]); // ordena por hora
    expect(dia[1].choque).toBeTruthy();
  });
});

describe("la rejilla del mes", () => {
  const agenda = construirAgenda({
    leads: [
      lead({ id: "a", visita: { propiedadId: "p1", enDias: 0, hora: "09:00", confirmada: true } }),
      lead({ id: "b", visita: { propiedadId: "p1", enDias: 3, hora: "09:00", confirmada: false } }),
    ],
    propiedades: [propiedad()],
    hoy: HOY,
  });

  it("son seis semanas que arrancan en lunes", () => {
    const celdas = armarMes(agenda, "2026-08-01");
    expect(celdas).toHaveLength(42);
    expect(new Date(`${celdas[0].fecha}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it("marca hoy y cuenta las visitas de cada día", () => {
    const celdas = armarMes(agenda, "2026-08-01");
    const hoy = celdas.find((c) => c.fecha === HOY)!;
    expect(hoy.esHoy).toBe(true);
    expect(hoy.visitas).toBe(1);
    expect(hoy.sinConfirmar).toBe(0);
    expect(celdas.find((c) => c.fecha === "2026-08-15")!.sinConfirmar).toBe(1);
    expect(celdas.filter((c) => !c.delMes).length).toBeGreaterThan(0);
  });

  it("se mueve de mes sin perderse en enero", () => {
    expect(mesDe("2026-08-12")).toBe("2026-08");
    expect(sumarMeses("2026-12", 1)).toBe("2027-01");
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
  });
});

describe("visitas sembradas", () => {
  const agenda = construirAgenda({ leads: LEADS, propiedades: PROPIEDADES, hoy: HOY });

  it("hay visitas hoy y en los próximos días, para que se vea vivo", () => {
    expect(agenda.hoyVisitas.length).toBeGreaterThanOrEqual(2);
    expect(agenda.proximas.length).toBeGreaterThanOrEqual(2);
  });

  it("hay de venta y de alquiler", () => {
    expect(agenda.visitas.some((v) => v.operacion === "venta")).toBe(true);
    expect(agenda.visitas.some((v) => v.operacion === "alquiler")).toBe(true);
  });

  it("hay una confirmada, una sin confirmar y un choque para verlo en el demo", () => {
    expect(agenda.visitas.some((v) => v.confirmada)).toBe(true);
    expect(agenda.sinConfirmar).toBeGreaterThan(0);
    expect(agenda.choques).toBeGreaterThan(0);
  });

  it("todo lead en etapa de visita tiene su día y su hora", () => {
    for (const l of LEADS.filter((x) => x.etapa === "visita")) {
      expect(l.visita, `${l.id} está en visita sin fecha`).toBeDefined();
      expect(l.visita!.hora).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

describe("agendar desde la ficha del lead", () => {
  beforeEach(() => limpiarDemo());

  it("mueve al lead a la etapa de visita y lo pone en el calendario", () => {
    // Wendy está en "nuevo" en las semillas.
    const antes = cargarPipeline(HOY).leads.find((l) => l.id === "l1");
    expect(antes?.etapa).toBe("nuevo");

    agendarVisita("l1", { propiedadId: "p3", fecha: "2026-08-20", hora: "14:00", confirmada: false });

    const despues = cargarPipeline(HOY).leads.find((l) => l.id === "l1");
    expect(despues?.etapa).toBe("visita");

    const agenda = cargarAgenda(HOY);
    const visita = agenda.visitas.find((v) => v.leadId === "l1");
    expect(visita?.fecha).toBe("2026-08-20");
    expect(visita?.hora).toBe("14:00");
    expect(visita?.codigo).toBe("TZ-103");
    expect(visita?.confirmada).toBe(false);
  });

  it("cancelar la devuelve a donde estaba, sin dejar una cita huérfana", () => {
    agendarVisita("l1", { propiedadId: "p3", fecha: "2026-08-20", hora: "14:00", confirmada: true });
    cancelarVisita("l1");
    expect(cargarPipeline(HOY).leads.find((l) => l.id === "l1")?.etapa).toBe("nuevo");
    expect(cargarAgenda(HOY).visitas.some((v) => v.leadId === "l1")).toBe(false);
  });

  it("a un lead que no existe no se le agenda nada", () => {
    expect(agendarVisita("no-existe", { propiedadId: "p3", fecha: "2026-08-20", hora: "14:00", confirmada: true })).toBeNull();
  });
});
