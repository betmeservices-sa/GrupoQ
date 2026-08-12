// Ficha del huésped: emparejar un contacto de WhatsApp con la ficha del sistema
// del hotel, y armar sus estadías sin inventar nada.
import { describe, it, expect } from "vitest";
import {
  armarEstadia,
  armarHuesped,
  limpio,
  normalizarNotas,
  type EstadiaPms,
  type HuespedPms,
} from "@/lib/cloudbeds";
import {
  armarEstadiaFicha,
  claveCorreo,
  claveNombre,
  claveTelefono,
  emparejarHuesped,
  estadoLegible,
  momentoDe,
  ordenarEstadias,
  type EstadiaFicha,
} from "@/lib/hotel-huesped";

// Fila real de la propiedad (getGuestList con includeGuestInfo), recortada.
const KAREN_API = {
  guestID: "255039214755968",
  reservationID: "5GB83317DU",
  guestName: "Karen Gonzalez",
  guestFirstName: "Karen",
  guestLastName: "Gonzalez",
  guestEmail: "correo@ejemplo.com",
  guestPhone: "N/A",
  guestCellPhone: "",
  guestCountry: "GT",
  isMainGuest: true,
};

function huesped(p: Partial<HuespedPms> = {}): HuespedPms {
  return {
    id: "g1",
    reservaId: "R1",
    nombre: "Ana",
    apellido: "Pérez",
    nombreCompleto: "Ana Pérez",
    correo: "",
    telefono: "",
    celular: "",
    pais: "GT",
    esPrincipal: true,
    ...p,
  };
}

describe("limpieza de campos del sistema", () => {
  it("los rellenos del sistema no se muestran como dato", () => {
    for (const v of ["N/A", "-", "0000-00-00", "-0001-11-30", "  ", null, undefined]) {
      expect(limpio(v)).toBe("");
    }
    expect(limpio(" Karen ")).toBe("Karen");
  });

  it("un teléfono 'N/A' queda vacío, no se muestra como número", () => {
    const h = armarHuesped(KAREN_API);
    expect(h.telefono).toBe("");
    expect(h.nombreCompleto).toBe("Karen Gonzalez");
    expect(h.correo).toBe("correo@ejemplo.com");
  });
});

describe("claves de emparejamiento", () => {
  it("el teléfono empareja sin importar el formato ni el país", () => {
    expect(claveTelefono("+502 5788 1234")).toBe("57881234");
    expect(claveTelefono("50257881234")).toBe("57881234");
    expect(claveTelefono("5788-1234")).toBe("57881234");
    // Formato salvadoreño, el mismo criterio que usa lib/phone.
    expect(claveTelefono("50376294980")).toBe("76294980");
  });

  it("un número corto no empareja con nadie", () => {
    expect(claveTelefono("1234")).toBe("");
    expect(claveTelefono("")).toBe("");
    expect(claveTelefono(null)).toBe("");
  });

  it("el correo se compara en minúsculas y tiene que ser un correo", () => {
    expect(claveCorreo(" Karen@Correo.COM ")).toBe("karen@correo.com");
    expect(claveCorreo("karen")).toBe("");
  });

  it("el nombre se compara sin tildes ni signos", () => {
    expect(claveNombre("Karen González")).toBe("karen gonzalez");
    expect(claveNombre("  KAREN   Gonzalez ")).toBe("karen gonzalez");
  });
});

describe("emparejar contacto con la ficha del hotel", () => {
  const padron = [
    huesped({ id: "g1", nombreCompleto: "Karen Gonzalez", correo: "karen@correo.com" }),
    huesped({ id: "g2", nombreCompleto: "Steven Clark", telefono: "+502 5788 1234" }),
    huesped({ id: "g3", nombreCompleto: "Rocío Herrera", celular: "50241207766" }),
  ];

  it("el teléfono manda sobre todo lo demás", () => {
    const m = emparejarHuesped({ telefono: "50257881234", nombre: "Karen Gonzalez" }, padron);
    expect(m?.huesped.id).toBe("g2");
    expect(m?.vinculo).toBe("telefono");
  });

  it("también empareja contra el celular", () => {
    expect(emparejarHuesped({ telefono: "41207766" }, padron)?.huesped.id).toBe("g3");
  });

  it("el correo empareja cuando no hay teléfono", () => {
    const m = emparejarHuesped({ correo: "KAREN@correo.com" }, padron);
    expect(m?.huesped.id).toBe("g1");
    expect(m?.vinculo).toBe("correo");
  });

  it("el nombre completo se ofrece aparte, marcado como tal", () => {
    const m = emparejarHuesped({ telefono: "50299999999", nombre: "Karen González" }, padron);
    expect(m?.huesped.id).toBe("g1");
    expect(m?.vinculo).toBe("nombre");
  });

  it("un nombre de pila suelto NO empareja", () => {
    expect(emparejarHuesped({ nombre: "Karen" }, padron)).toBeNull();
  });

  it("un nombre parecido pero distinto no empareja", () => {
    expect(emparejarHuesped({ nombre: "Karen Gonzalez Lopez" }, padron)).toBeNull();
  });

  it("sin ningún dato en común devuelve nulo, no el primero de la lista", () => {
    expect(emparejarHuesped({ telefono: "50211112222", correo: "otro@correo.com" }, padron)).toBeNull();
  });

  it("un padrón vacío no empareja", () => {
    expect(emparejarHuesped({ telefono: "50257881234" }, [])).toBeNull();
  });
});

describe("notas del sistema del hotel", () => {
  it("sin notas el sistema omite el campo, y eso es 'no hay', no un fallo", () => {
    expect(normalizarNotas(undefined)).toEqual([]);
    expect(normalizarNotas([])).toEqual([]);
  });

  it("lee las notas vengan como arreglo o como objeto indexado", () => {
    const arreglo = normalizarNotas([
      { noteID: 7, note: "Pidió almohada extra", dateCreated: "2026-07-21 10:00", userName: "Julio" },
    ]);
    expect(arreglo).toEqual([
      { id: "7", texto: "Pidió almohada extra", fecha: "2026-07-21 10:00", autor: "Julio" },
    ]);
    const objeto = normalizarNotas({ "7": { id: 7, text: "Llega tarde", date: "2026-07-20" } });
    expect(objeto[0].texto).toBe("Llega tarde");
  });

  it("descarta las entradas sin texto en vez de pintar notas vacías", () => {
    expect(normalizarNotas([{ noteID: 1, note: "   " }, { noteID: 2, note: "Vale" }])).toHaveLength(1);
  });
});

describe("estadías", () => {
  // Reserva real de la propiedad (getReservations con includeGuestsDetails).
  const CRUDA = {
    reservationID: "5GB83317DU",
    status: "confirmed",
    startDate: "2026-07-21",
    endDate: "2026-07-24",
    adults: "1",
    children: "0",
    balance: 966.67,
    sourceID: "s-3",
    sourceName: "Phone",
    dateCreated: "2026-07-21 08:35:40",
    guestList: {
      "255039214755968": {
        ...KAREN_API,
        assignedRoom: true,
        roomName: "Des(1)",
        roomTypeName: "El Descanso 8",
        rooms: [{ roomName: "Des(1)", roomTypeName: "El Descanso 8" }],
      },
    },
  };

  it("arma la reserva real con su habitación, su saldo y su canal", () => {
    const e = armarEstadia(CRUDA);
    expect(e.id).toBe("5GB83317DU");
    expect(e.desde).toBe("2026-07-21");
    expect(e.hasta).toBe("2026-07-24");
    expect(e.saldo).toBeCloseTo(966.67, 2);
    expect(e.fuente).toBe("Phone");
    expect(e.habitaciones).toEqual(["Des(1)"]);
    expect(e.sinAsignar).toBe(0);
  });

  it("cuenta a quien todavía no tiene habitación puesta", () => {
    const e = armarEstadia({
      ...CRUDA,
      guestList: {
        g1: { ...KAREN_API, assignedRoom: false, roomTypeName: "Habitación 1", rooms: [] },
      },
    });
    expect(e.sinAsignar).toBe(1);
    expect(e.habitaciones).toEqual([]);
    expect(e.tipos).toEqual(["Habitación 1"]);
  });

  it("el momento sale de las fechas, no del estado", () => {
    // La reserva real quedó "confirmed" para siempre porque nadie registró la
    // entrada: eso no la vuelve una estadía en curso.
    expect(momentoDe("2026-07-21", "2026-07-24", "2026-08-12")).toBe("pasada");
    expect(momentoDe("2026-08-20", "2026-08-22", "2026-08-12")).toBe("futura");
    expect(momentoDe("2026-08-10", "2026-08-15", "2026-08-12")).toBe("en_casa");
    // El día de salida ya no cuenta como noche en casa.
    expect(momentoDe("2026-08-10", "2026-08-12", "2026-08-12")).toBe("pasada");
  });

  it("traduce el estado del sistema y deja pasar los que no conoce", () => {
    expect(estadoLegible("confirmed")).toBe("Confirmada");
    expect(estadoLegible("checked_in")).toBe("En casa");
    expect(estadoLegible("otra_cosa")).toBe("otra_cosa");
  });

  it("marca el canal externo con lo que dice el sistema", () => {
    const fuentes = [
      { id: "s-3", nombre: "Phone", externa: false, comision: 0 },
      { id: "ss-1", nombre: "Airbnb (API)", externa: true, comision: 0 },
    ];
    const propia = armarEstadiaFicha(armarEstadia(CRUDA), "2026-08-12", fuentes, []);
    expect(propia.fuente).toBe("Phone");
    expect(propia.fuenteExterna).toBe(false);
    expect(propia.noches).toBe(3);

    const portal = armarEstadiaFicha(
      armarEstadia({ ...CRUDA, sourceID: "ss-1", sourceName: "Airbnb (API)" }),
      "2026-08-12",
      fuentes,
      [],
    );
    expect(portal.fuenteExterna).toBe(true);
  });

  it("distingue 'sin notas' de 'no se pudo consultar'", () => {
    const sinNotas = armarEstadiaFicha(armarEstadia(CRUDA), "2026-08-12", [], []);
    const sinLectura = armarEstadiaFicha(armarEstadia(CRUDA), "2026-08-12", [], null);
    expect(sinNotas.notas).toEqual([]);
    expect(sinLectura.notas).toBeNull();
  });

  it("primero la que está en casa, después lo que viene y al final el historial", () => {
    const base = (p: Partial<EstadiaFicha>): EstadiaFicha => ({
      id: "x",
      estado: "Confirmada",
      estadoCrudo: "confirmed",
      momento: "pasada",
      desde: "2026-01-01",
      hasta: "2026-01-02",
      noches: 1,
      adultos: 1,
      ninos: 0,
      habitaciones: [],
      tipos: [],
      saldo: 0,
      fuente: "Phone",
      fuenteExterna: false,
      sinAsignar: 0,
      notas: [],
      ...p,
    });
    const orden = ordenarEstadias([
      base({ id: "vieja", momento: "pasada", desde: "2025-01-01" }),
      base({ id: "reciente", momento: "pasada", desde: "2026-07-21" }),
      base({ id: "proxima", momento: "futura", desde: "2026-09-01" }),
      base({ id: "ahora", momento: "en_casa", desde: "2026-08-10" }),
    ]).map((e) => e.id);
    expect(orden).toEqual(["ahora", "proxima", "reciente", "vieja"]);
  });

  it("una reserva sin habitación no se queda sin nombre en pantalla", () => {
    const e: EstadiaPms = armarEstadia({
      ...CRUDA,
      guestList: { g1: { ...KAREN_API, assignedRoom: false, roomTypeName: "Casa Divina", rooms: [] } },
    });
    expect(e.habitaciones.length === 0 && e.tipos.length > 0).toBe(true);
  });
});
