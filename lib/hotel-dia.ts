// El día de recepción: llegadas, salidas, quién está en casa, qué falta asignar,
// cómo está la limpieza y qué habitaciones están bloqueadas. SOLO LECTURA.
//
// `construirDia` es puro (recibe lo ya leído) para poder probarlo sin red;
// `cargarDia` es el que habla con el sistema del hotel, va en tandas para no
// chocar con el límite de consultas, y cachea un par de minutos.
//
// Regla que atraviesa todo el archivo: una lectura que falla entra como null y
// sale como aviso ("no se pudo consultar"), NUNCA como cero. En recepción, "no
// hay salidas hoy" y "no se pudo leer" llevan a decisiones opuestas.

import {
  bloqueosDeHabitacion,
  buscarEstadias,
  estadoDeLimpieza,
  habitacionesSinAsignar,
  hoyEnZona,
  huespedesPorEstado,
  listarFuentes,
  noches,
  obtenerPropiedad,
  sumarDias,
  type BloqueoPms,
  type EstadiaPms,
  type FuentePms,
  type HabitacionPms,
  type HuespedEnCasaPms,
  type LimpiezaPms,
  type PropiedadPms,
} from "./cloudbeds";
import { estadoLegible } from "./hotel-huesped";
import { listarReservasSimuladas, type ReservaSimulada } from "./hotel-reservas";

// Las reservas del demo no existen en el sistema del hotel, así que el panel
// del día no las vería nunca. Se suman acá, marcadas, para que lo que cierra
// el agente aparezca donde recepción lo busca.
function simuladaAMovimiento(r: ReservaSimulada): Movimiento {
  return {
    id: r.id,
    huesped: r.huesped,
    estado: "Reserva del demo",
    desde: r.desde,
    hasta: r.hasta,
    noches: noches(r.desde, r.hasta),
    adultos: r.adultos,
    ninos: r.ninos,
    habitaciones: [],
    tipos: [r.tipoNombre],
    saldo: r.tarifaTotal,
    fuente: r.origen === "agente" ? "WhatsApp" : "Tablero",
    fuenteExterna: false,
    sinAsignar: 1,
    simulada: true,
  };
}

export const ZONA_HOTEL = "America/Guatemala";

// Reservas que ya no son trabajo de recepción.
const MUERTAS = new Set(["canceled", "no_show"]);

export interface Movimiento {
  id: string;
  huesped: string;
  estado: string;
  desde: string;
  hasta: string;
  noches: number;
  adultos: number;
  ninos: number;
  habitaciones: string[];
  tipos: string[];
  saldo: number;
  fuente: string;
  fuenteExterna: boolean;
  sinAsignar: number;
  /** Reserva del demo, no del sistema del hotel. Se pinta distinta. */
  simulada?: boolean;
}

export interface EnCasa {
  reservaId: string;
  huesped: string;
  habitacion: string;
  desde: string;
  hasta: string;
  correo: string;
  telefono: string;
}

export interface ResumenLimpieza {
  listas: number;
  porLimpiar: number;
  revisadas: number;
  sinServicio: number;
  // Habitaciones que piden trabajo hoy, o que dejaron una nota.
  pendientes: LimpiezaPms[];
  total: number;
}

export interface PanelDia {
  propiedad: PropiedadPms | null;
  hoy: string;
  ventana: number; // días hacia adelante que mira "sin habitación asignada"
  llegadas: Movimiento[] | null;
  salidas: Movimiento[] | null;
  enCasa: EnCasa[] | null;
  sinHabitacion: Movimiento[] | null;
  libres: HabitacionPms[] | null;
  limpieza: ResumenLimpieza | null;
  bloqueos: BloqueoPms[] | null;
  // Qué no respondió el sistema, en palabras de recepción.
  faltantes: string[];
  consultado: string;
}

export interface EntradaDia {
  propiedad: PropiedadPms | null;
  hoy: string;
  ventana: number;
  proximas: EstadiaPms[] | null; // entradas desde hoy hasta hoy + ventana
  salidas: EstadiaPms[] | null; // salidas de hoy
  enCasa: HuespedEnCasaPms[] | null;
  libres: HabitacionPms[] | null;
  limpieza: LimpiezaPms[] | null;
  bloqueos: BloqueoPms[] | null;
  fuentes: FuentePms[];
  /** Reservas del demo. Se inyectan para poder probar el panel sin PMS. */
  simuladas?: ReservaSimulada[];
}

function aMovimiento(e: EstadiaPms, fuentes: FuentePms[]): Movimiento {
  const f = fuentes.find((x) => x.id === e.fuenteId || x.nombre === e.fuente);
  return {
    id: e.id,
    huesped: e.huespedes.find((h) => h.esPrincipal)?.nombreCompleto ?? e.huespedes[0]?.nombreCompleto ?? "",
    estado: estadoLegible(e.estado),
    desde: e.desde,
    hasta: e.hasta,
    noches: noches(e.desde, e.hasta),
    adultos: e.adultos,
    ninos: e.ninos,
    habitaciones: e.habitaciones,
    tipos: e.tipos,
    saldo: e.saldo,
    fuente: f?.nombre ?? e.fuente,
    fuenteExterna: f?.externa ?? false,
    sinAsignar: e.sinAsignar,
  };
}

export function resumirLimpieza(filas: LimpiezaPms[]): ResumenLimpieza {
  const cuenta = (c: string) => filas.filter((f) => f.condicion === c).length;
  return {
    listas: cuenta("clean"),
    porLimpiar: cuenta("dirty"),
    revisadas: cuenta("inspected"),
    sinServicio: cuenta("no_service"),
    // Piden trabajo hoy las que no están listas, y también las que dejaron una
    // marca que recepción tiene que ver antes de mandar a alguien.
    pendientes: filas.filter(
      (f) =>
        (f.condicion !== "clean" && f.condicion !== "inspected") ||
        f.noMolestar ||
        f.comentario !== "",
    ),
    total: filas.length,
  };
}

export function construirDia(e: EntradaDia): PanelDia {
  const faltantes: string[] = [];
  const vivas = (lista: EstadiaPms[]) => lista.filter((r) => !MUERTAS.has(r.estado));
  const simuladas = e.simuladas ?? [];
  const simLlegan = simuladas.filter((r) => r.desde === e.hoy).map(simuladaAMovimiento);
  const simSalen = simuladas.filter((r) => r.hasta === e.hoy).map(simuladaAMovimiento);
  // "En casa" en el demo = entró antes de hoy y todavía no se va.
  const simEnCasa = simuladas.filter((r) => r.desde < e.hoy && r.hasta > e.hoy);

  let llegadas: Movimiento[] | null = null;
  let sinHabitacion: Movimiento[] | null = null;
  if (e.proximas === null) {
    faltantes.push("las llegadas");
    faltantes.push("las reservas sin habitación");
  } else {
    const activas = vivas(e.proximas);
    llegadas = [...activas.filter((r) => r.desde === e.hoy).map((r) => aMovimiento(r, e.fuentes)), ...simLlegan];
    sinHabitacion = [
      ...activas.filter((r) => r.sinAsignar > 0).map((r) => aMovimiento(r, e.fuentes)),
      // La del demo nunca tiene habitación puesta: no existe en el sistema.
      ...simuladas.filter((r) => r.hasta > e.hoy).map(simuladaAMovimiento),
    ];
  }

  let salidas: Movimiento[] | null = null;
  if (e.salidas === null) faltantes.push("las salidas");
  else {
    salidas = [
      ...vivas(e.salidas)
        .filter((r) => r.hasta === e.hoy)
        .map((r) => aMovimiento(r, e.fuentes)),
      ...simSalen,
    ];
  }

  let enCasa: EnCasa[] | null = null;
  if (e.enCasa === null) faltantes.push("quién está en casa");
  else {
    enCasa = e.enCasa.map((h) => ({
      reservaId: h.reservaId,
      huesped: h.nombre,
      habitacion: h.habitacion,
      desde: h.desde,
      hasta: h.hasta,
      correo: h.correo,
      telefono: h.telefono,
    }));
    enCasa = [
      ...enCasa,
      ...simEnCasa.map((r) => ({
        reservaId: r.id,
        huesped: r.huesped,
        habitacion: r.tipoNombre,
        desde: r.desde,
        hasta: r.hasta,
        correo: "",
        telefono: r.telefono ?? "",
      })),
    ];
  }

  if (e.libres === null) faltantes.push("las habitaciones libres");
  if (e.limpieza === null) faltantes.push("la limpieza");
  if (e.bloqueos === null) faltantes.push("los bloqueos");

  return {
    propiedad: e.propiedad,
    hoy: e.hoy,
    ventana: e.ventana,
    llegadas,
    salidas,
    enCasa,
    sinHabitacion,
    libres: e.libres,
    limpieza: e.limpieza === null ? null : resumirLimpieza(e.limpieza),
    bloqueos: e.bloqueos,
    faltantes,
    consultado: new Date().toISOString(),
  };
}

// ── Lectura del sistema ──

const TTL_MS = 2 * 60 * 1000;
const DIAS_BLOQUEOS = 30;
let cache: { clave: string; ts: number; panel: PanelDia } | null = null;

export function invalidarCacheDia(): void {
  cache = null;
}

export async function cargarDia(ventana = 14): Promise<PanelDia> {
  const clave = `v${ventana}`;
  if (cache && cache.clave === clave && Date.now() - cache.ts < TTL_MS) return cache.panel;

  const propiedad = await obtenerPropiedad();
  const hoy = hoyEnZona(propiedad?.zonaHoraria ?? ZONA_HOTEL);
  const manana = sumarDias(hoy, 1);

  // Siete consultas, de a cuatro (el mismo tamaño de tanda que usa enTandas): el
  // sistema corta con "límite de consultas" si le llegan todas juntas, y este
  // panel es el que más veces se abre en el día.
  const [proximas, salidas, enCasa, libres] = await Promise.all([
    buscarEstadias({ entradaDesde: hoy, entradaHasta: sumarDias(hoy, ventana) }),
    buscarEstadias({ salidaDesde: hoy, salidaHasta: hoy }),
    huespedesPorEstado("in_house"),
    habitacionesSinAsignar(hoy, manana),
  ]);
  const [limpieza, bloqueos, fuentes] = await Promise.all([
    estadoDeLimpieza(),
    bloqueosDeHabitacion(hoy, sumarDias(hoy, DIAS_BLOQUEOS)),
    listarFuentes(),
  ]);

  const panel = construirDia({
    propiedad,
    hoy,
    ventana,
    proximas: proximas.ok ? proximas.datos : null,
    salidas: salidas.ok ? salidas.datos : null,
    enCasa: enCasa.ok ? enCasa.datos : null,
    libres: libres.ok ? libres.datos : null,
    limpieza: limpieza.ok ? limpieza.datos : null,
    bloqueos: bloqueos.ok ? bloqueos.datos : null,
    fuentes: fuentes.ok ? fuentes.datos : [],
    simuladas: listarReservasSimuladas(),
  });

  // Una lectura incompleta no se cachea: así el siguiente "Actualizar" vuelve a
  // pedirla en vez de dejar el hueco pegado dos minutos.
  cache = panel.faltantes.length === 0 ? { clave, ts: Date.now(), panel } : null;
  return panel;
}
