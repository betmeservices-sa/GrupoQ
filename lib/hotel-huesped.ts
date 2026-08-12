// Ficha del huésped: lo que el sistema del hotel sabe de la persona que está
// escribiendo por WhatsApp. SOLO LECTURA (ver la frontera en lib/cloudbeds.ts).
//
// El emparejamiento es la parte delicada. Un contacto de WhatsApp y una ficha
// del PMS son dos mundos: se unen por teléfono y por correo. Cuando solo
// coincide el nombre NO se afirma que sea la misma persona, se dice que coincide
// el nombre y se deja que lo lea recepción.
//
// Nada de lo que falle se traduce a "no tiene": si una lectura no responde, se
// devuelve el aviso y la pantalla lo dice.

import {
  buscarEstadias,
  enTandas,
  hoyEnZona,
  listarFuentes,
  listarHuespedes,
  noches,
  notasDeHuesped,
  notasDeReserva,
  type EstadiaPms,
  type FuentePms,
  type HuespedPms,
  type NotaPms,
} from "./cloudbeds";

export const ZONA_HOTEL = "America/Guatemala";

// ── Normalización para emparejar ──

/**
 * Clave de teléfono: los últimos 8 dígitos. Sirve para El Salvador y Guatemala
 * por igual (ambos usan 8 dígitos locales) y hace que "+502 5788 1234",
 * "50257881234" y "5788-1234" sean el mismo número, como ya hace lib/phone.ts
 * para el formato salvadoreño.
 *
 * Menos de 8 dígitos devuelve "": un número corto emparejaría con cualquiera.
 */
export function claveTelefono(valor: string | undefined | null): string {
  const d = String(valor ?? "").replace(/\D/g, "");
  if (d.length < 8) return "";
  return d.slice(-8);
}

export function claveCorreo(valor: string | undefined | null): string {
  const v = String(valor ?? "").trim().toLowerCase();
  return v.includes("@") ? v : "";
}

export function claveNombre(valor: string | undefined | null): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tildes fuera: "González" empareja con "Gonzalez"
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type Vinculo = "telefono" | "correo" | "nombre";

export interface Coincidencia {
  huesped: HuespedPms;
  vinculo: Vinculo;
}

/**
 * Empareja un contacto con una ficha del padrón. Prioridad: teléfono, correo y
 * recién al final el nombre completo (que se marca aparte porque no identifica).
 * El nombre exige coincidencia COMPLETA: "Karen" no empareja con "Karen López".
 */
export function emparejarHuesped(
  contacto: { telefono?: string; correo?: string; nombre?: string },
  padron: HuespedPms[],
): Coincidencia | null {
  const tel = claveTelefono(contacto.telefono);
  const correo = claveCorreo(contacto.correo);
  const nombre = claveNombre(contacto.nombre);

  const porTelefono = tel
    ? padron.find((h) => claveTelefono(h.telefono) === tel || claveTelefono(h.celular) === tel)
    : undefined;
  if (porTelefono) return { huesped: porTelefono, vinculo: "telefono" };

  const porCorreo = correo ? padron.find((h) => claveCorreo(h.correo) === correo) : undefined;
  if (porCorreo) return { huesped: porCorreo, vinculo: "correo" };

  // Un nombre de una sola palabra es demasiado común para siquiera sugerirlo.
  if (nombre && nombre.includes(" ")) {
    const porNombre = padron.find((h) => claveNombre(h.nombreCompleto) === nombre);
    if (porNombre) return { huesped: porNombre, vinculo: "nombre" };
  }
  return null;
}

// ── Estadías ──

export type Momento = "pasada" | "en_casa" | "futura";

const ESTADOS: Record<string, string> = {
  confirmed: "Confirmada",
  not_confirmed: "Sin confirmar",
  canceled: "Cancelada",
  checked_in: "En casa",
  checked_out: "Salida registrada",
  no_show: "No se presentó",
};

export function estadoLegible(estado: string): string {
  return ESTADOS[estado] ?? estado;
}

// El momento sale de las fechas, nunca del estado: una reserva puede quedar
// "confirmada" para siempre porque nadie registró la entrada, y eso no la
// convierte en una estadía en curso.
export function momentoDe(desde: string, hasta: string, hoy: string): Momento {
  if (hasta <= hoy) return "pasada";
  if (desde > hoy) return "futura";
  return "en_casa";
}

export interface EstadiaFicha {
  id: string;
  estado: string;
  estadoCrudo: string;
  momento: Momento;
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
  // null = no se pudo consultar las notas de esa reserva (distinto de vacío).
  notas: NotaPms[] | null;
}

export function armarEstadiaFicha(
  e: EstadiaPms,
  hoy: string,
  fuentes: FuentePms[],
  notas: NotaPms[] | null,
): EstadiaFicha {
  const f = fuentes.find((x) => x.id === e.fuenteId || x.nombre === e.fuente);
  return {
    id: e.id,
    estado: estadoLegible(e.estado),
    estadoCrudo: e.estado,
    momento: momentoDe(e.desde, e.hasta, hoy),
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
    notas,
  };
}

// Primero la que está en casa, después las que vienen, y al final el historial.
const ORDEN: Record<Momento, number> = { en_casa: 0, futura: 1, pasada: 2 };

export function ordenarEstadias(lista: EstadiaFicha[]): EstadiaFicha[] {
  return [...lista].sort((a, b) => {
    if (ORDEN[a.momento] !== ORDEN[b.momento]) return ORDEN[a.momento] - ORDEN[b.momento];
    return a.momento === "pasada" ? b.desde.localeCompare(a.desde) : a.desde.localeCompare(b.desde);
  });
}

export interface FichaHuesped {
  vinculo: Vinculo;
  huesped: HuespedPms;
  estadias: EstadiaFicha[];
  // null = no se pudieron consultar las notas del huésped.
  notas: NotaPms[] | null;
  saldoTotal: number;
  hoy: string;
  avisos: string[];
  consultado: string;
}

export type RespuestaFicha =
  | { estado: "match"; ficha: FichaHuesped }
  | { estado: "sin_match"; padron: number; completo: boolean }
  | { estado: "error"; error: string };

// ── Padrón cacheado ──
// Reconocer a quien escribe no puede costar un barrido del sistema por cada
// contacto que se abre.

const TTL_PADRON_MS = 3 * 60 * 1000;
let cachePadron: { ts: number; huespedes: HuespedPms[]; completo: boolean } | null = null;

export function olvidarPadron(): void {
  cachePadron = null;
}

async function padron(): Promise<
  { ok: true; huespedes: HuespedPms[]; completo: boolean } | { ok: false; error: string }
> {
  if (cachePadron && Date.now() - cachePadron.ts < TTL_PADRON_MS) {
    return { ok: true, huespedes: cachePadron.huespedes, completo: cachePadron.completo };
  }
  const r = await listarHuespedes();
  if (!r.ok) return { ok: false, error: r.error };
  // Una misma persona aparece una vez por reserva: se queda una sola ficha.
  const unicos = new Map<string, HuespedPms>();
  for (const h of r.datos.huespedes) {
    if (!h.id) continue;
    const previo = unicos.get(h.id);
    // Gana la fila con más datos de contacto cargados.
    if (!previo || (!previo.telefono && h.telefono) || (!previo.correo && h.correo)) {
      unicos.set(h.id, h);
    }
  }
  const huespedes = [...unicos.values()];
  cachePadron = { ts: Date.now(), huespedes, completo: r.datos.completo };
  return { ok: true, huespedes, completo: r.datos.completo };
}

// Tope de reservas a las que se les piden notas: recepción mira las últimas, y
// cada una es una consulta más al sistema.
const TOPE_ESTADIAS = 6;

export async function cargarFichaHuesped(contacto: {
  telefono?: string;
  correo?: string;
  nombre?: string;
}): Promise<RespuestaFicha> {
  const p = await padron();
  if (!p.ok) return { estado: "error", error: p.error };

  const match = emparejarHuesped(contacto, p.huespedes);
  if (!match) return { estado: "sin_match", padron: p.huespedes.length, completo: p.completo };

  const hoy = hoyEnZona(ZONA_HOTEL);
  const avisos: string[] = [];

  const [reservas, notas, fuentes] = await Promise.all([
    buscarEstadias({ guestId: match.huesped.id, limite: 25 }),
    notasDeHuesped(match.huesped.id),
    listarFuentes(),
  ]);

  if (!reservas.ok) avisos.push("No se pudieron consultar las estadías.");
  if (!notas.ok) avisos.push("No se pudieron consultar las notas del huésped.");
  if (!fuentes.ok) avisos.push("No se pudo consultar por qué canal reservó.");

  const crudas = reservas.ok ? reservas.datos : [];
  const conNotas = crudas.slice(0, TOPE_ESTADIAS);
  const notasPorReserva = await enTandas(
    conNotas.map((e) => () => notasDeReserva(e.id)),
    3,
  );
  if (notasPorReserva.some((n) => !n.ok)) {
    avisos.push("Algunas notas de reserva no se pudieron consultar.");
  }

  const estadias = ordenarEstadias(
    crudas.map((e, i) => {
      const n = i < conNotas.length ? notasPorReserva[i] : null;
      return armarEstadiaFicha(
        e,
        hoy,
        fuentes.ok ? fuentes.datos : [],
        n ? (n.ok ? n.datos : null) : null,
      );
    }),
  );

  return {
    estado: "match",
    ficha: {
      vinculo: match.vinculo,
      huesped: match.huesped,
      estadias,
      notas: notas.ok ? notas.datos : null,
      saldoTotal: estadias.reduce((s, e) => s + (e.saldo > 0 ? e.saldo : 0), 0),
      hoy,
      avisos,
      consultado: new Date().toISOString(),
    },
  };
}
