// El día de recepción. Lo que se prueba acá es la regla que sostiene toda la
// pantalla: una lectura que falla NUNCA se convierte en cero.
import { describe, it, expect, beforeEach } from "vitest";
import {
  METODOS,
  PMS_WRITE_ENABLED,
  armarDetallePropiedad,
  armarEstadia,
  olvidarDireccionPropiedad,
  paisYZipDeLaPropiedad,
  type EstadiaPms,
  type LimpiezaPms,
} from "@/lib/cloudbeds";
import { construirDia, resumirLimpieza, type EntradaDia } from "@/lib/hotel-dia";
import { contarPublicables } from "@/lib/hotel-capacidades";
import { MODULO_RUTA, moduloDeRuta, ROLES } from "@/lib/roles";

const HOY = "2026-08-12";

function estadia(p: Partial<Parameters<typeof armarEstadia>[0]> = {}): EstadiaPms {
  return armarEstadia({
    reservationID: "R1",
    status: "confirmed",
    startDate: HOY,
    endDate: "2026-08-14",
    adults: "2",
    children: "0",
    balance: 0,
    sourceID: "s-3",
    sourceName: "Phone",
    guestList: {
      g1: {
        guestID: "g1",
        guestName: "Ana Pérez",
        isMainGuest: true,
        assignedRoom: true,
        roomName: "H01(1)",
        roomTypeName: "Habitación 1",
        rooms: [{ roomName: "H01(1)", roomTypeName: "Habitación 1" }],
      },
    },
    ...p,
  });
}

function entrada(p: Partial<EntradaDia> = {}): EntradaDia {
  return {
    propiedad: null,
    hoy: HOY,
    ventana: 14,
    proximas: [],
    salidas: [],
    enCasa: [],
    libres: [],
    limpieza: [],
    bloqueos: [],
    fuentes: [],
    ...p,
  };
}

describe("frontera de escritura", () => {
  it("sigue apagada", () => {
    expect(PMS_WRITE_ENABLED).toBe(false);
  });

  it("la lista blanca solo tiene consultas de lectura", () => {
    for (const m of METODOS) expect(m.startsWith("get")).toBe(true);
    for (const prefijo of ["post", "put", "patch", "delete"]) {
      expect(METODOS.some((m) => m.toLowerCase().startsWith(prefijo))).toBe(false);
    }
  });

  it("no hay repetidos en la lista blanca", () => {
    expect(new Set(METODOS).size).toBe(METODOS.length);
  });
});

describe("el día de recepción", () => {
  it("separa las llegadas de hoy de las de la ventana", () => {
    const d = construirDia(
      entrada({
        proximas: [
          estadia({ reservationID: "HOY1", startDate: HOY }),
          estadia({ reservationID: "LUEGO", startDate: "2026-08-20", endDate: "2026-08-22" }),
        ],
      }),
    );
    expect(d.llegadas?.map((m) => m.id)).toEqual(["HOY1"]);
  });

  it("deja fuera lo cancelado y lo que no se presentó", () => {
    const d = construirDia(
      entrada({
        proximas: [
          estadia({ reservationID: "VIVA" }),
          estadia({ reservationID: "MUERTA", status: "canceled" }),
          estadia({ reservationID: "NOSHOW", status: "no_show" }),
        ],
        salidas: [estadia({ reservationID: "SALE", endDate: HOY, status: "canceled" })],
      }),
    );
    expect(d.llegadas?.map((m) => m.id)).toEqual(["VIVA"]);
    expect(d.salidas).toEqual([]);
  });

  it("las salidas son solo las de hoy", () => {
    const d = construirDia(
      entrada({
        salidas: [
          estadia({ reservationID: "SALE", startDate: "2026-08-10", endDate: HOY }),
          estadia({ reservationID: "OTRO", startDate: "2026-08-10", endDate: "2026-08-13" }),
        ],
      }),
    );
    expect(d.salidas?.map((m) => m.id)).toEqual(["SALE"]);
  });

  it("saca a la luz las reservas sin habitación puesta", () => {
    const sinAsignar = estadia({
      reservationID: "PENDIENTE",
      startDate: "2026-08-18",
      endDate: "2026-08-20",
      guestList: {
        g1: {
          guestID: "g1",
          guestName: "Luis Mena",
          isMainGuest: true,
          assignedRoom: false,
          roomTypeName: "Casa Divina",
          rooms: [],
        },
      },
    });
    const d = construirDia(entrada({ proximas: [estadia(), sinAsignar] }));
    expect(d.sinHabitacion?.map((m) => m.id)).toEqual(["PENDIENTE"]);
    expect(d.sinHabitacion?.[0].tipos).toEqual(["Casa Divina"]);
    // Y no se cuela en las llegadas de hoy: entra dentro de seis días.
    expect(d.llegadas).toHaveLength(1);
  });

  it("un vacío real es cero, y se puede distinguir", () => {
    const d = construirDia(entrada());
    expect(d.llegadas).toEqual([]);
    expect(d.salidas).toEqual([]);
    expect(d.enCasa).toEqual([]);
    expect(d.faltantes).toEqual([]);
  });

  it("lo que no respondió queda en null y se nombra, nunca en cero", () => {
    const d = construirDia(
      entrada({ proximas: null, salidas: null, enCasa: null, libres: null, limpieza: null, bloqueos: null }),
    );
    expect(d.llegadas).toBeNull();
    expect(d.salidas).toBeNull();
    expect(d.enCasa).toBeNull();
    expect(d.sinHabitacion).toBeNull();
    expect(d.limpieza).toBeNull();
    expect(d.bloqueos).toBeNull();
    expect(d.faltantes).toContain("las llegadas");
    expect(d.faltantes).toContain("la limpieza");
    expect(d.faltantes.length).toBeGreaterThan(4);
  });

  it("el nombre que se muestra es el del huésped principal", () => {
    const d = construirDia({
      ...entrada({ proximas: [estadia()] }),
    });
    expect(d.llegadas?.[0].huesped).toBe("Ana Pérez");
  });

  it("marca el portal externo con el catálogo de canales del hotel", () => {
    const d = construirDia(
      entrada({
        proximas: [estadia({ sourceID: "ss-1", sourceName: "Airbnb (API)" })],
        fuentes: [{ id: "ss-1", nombre: "Airbnb (API)", externa: true, comision: 0 }],
      }),
    );
    expect(d.llegadas?.[0].fuenteExterna).toBe(true);
  });
});

describe("limpieza", () => {
  const hab = (p: Partial<LimpiezaPms>): LimpiezaPms => ({
    habitacionId: "r1",
    habitacion: "H01(1)",
    tipo: "Habitación 1",
    condicion: "clean",
    ocupada: false,
    bloqueada: false,
    usoFrontdesk: "unused",
    responsable: "",
    noMolestar: false,
    comentario: "",
    llegada: "",
    salida: "",
    actualizado: "",
    ...p,
  });

  it("cuenta por condición y solo saca las que piden trabajo", () => {
    const r = resumirLimpieza([
      hab({ habitacionId: "1" }),
      hab({ habitacionId: "2", condicion: "dirty" }),
      hab({ habitacionId: "3", condicion: "inspected" }),
    ]);
    expect(r.listas).toBe(1);
    expect(r.porLimpiar).toBe(1);
    expect(r.revisadas).toBe(1);
    expect(r.total).toBe(3);
    expect(r.pendientes.map((h) => h.habitacionId)).toEqual(["2"]);
  });

  it("una habitación lista con nota o con 'no molestar' igual se muestra", () => {
    const r = resumirLimpieza([
      hab({ habitacionId: "1" }),
      hab({ habitacionId: "2", noMolestar: true }),
      hab({ habitacionId: "3", comentario: "Se cambió el calentador" }),
    ]);
    expect(r.pendientes.map((h) => h.habitacionId)).toEqual(["2", "3"]);
  });

  it("con todo limpio no hay pendientes", () => {
    expect(resumirLimpieza([hab({}), hab({ habitacionId: "2" })]).pendientes).toEqual([]);
  });
});

describe("habitaciones que el hotel todavía no puede vender", () => {
  const tipos = Array.from({ length: 16 }, (_, i) => ({ id: `t${i + 1}` }));
  const conTarifa = [{ id: "t1" }, { id: "t2" }, { id: "t3" }, { id: "t4" }, { id: "t5" }];

  it("cuenta contra la propiedad real: 5 a la venta, 11 sin tarifa", () => {
    const r = contarPublicables(tipos, [conTarifa, conTarifa, conTarifa]);
    expect(r.conTarifa).toBe(5);
    expect(r.sinTarifa).toBe(11);
    expect(r.leidas).toBe(3);
  });

  it("una noche ocupada no convierte a la habitación en 'sin tarifa'", () => {
    // La misma habitación falta una noche por estar tomada, pero aparece en otra.
    const r = contarPublicables(tipos, [[{ id: "t1" }], [{ id: "t1" }, { id: "t2" }], null]);
    expect(r.conTarifa).toBe(2);
    expect(r.leidas).toBe(2);
  });

  it("si no se pudo leer ninguna noche, no se afirma que falten tarifas", () => {
    const r = contarPublicables(tipos, [null, null, null]);
    expect(r.leidas).toBe(0);
  });
});

describe("país y código postal de la propiedad", () => {
  const DETALLE = {
    propertyID: "241249725821056",
    propertyName: "El Descanso Antigua",
    propertyType: "Hostel",
    propertyPhone: "+502 51956782",
    propertyEmail: "reservas@ejemplo.com",
    propertyCurrency: { currencyCode: "USD", currencySymbol: "$" },
    propertyAddress: {
      propertyAddress1: "Calle del Rastro, Colonia San Jose",
      propertyCity: "Antigua",
      propertyState: "Sacatepequez",
      propertyZip: "03001",
      propertyCountry: "GT",
    },
    propertyPolicy: { propertyCheckInTime: "14:00", propertyCheckOutTime: "12:00" },
    propertyBookingUrl: "https://ejemplo/reservation/GL7F57",
  };

  beforeEach(() => olvidarDireccionPropiedad());

  it("lee la dirección tal como la tiene cargada el hotel", () => {
    const d = armarDetallePropiedad(DETALLE, "America/Guatemala");
    expect(d.direccion.pais).toBe("GT");
    expect(d.direccion.zip).toBe("03001");
    expect(d.direccion.ciudad).toBe("Antigua");
    expect(d.checkIn).toBe("14:00");
  });

  it("devuelve el país y el código postal de la propiedad, no los del huésped", async () => {
    const r = await paisYZipDeLaPropiedad(async () => ({
      ok: true,
      datos: armarDetallePropiedad(DETALLE, "America/Guatemala"),
    }));
    expect(r.ok && r.datos.pais).toBe("GT");
    expect(r.ok && r.datos.zip).toBe("03001");
  });

  it("no vuelve a preguntar mientras el dato esté cacheado", async () => {
    let veces = 0;
    const leer = async () => {
      veces += 1;
      return { ok: true as const, datos: armarDetallePropiedad(DETALLE, "America/Guatemala") };
    };
    await paisYZipDeLaPropiedad(leer);
    await paisYZipDeLaPropiedad(leer);
    expect(veces).toBe(1);
  });

  it("si el hotel no tiene código postal cargado, lo dice en vez de inventarlo", async () => {
    const sinZip = {
      ...DETALLE,
      propertyAddress: { ...DETALLE.propertyAddress, propertyZip: "" },
    };
    const r = await paisYZipDeLaPropiedad(async () => ({
      ok: true,
      datos: armarDetallePropiedad(sinZip, "America/Guatemala"),
    }));
    expect(r.ok).toBe(false);
  });

  it("una lectura fallida no deja un país pegado en la caché", async () => {
    const r = await paisYZipDeLaPropiedad(async () => ({ ok: false, error: "sin respuesta" }));
    expect(r.ok).toBe(false);
    const ok = await paisYZipDeLaPropiedad(async () => ({
      ok: true,
      datos: armarDetallePropiedad(DETALLE, "America/Guatemala"),
    }));
    expect(ok.ok && ok.datos.pais).toBe("GT");
  });
});

describe("la pantalla del día en el menú", () => {
  it("tiene ruta propia", () => {
    expect(MODULO_RUTA.hoy).toBe("/hoy");
    expect(moduloDeRuta("/hoy")).toBe("hoy");
  });

  it("la ve quien atiende al huésped, no marketing", () => {
    expect(ROLES.recepcion.ve).toContain("hoy");
    expect(ROLES.admin.ve).toContain("hoy");
    expect(ROLES.marketing.ve).not.toContain("hoy");
  });
});
