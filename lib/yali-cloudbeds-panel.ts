// El panel de Yali con las cifras del Cloudbeds de cada hotel.
//
// Cada sede tiene su propia llave (Cloudbeds da una por propiedad), así que se
// lee hotel por hotel y se junta todo en el mismo libro que ya entiende
// construirPanelYali: la vista general suma las tres y cada pestaña muestra la
// suya. Una sede sin llave sigue con su libro de demostración, marcada como
// tal, para que el panel nunca quede a medias.
//
// Cloudbeds no da las habitaciones en la lista de reservas (getReservations
// solo trae fechas, huésped y estado), así que el detalle se pide una por una
// y se guarda en memoria por reserva y fecha de modificación: la segunda
// carga solo baja lo que cambió. getReservationsWithRateDetails traería todo
// de un golpe, pero ignora los filtros de fecha y devuelve el histórico
// completo (2 861 reservas en Yalí), que es peor.

import { SEDES_YALI, type HabitacionYali, type SedeYali } from "./tenants/yali-inventario";
import { credencialesDeSede, pedir, type CredencialesSede } from "./yali-cloudbeds";
import {
  cargarLibro,
  construirPanelYali,
  hoyYali,
  libroDeSede,
  type CanalReserva,
  type PanelYali,
  type ReservaYali,
} from "./yali-pms";
import { listarReservasYali } from "./yali-reservas";
import { listarPreReservas } from "./yali-prereservas";
import { sumarDias } from "./cloudbeds";

// ─────────────────────────── formas de Cloudbeds ───────────────────────────

interface TipoApi {
  roomTypeID: string;
  roomTypeName: string;
  maxGuests?: number | string;
  roomTypeUnits?: number | string;
  roomTypeDescription?: string;
}

interface ReservaListaApi {
  reservationID: string;
  status: string;
  guestName?: string;
  startDate: string;
  endDate: string;
  dateModified?: string;
}

interface HabitacionReservaApi {
  roomTypeID: string;
  roomTypeName: string;
  startDate: string;
  endDate: string;
  adults?: number | string;
  children?: number | string;
  roomTotal?: number | string;
  dailyRates?: { date: string; rate: number | string }[];
}

export interface DetalleReservaApi {
  reservationID: string;
  status: string;
  guestName?: string;
  sourceName?: string;
  source?: string | { name?: string };
  total?: number | string;
  assigned?: HabitacionReservaApi[];
  unassigned?: HabitacionReservaApi[];
}

// Cancelada y no-show no ocupan ni facturan; lo demás (sin confirmar,
// confirmada, en casa, ya salió) sí cuenta como noche vendida.
const ESTADOS_VIVOS = new Set(["not_confirmed", "confirmed", "checked_in", "checked_out"]);

/** El canal del panel a partir del nombre de la fuente en Cloudbeds. */
export function canalDeFuente(fuente: string | null | undefined): CanalReserva {
  const f = (fuente ?? "").toLowerCase();
  if (/booking/.test(f) && !/engine/.test(f)) return "Booking";
  if (/expedia|hotels\.com/.test(f)) return "Expedia";
  if (/airbnb/.test(f)) return "Airbnb";
  if (/whats|messenger|miagentia|chat/.test(f)) return "WhatsApp";
  if (/instagram|facebook|redes|social/.test(f)) return "Redes";
  if (/website|web|engine|online/.test(f)) return "Web";
  return "Directo";
}

function num(v: number | string | undefined, base = 0): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : base;
}

function nombreDeFuente(d: DetalleReservaApi): string {
  if (d.sourceName) return d.sourceName;
  return typeof d.source === "string" ? d.source : (d.source?.name ?? "");
}

function dias(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);
}

/**
 * Las filas del libro que salen de una reserva de Cloudbeds: una por
 * habitación (una reserva puede traer varias). Pura, para probarla sin red.
 */
export function reservasDeDetalle(
  d: DetalleReservaApi,
  sede: Pick<SedeYali, "id" | "nombre">,
): ReservaYali[] {
  if (!ESTADOS_VIVOS.has(d.status)) return [];
  const habitaciones = [...(d.assigned ?? []), ...(d.unassigned ?? [])].filter(
    (h) => h.startDate && h.endDate && h.endDate > h.startDate,
  );
  const canal = canalDeFuente(nombreDeFuente(d));
  return habitaciones.map((h, i) => {
    const porTarifas = (h.dailyRates ?? []).reduce((s, r) => s + num(r.rate), 0);
    const total = num(h.roomTotal, -1);
    return {
      id: habitaciones.length === 1 ? d.reservationID : `${d.reservationID}-${i + 1}`,
      sedeId: sede.id,
      sedeNombre: sede.nombre,
      habitacionId: h.roomTypeID,
      habitacionNombre: h.roomTypeName,
      huesped: (d.guestName ?? "").trim() || "Huésped",
      desde: h.startDate,
      hasta: h.endDate,
      huespedes: num(h.adults) + num(h.children),
      total: total >= 0 ? total : porTarifas || (habitaciones.length === 1 ? num(d.total) : 0),
      canal,
      origen: "pms" as const,
    };
  });
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[\s-]+/g, " ")
    .trim();
}

/**
 * La sede con las habitaciones de Cloudbeds (ids, nombres y unidades reales).
 * La tarifa mostrada es lo que de verdad se cobró por noche en la ventana; si
 * nadie durmió en ese tipo, la del inventario cuando el nombre calza.
 */
export function sedeConTiposDeCloudbeds(sede: SedeYali, tipos: TipoApi[], libro: ReservaYali[]): SedeYali {
  const habitaciones: HabitacionYali[] = tipos.map((t) => {
    const n = normalizar(t.roomTypeName);
    const propia =
      sede.habitaciones.find((h) => normalizar(h.nombre) === n) ??
      sede.habitaciones.find((h) => n.includes(normalizar(h.nombre))) ??
      null;
    const cobradas = libro.filter((r) => r.habitacionId === t.roomTypeID);
    const noches = cobradas.reduce((s, r) => s + Math.max(1, dias(r.desde, r.hasta)), 0);
    const tarifaVista = noches === 0 ? 0 : Math.round(cobradas.reduce((s, r) => s + r.total, 0) / noches);
    return {
      id: t.roomTypeID,
      nombre: t.roomTypeName,
      descripcion: propia?.descripcion ?? (t.roomTypeDescription ?? "").replace(/<[^>]+>/g, "").trim(),
      maxHuespedes: num(t.maxGuests, propia?.maxHuespedes ?? 2),
      unidades: num(t.roomTypeUnits, propia?.unidades ?? 1),
      tarifaDemo: tarifaVista || propia?.tarifaDemo || 0,
    };
  });
  return { ...sede, tarifasConfirmadas: true, habitaciones };
}

// ─────────────────────────── lectura con memoria ───────────────────────────

// Detalle por reserva, con la fecha de modificación como llave: si Cloudbeds
// dice que no cambió, no se vuelve a pedir.
const DETALLES = new Map<string, { mod: string; detalle: DetalleReservaApi }>();
// El libro de cada sede vale dos minutos; y si Cloudbeds falla se sigue
// mostrando el último bueno antes que dejar la sede en blanco.
const LIBROS = new Map<string, { vence: number; valor: LibroEnVivo }>();
const VIDA_MS = 2 * 60 * 1000;
const PAGINA = 100;
const PAGINAS_MAX = 6;
const PARALELO = 3;

export interface LibroEnVivo {
  sede: SedeYali;
  libro: ReservaYali[];
}

async function detalleDe(c: CredencialesSede, r: ReservaListaApi): Promise<DetalleReservaApi | null> {
  const llave = `${c.propertyId}:${r.reservationID}`;
  const mod = r.dateModified ?? "";
  const guardado = DETALLES.get(llave);
  if (guardado && guardado.mod === mod) return guardado.detalle;
  const res = await pedir<DetalleReservaApi>(c, "getReservation", {
    propertyID: c.propertyId,
    reservationID: r.reservationID,
  });
  if (!res.ok) return guardado?.detalle ?? null;
  DETALLES.set(llave, { mod, detalle: res.data });
  return res.data;
}

async function listarReservas(
  c: CredencialesSede,
  desde: string,
  hasta: string,
): Promise<ReservaListaApi[] | null> {
  const todas: ReservaListaApi[] = [];
  for (let pagina = 1; pagina <= PAGINAS_MAX; pagina++) {
    const res = await pedir<ReservaListaApi[]>(c, "getReservations", {
      propertyID: c.propertyId,
      // Entradas desde 60 días antes: una estadía larga que empezó antes de la
      // ventana igual la toca. Lo que ya salió antes de `desde` se descarta abajo.
      checkInFrom: sumarDias(desde, -60),
      checkInTo: hasta,
      pageSize: PAGINA,
      pageNumber: pagina,
    });
    if (!res.ok) return null;
    const fila = res.data ?? [];
    todas.push(...fila);
    if (fila.length < PAGINA) break;
  }
  return todas.filter((r) => ESTADOS_VIVOS.has(r.status) && r.endDate >= desde);
}

/**
 * El libro real de una sede para la ventana [desde, hasta), o null si la sede
 * no tiene llave o Cloudbeds no respondió y no había nada guardado.
 */
export async function libroEnVivo(sede: SedeYali, desde: string, hasta: string): Promise<LibroEnVivo | null> {
  const c = credencialesDeSede(sede.id);
  if (!c) return null;
  const llave = `${sede.id}:${desde}:${hasta}`;
  const guardado = LIBROS.get(llave);
  if (guardado && guardado.vence > Date.now()) return guardado.valor;

  const [tipos, lista] = await Promise.all([
    pedir<TipoApi[]>(c, "getRoomTypes", { propertyID: c.propertyId }),
    listarReservas(c, desde, hasta),
  ]);
  if (!tipos.ok || lista === null) {
    console.error(`[yali-cloudbeds] panel ${sede.nombre}:`, !tipos.ok ? tipos.error : "sin lista de reservas");
    return guardado?.valor ?? null;
  }

  const libro: ReservaYali[] = [];
  // De a tres para no pasarse del ritmo que Cloudbeds tolera.
  for (let i = 0; i < lista.length; i += PARALELO) {
    const detalles = await Promise.all(lista.slice(i, i + PARALELO).map((r) => detalleDe(c, r)));
    for (const d of detalles) if (d) libro.push(...reservasDeDetalle(d, sede));
  }
  const valor = { sede: sedeConTiposDeCloudbeds(sede, tipos.data ?? [], libro), libro };
  LIBROS.set(llave, { vence: Date.now() + VIDA_MS, valor });
  return valor;
}

/**
 * El panel que consume el dashboard: Cloudbeds para cada sede con llave, el
 * libro de demostración para las demás, y encima las reservas que Sofía dejó
 * en el panel (las que no entraron a Cloudbeds).
 */
export async function cargarPanelYaliVivo(dias = 14): Promise<PanelYali> {
  const hoy = hoyYali();
  const desde = sumarDias(hoy, -3);
  const hasta = sumarDias(hoy, dias);
  const ahora = new Date().toISOString();
  const vivos = await Promise.all(SEDES_YALI.map((s) => libroEnVivo(s, desde, hasta)));
  if (vivos.every((v) => v === null)) {
    return construirPanelYali({ sedes: SEDES_YALI, libro: cargarLibro(desde, dias + 3), hoy, dias, ahora });
  }
  const sedes: SedeYali[] = [];
  const libro: ReservaYali[] = [];
  const enVivo: SedeYali["id"][] = [];
  SEDES_YALI.forEach((s, i) => {
    const v = vivos[i];
    if (v) {
      sedes.push(v.sede);
      libro.push(...v.libro);
      enVivo.push(s.id);
    } else {
      sedes.push(s);
      libro.push(...libroDeSede(s, desde, dias + 3));
    }
  });
  for (const r of listarReservasYali()) {
    libro.push({
      id: r.id,
      sedeId: r.sedeId,
      sedeNombre: r.sedeNombre,
      habitacionId: r.habitacionId,
      habitacionNombre: r.habitacionNombre,
      huesped: r.huesped,
      desde: r.desde,
      hasta: r.hasta,
      huespedes: r.adultos + r.ninos,
      total: r.total,
      canal: "WhatsApp",
      origen: "agente",
    });
  }
  // Las que Verónica confirmó pero todavía no están en Cloudbeds (escritura
  // apagada): se pintan igual, para que el panel no las pierda.
  const confirmadas = await listarPreReservas("yaly").catch(() => []);
  for (const p of confirmadas) {
    if (p.estado !== "confirmada" || p.reservaCloudbeds) continue;
    libro.push({
      id: p.id,
      sedeId: p.sedeId,
      sedeNombre: p.sedeNombre,
      habitacionId: p.habitacionId,
      habitacionNombre: p.habitacionNombre,
      huesped: p.huesped,
      desde: p.desde,
      hasta: p.hasta,
      huespedes: p.adultos + p.ninos,
      total: p.total,
      canal: "WhatsApp",
      origen: "agente",
    });
  }
  return construirPanelYali({ sedes, libro, hoy, dias, ahora, enVivo });
}
