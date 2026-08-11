import { describe, it, expect, beforeEach } from "vitest";
import { DEMO_LOGINS, TENANTS, isTenantId, resolveTenantByLogin } from "@/lib/tenants";
import { PMS_WRITE_ENABLED, noches, sumarDias, hoyEnZona } from "@/lib/cloudbeds";
import { construirPanel, type EntradaPanel } from "@/lib/hotel-panel";
import {
  borrarReservasSimuladas,
  crearReservaSimulada,
  listarReservasSimuladas,
  nochesDe,
  solapeSimulado,
} from "@/lib/hotel-reservas";
import {
  estadosDeHabitaciones,
  resumirEstados,
  type EntradaHabitaciones,
} from "@/lib/hotel-habitaciones";
import { MODULO_RUTA, moduloDeRuta, ROLES } from "@/lib/roles";
import { emparejarTipo } from "@/lib/hotel-agente";

describe("tenant hotel", () => {
  it("la contraseña miagentiahotel entra al hotel", () => {
    expect(resolveTenantByLogin("demoagentia", "miagentiahotel")).toBe("hotel");
  });

  it("usa el mismo usuario que los demás clientes", () => {
    const usuarios = new Set(
      DEMO_LOGINS.filter((l) => l.usuario === "demoagentia").map((l) => l.tenant),
    );
    expect(usuarios.has("hotel")).toBe(true);
  });

  it("no le roba la contraseña a otro cliente", () => {
    expect(resolveTenantByLogin("demoagentia", "demoh")).toBe("hospital");
    expect(resolveTenantByLogin("demoagentia", "demoi")).toBe("grupoq");
    expect(resolveTenantByLogin("demoagentia", "demoj")).toBe("excel");
    expect(resolveTenantByLogin("demoagentia", "demok")).toBe("miagentia");
  });

  it("cada contraseña resuelve a un solo cliente", () => {
    const porClave = new Map<string, string>();
    for (const l of DEMO_LOGINS.filter((x) => x.usuario === "demoagentia")) {
      expect(porClave.has(l.password)).toBe(false);
      porClave.set(l.password, l.tenant);
    }
  });

  it("queda registrado como tenant válido", () => {
    expect(isTenantId("hotel")).toBe(true);
    expect(TENANTS.hotel.id).toBe("hotel");
    expect(TENANTS.hotel.seed.staff.length).toBeGreaterThan(0);
    expect(TENANTS.hotel.tags.length).toBeGreaterThan(0);
  });

  it("el guion de la IA prohíbe inventar tarifas", () => {
    expect(TENANTS.hotel.ai.systemPrompt).toContain("consultar_disponibilidad_hotel");
    expect(TENANTS.hotel.ai.systemPrompt).toContain("reservar_habitacion");
  });

  it("ningún texto del cliente usa guiones largos", () => {
    const t = TENANTS.hotel;
    const textos = [
      t.ai.systemPrompt,
      t.brand.nombre,
      t.brand.tagline,
      ...t.tags,
      ...t.waTemplates.flatMap((w) => w.components.map((c) => c.text ?? "")),
      ...t.seed.messages.map((m) => m.texto),
      ...t.seed.internalMessages.map((m) => m.texto),
      ...t.seed.socialPosts.map((p) => p.texto),
    ];
    for (const texto of textos) expect(texto).not.toContain("—");
  });
});

describe("frontera de escritura del PMS", () => {
  it("está apagada y no depende de una variable de entorno", () => {
    expect(PMS_WRITE_ENABLED).toBe(false);
  });
});

describe("herramientas que ve la IA", () => {
  // El SDK exige una llave al construirse; aquí no se llama al modelo.
  async function herramientas() {
    process.env.ANTHROPIC_API_KEY ||= "test";
    return (await import("@/lib/ai")).herramientasDeTenant;
  }

  it("el hotel consulta el sistema de reservas y toma la reserva", async () => {
    const de = await herramientas();
    expect(de("hotel")).toEqual([
      "guardar_datos_contacto",
      "consultar_disponibilidad_hotel",
      "reservar_habitacion",
      "reaccionar",
    ]);
  });

  it("los demás clientes conservan sus herramientas de citas", async () => {
    const de = await herramientas();
    for (const t of ["hospital", "grupoq", "excel", "miagentia"] as const) {
      expect(de(t)).toContain("consultar_disponibilidad");
      expect(de(t)).toContain("confirmar_cita");
      expect(de(t)).not.toContain("reservar_habitacion");
    }
  });
});

describe("fechas del PMS", () => {
  it("cuenta noches entre dos fechas", () => {
    expect(noches("2026-08-11", "2026-08-14")).toBe(3);
    expect(noches("2026-08-11", "2026-08-11")).toBe(0);
  });

  it("suma días cruzando fin de mes", () => {
    expect(sumarDias("2026-08-30", 3)).toBe("2026-09-02");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("da la fecha en la zona del hotel", () => {
    expect(hoyEnZona("America/Guatemala")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("reservas simuladas", () => {
  beforeEach(() => borrarReservasSimuladas());

  it("se guardan con id propio y prefijo SIM", () => {
    const r = crearReservaSimulada({
      huesped: "Paula Marroquín",
      tipoId: "t1",
      tipoNombre: "Habitación 1",
      desde: "2026-08-14",
      hasta: "2026-08-16",
      adultos: 2,
      ninos: 0,
      tarifaTotal: 110,
      origen: "agente",
    });
    expect(r.id.startsWith("SIM-")).toBe(true);
    expect(listarReservasSimuladas()).toHaveLength(1);
  });

  it("detecta el solape con otra reserva del demo", () => {
    crearReservaSimulada({
      huesped: "Paula",
      tipoId: "t1",
      tipoNombre: "Habitación 1",
      desde: "2026-08-14",
      hasta: "2026-08-17",
      adultos: 1,
      ninos: 0,
      tarifaTotal: 165,
      origen: "agente",
    });
    // Se pisan
    expect(solapeSimulado("t1", "2026-08-16", "2026-08-19")).not.toBeNull();
    expect(solapeSimulado("t1", "2026-08-13", "2026-08-15")).not.toBeNull();
    expect(solapeSimulado("t1", "2026-08-15", "2026-08-16")).not.toBeNull();
    expect(solapeSimulado("t1", "2026-08-13", "2026-08-20")).not.toBeNull();
    // El día de salida ya queda libre para el siguiente huésped
    expect(solapeSimulado("t1", "2026-08-17", "2026-08-19")).toBeNull();
    expect(solapeSimulado("t1", "2026-08-11", "2026-08-14")).toBeNull();
    // Otra habitación no se ve afectada
    expect(solapeSimulado("t2", "2026-08-15", "2026-08-16")).toBeNull();
  });

  it("ocupa una noche por cada día de la estadía, sin contar la salida", () => {
    const r = crearReservaSimulada({
      huesped: "X",
      tipoId: "t1",
      tipoNombre: "Habitación 1",
      desde: "2026-08-14",
      hasta: "2026-08-17",
      adultos: 1,
      ninos: 0,
      tarifaTotal: 165,
      origen: "agente",
    });
    expect(nochesDe(r)).toEqual(["2026-08-14", "2026-08-15", "2026-08-16"]);
  });
});

// Datos con la misma forma que devuelve el PMS: 3 tipos, uno sin tarifa.
function entrada(over: Partial<EntradaPanel> = {}): EntradaPanel {
  return {
    propiedad: {
      id: "p1",
      nombre: "El Descanso Antigua",
      moneda: "USD",
      simbolo: "$",
      zonaHoraria: "America/Guatemala",
    },
    tipos: [
      { id: "t1", nombre: "Habitación 1", corto: "H01", maxHuespedes: 4, unidades: 1 },
      { id: "t2", nombre: "Habitación 2", corto: "H02", maxHuespedes: 4, unidades: 1 },
      { id: "t3", nombre: "Casa Divina", corto: "CDV", maxHuespedes: 16, unidades: 1 },
    ],
    noches: [
      { fecha: "2026-08-11", tipos: [{ id: "t1", tarifa: 55, disponibles: 1 }] },
      {
        fecha: "2026-08-12",
        tipos: [
          { id: "t1", tarifa: 55, disponibles: 1 },
          { id: "t2", tarifa: 33, disponibles: 1 },
        ],
      },
    ],
    reservas: [
      {
        id: "5GB83317DU",
        huesped: "Karen Gonzalez",
        desde: "2026-07-21",
        hasta: "2026-07-24",
        adultos: 1,
        ninos: 0,
        estado: "confirmed",
        saldo: 966.67,
        fuente: "Phone",
        creada: "2026-07-21 08:35:40",
      },
    ],
    simuladas: [],
    hoy: "2026-08-11",
    ...over,
  };
}

describe("panel de ocupación", () => {
  it("marca sin tarifa lo que nunca aparece en disponibilidad", () => {
    const p = construirPanel(entrada());
    const divina = p.filas.find((f) => f.id === "t3")!;
    expect(divina.reservable).toBe(false);
    expect(divina.noches.every((n) => n.estado === "sin_tarifa")).toBe(true);
    expect(p.kpis.sinTarifa).toBe(1);
    expect(p.kpis.reservables).toBe(2);
  });

  it("cuenta como ocupada la noche en que un tipo con tarifa no aparece", () => {
    const p = construirPanel(entrada());
    const h2 = p.filas.find((f) => f.id === "t2")!;
    expect(h2.noches[0].estado).toBe("ocupada");
    expect(h2.noches[1].estado).toBe("libre");
    expect(p.kpis.ocupadasHoy).toBe(1);
    expect(p.kpis.ocupacionHoyPct).toBe(50);
    expect(p.kpis.nochesVendibles).toBe(4);
    expect(p.kpis.nochesOcupadas).toBe(1);
  });

  it("pinta las reservas simuladas con su propio estado, sin mezclarlas con las del sistema", () => {
    const p = construirPanel(
      entrada({
        simuladas: [
          {
            id: "SIM-ABC123",
            huesped: "Paula",
            tipoId: "t1",
            tipoNombre: "Habitación 1",
            desde: "2026-08-11",
            hasta: "2026-08-12",
            adultos: 1,
            ninos: 0,
            tarifaTotal: 55,
            creada: "2026-08-11T10:00:00.000Z",
            origen: "agente",
          },
        ],
      }),
    );
    const h1 = p.filas.find((f) => f.id === "t1")!;
    expect(h1.noches[0].estado).toBe("simulada");
    expect(h1.noches[1].estado).toBe("libre");
    expect(p.kpis.reservasSimuladas).toBe(1);
    expect(p.kpis.reservasPms).toBe(1);
    expect(p.reservas.some((r) => r.id.startsWith("SIM-"))).toBe(false);
  });

  it("suma el saldo pendiente que reporta el sistema", () => {
    const p = construirPanel(entrada());
    expect(p.kpis.saldoPorCobrar).toBeCloseTo(966.67, 2);
  });

  it("guarda la tarifa por noche de cada habitación reservable", () => {
    const p = construirPanel(entrada());
    expect(p.filas.find((f) => f.id === "t1")!.tarifaNoche).toBe(55);
    expect(p.filas.find((f) => f.id === "t3")!.tarifaNoche).toBeUndefined();
  });

  // Un fallo de lectura del sistema (por ejemplo su límite de consultas) llega
  // como null. Si eso se tomara por "nada libre", el panel mostraría ocupación
  // inventada, que es justo lo que no puede pasar.
  it("una noche que no se pudo leer no cuenta como ocupada", () => {
    const p = construirPanel(
      entrada({
        noches: [
          { fecha: "2026-08-11", tipos: null },
          {
            fecha: "2026-08-12",
            tipos: [
              { id: "t1", tarifa: 55, disponibles: 1 },
              { id: "t2", tarifa: 33, disponibles: 1 },
            ],
          },
        ],
      }),
    );
    const h1 = p.filas.find((f) => f.id === "t1")!;
    expect(h1.noches[0].estado).toBe("sin_dato");
    expect(p.kpis.ocupadasHoy).toBe(0);
    expect(p.kpis.ocupacionHoyPct).toBe(0);
    expect(p.kpis.nochesOcupadas).toBe(0);
    // Solo la noche leída entra en el total vendible: 2 habitaciones x 1 noche.
    expect(p.kpis.nochesVendibles).toBe(2);
    expect(p.kpis.nochesSinDato).toBe(2);
  });

  it("sin ninguna noche leída no reporta ocupación", () => {
    const p = construirPanel(
      entrada({
        noches: [
          { fecha: "2026-08-11", tipos: null },
          { fecha: "2026-08-12", tipos: null },
        ],
      }),
    );
    expect(p.kpis.reservables).toBe(0);
    expect(p.kpis.nochesOcupadas).toBe(0);
    expect(p.kpis.nochesVendibles).toBe(0);
    expect(p.kpis.ocupacionHoyPct).toBe(0);
  });
});

// ── Sección "Habitaciones" ──

function habEntrada(over: Partial<EntradaHabitaciones> = {}): EntradaHabitaciones {
  return {
    tipos: [
      { id: "t1", nombre: "Habitación 1", maxHuespedes: 4 },
      { id: "t2", nombre: "Habitación 2", maxHuespedes: 4 },
      { id: "t3", nombre: "Casa Divina", maxHuespedes: 16 },
      { id: "t4", nombre: "Habitation 3", maxHuespedes: 1 },
    ],
    // El sistema devuelve solo lo que tiene tarifa y está libre TODO el rango.
    libres: [
      { id: "t1", tarifa: 110, disponibles: 1 },
      { id: "t4", tarifa: 100, disponibles: 1 },
    ],
    conTarifa: new Set(["t1", "t2", "t4"]),
    simuladas: [null, null, null, null],
    huespedes: 1,
    noches: 2,
    ...over,
  };
}

describe("estado de las habitaciones para un rango", () => {
  it("una habitación libre trae su tarifa por noche y el total", () => {
    const h = estadosDeHabitaciones(habEntrada()).find((x) => x.id === "t1")!;
    expect(h.estado).toBe("libre");
    expect(h.tarifaNoche).toBe(55);
    expect(h.totalEstadia).toBe(110);
  });

  it("la que tiene tarifa pero no aparece en el rango está ocupada", () => {
    const h = estadosDeHabitaciones(habEntrada()).find((x) => x.id === "t2")!;
    expect(h.estado).toBe("ocupada");
    expect(h.tarifaNoche).toBeUndefined();
  });

  it("la que no tiene tarifa se marca aparte, no como ocupada", () => {
    const h = estadosDeHabitaciones(habEntrada()).find((x) => x.id === "t3")!;
    expect(h.estado).toBe("sin_tarifa");
  });

  it("una reserva del demo gana sobre el estado del sistema", () => {
    const estados = estadosDeHabitaciones(
      habEntrada({
        simuladas: [
          {
            id: "SIM-AAA111",
            huesped: "Paula",
            tipoId: "t1",
            tipoNombre: "Habitación 1",
            desde: "2026-08-14",
            hasta: "2026-08-16",
            adultos: 1,
            ninos: 0,
            tarifaTotal: 110,
            creada: "2026-08-11T10:00:00.000Z",
            origen: "panel",
          },
          null,
          null,
          null,
        ],
      }),
    );
    const h = estados.find((x) => x.id === "t1")!;
    expect(h.estado).toBe("simulada");
    expect(h.reservaSimulada?.id).toBe("SIM-AAA111");
  });

  it("la que no admite ese número de huéspedes no se ofrece como libre", () => {
    const estados = estadosDeHabitaciones(habEntrada({ huespedes: 3 }));
    expect(estados.find((x) => x.id === "t4")!.estado).toBe("capacidad");
    expect(estados.find((x) => x.id === "t1")!.estado).toBe("libre");
  });

  // El 429 del sistema llega como null. Ninguna habitación puede quedar en
  // libre ni en ocupada con eso: se reservaría a ciegas.
  it("sin lectura del rango ninguna habitación queda libre ni ocupada", () => {
    const estados = estadosDeHabitaciones(habEntrada({ libres: null }));
    expect(estados.every((x) => x.estado === "sin_dato")).toBe(true);
    const r = resumirEstados(estados);
    expect(r.libre).toBe(0);
    expect(r.ocupada).toBe(0);
    expect(r.sin_dato).toBe(4);
  });

  it("sin saber qué tiene tarifa, la ausente queda sin dato en vez de ocupada", () => {
    const estados = estadosDeHabitaciones(habEntrada({ conTarifa: null }));
    expect(estados.find((x) => x.id === "t2")!.estado).toBe("sin_dato");
    expect(estados.find((x) => x.id === "t3")!.estado).toBe("sin_dato");
    expect(estados.find((x) => x.id === "t1")!.estado).toBe("libre");
  });

  it("el resumen cuenta cada estado una sola vez", () => {
    const estados = estadosDeHabitaciones(habEntrada());
    const r = resumirEstados(estados);
    expect(r.libre + r.ocupada + r.simulada + r.sin_tarifa + r.capacidad + r.sin_dato).toBe(
      estados.length,
    );
  });
});

describe("emparejar la habitación pedida", () => {
  const tipos = [
    { nombre: "Habitación 1" },
    { nombre: "Habitación 10/Divina" },
    { nombre: "El Descanso 8" },
  ];

  it("calza sin importar acentos ni mayúsculas", () => {
    expect(emparejarTipo(tipos, "habitacion 1")?.nombre).toBe("Habitación 1");
    expect(emparejarTipo(tipos, "EL DESCANSO 8")?.nombre).toBe("El Descanso 8");
  });

  it("no adivina una habitación que no existe", () => {
    expect(emparejarTipo(tipos, "Suite presidencial")).toBeNull();
    expect(emparejarTipo(tipos, "")).toBeNull();
  });
});

describe("navegación de la sección Habitaciones", () => {
  it("tiene ruta propia y se resuelve desde el pathname", () => {
    expect(MODULO_RUTA.habitaciones).toBe("/habitaciones");
    expect(moduloDeRuta("/habitaciones")).toBe("habitaciones");
  });

  it("la ven los roles que atienden al huésped, marketing no", () => {
    for (const rol of ["recepcion", "medico", "jefe", "gerente_marketing", "admin"] as const) {
      expect(ROLES[rol].ve).toContain("habitaciones");
    }
    expect(ROLES.marketing.ve).not.toContain("habitaciones");
  });
});
