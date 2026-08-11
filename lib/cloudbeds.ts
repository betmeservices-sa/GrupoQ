// Lectura del PMS del hotel (Cloudbeds API v1.3). SOLO SERVIDOR.
//
// ── FRONTERA DE ESCRITURA (no negociable) ──
// Este módulo es de SOLO LECTURA. Cloudbeds trae channel manager integrado, así
// que una reserva creada por API se sincroniza sola a Booking y Expedia: una
// llamada de escritura desde un demo bloquearía inventario real del hotel y le
// costaría dinero al prospecto. Por eso:
//   1. PMS_WRITE_ENABLED está en false y no hay forma de encenderlo por env;
//   2. la lista METODOS es blanca y solo tiene endpoints get*;
//   3. `pms()` fuerza method GET, nunca acepta body.
// Las "reservas" que confirma el agente de IA en el demo se guardan en
// lib/hotel-reservas.ts (memoria del demo) y NUNCA tocan Cloudbeds.
//
// La API key va en la variable CLOUDBEDS_API_KEY (header x-api-key) y NO puede
// llevar prefijo NEXT_PUBLIC_: eso la metería en el bundle del navegador.
// OJO: la key caduca si pasan 30 días sin usarla.

export const PMS_WRITE_ENABLED = false;

const BASE = "https://api.cloudbeds.com/api/v1.3";

// Lista blanca de endpoints. Todos son GET de lectura; agregar uno de escritura
// aquí sería violar la frontera de arriba.
const METODOS = ["getHotels", "getRooms", "getReservations", "getAvailableRoomTypes"] as const;
type Metodo = (typeof METODOS)[number];

export interface CredencialesPms {
  apiKey: string;
  propertyId: string;
}

export function credencialesPms(): CredencialesPms | null {
  const apiKey = process.env.CLOUDBEDS_API_KEY;
  const propertyId = process.env.CLOUDBEDS_PROPERTY_ID;
  if (!apiKey || !propertyId) return null;
  return { apiKey, propertyId };
}

export function hayPms(): boolean {
  return credencialesPms() !== null;
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Cloudbeds corta con 429 cuando llegan varias consultas juntas. Un 429 NO es
// "no hay nada disponible": si se confundieran, el panel inventaría ocupación
// que no existe. Por eso se reintenta con espera creciente y, si aun así falla,
// se devuelve error para que arriba se marque como dato faltante.
const REINTENTOS = 3;

async function pms<T>(
  metodo: Metodo,
  params: Record<string, string | number>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!METODOS.includes(metodo)) {
    return { ok: false, error: `Endpoint no permitido: ${metodo}` };
  }
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar (falta CLOUDBEDS_API_KEY)" };

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));

  let ultimo = "sin respuesta";
  for (let intento = 0; intento < REINTENTOS; intento++) {
    if (intento > 0) await esperar(400 * 2 ** (intento - 1) + Math.random() * 250);
    try {
      const res = await fetch(`${BASE}/${metodo}?${qs}`, {
        method: "GET", // fijo: este módulo no escribe
        headers: { "x-api-key": c.apiKey },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: T;
        message?: string;
      };
      if (res.ok && json.success !== false) return { ok: true, data: json.data as T };

      ultimo = json.message ?? `Cloudbeds respondió ${res.status}`;
      // Solo tiene sentido reintentar el límite de consultas y los errores del
      // otro lado; una credencial mala no mejora esperando.
      if (res.status !== 429 && res.status < 500) return { ok: false, error: ultimo };
    } catch (e) {
      ultimo = e instanceof Error ? e.message : "error de red";
    }
  }
  return { ok: false, error: ultimo };
}

// Ejecuta tareas de a poco para no chocar con el límite de consultas.
export async function enTandas<T>(
  tareas: Array<() => Promise<T>>,
  tamano = 4,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < tareas.length; i += tamano) {
    out.push(...(await Promise.all(tareas.slice(i, i + tamano).map((t) => t()))));
  }
  return out;
}

// ── Modelos ──

export interface PropiedadPms {
  id: string;
  nombre: string;
  moneda: string;
  simbolo: string;
  zonaHoraria: string;
}

export interface TipoHabitacion {
  id: string;
  nombre: string;
  corto: string;
  maxHuespedes: number;
  unidades: number;
}

export interface TipoDisponible {
  id: string;
  tarifa: number; // total del rango consultado, en la moneda de la propiedad
  disponibles: number;
}

export interface NochePms {
  fecha: string; // AAAA-MM-DD
  // null = el sistema no respondió esa noche. NO es lo mismo que "sin nada
  // libre": nunca se cuenta como ocupación.
  tipos: TipoDisponible[] | null;
}

export interface ReservaPms {
  id: string;
  huesped: string;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  estado: string;
  saldo: number;
  fuente: string;
  creada: string;
}

// ── Endpoints ──

export async function obtenerPropiedad(): Promise<PropiedadPms | null> {
  const r = await pms<
    Array<{
      propertyID: string;
      propertyName: string;
      propertyTimezone: string;
      propertyCurrency?: { currencyCode?: string; currencySymbol?: string };
    }>
  >("getHotels", {});
  if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) return null;
  const h = r.data[0];
  return {
    id: h.propertyID,
    nombre: h.propertyName,
    moneda: h.propertyCurrency?.currencyCode ?? "USD",
    simbolo: h.propertyCurrency?.currencySymbol ?? "$",
    zonaHoraria: h.propertyTimezone,
  };
}

// Todas las habitaciones cargadas en el PMS, agrupadas por tipo. Incluye las que
// no tienen tarifa (esas nunca las devuelve el endpoint de disponibilidad).
export async function listarTiposHabitacion(): Promise<TipoHabitacion[]> {
  const c = credencialesPms();
  if (!c) return [];
  const r = await pms<
    Array<{
      rooms: Array<{
        roomTypeID: string;
        roomTypeName: string;
        roomTypeNameShort: string;
        maxGuests: number;
      }>;
    }>
  >("getRooms", { propertyID: c.propertyId });
  if (!r.ok || !Array.isArray(r.data)) return [];

  const mapa = new Map<string, TipoHabitacion>();
  for (const prop of r.data) {
    for (const room of prop.rooms ?? []) {
      const t = mapa.get(room.roomTypeID);
      if (t) t.unidades += 1;
      else
        mapa.set(room.roomTypeID, {
          id: room.roomTypeID,
          nombre: room.roomTypeName,
          corto: room.roomTypeNameShort,
          maxHuespedes: Number(room.maxGuests) || 0,
          unidades: 1,
        });
    }
  }
  return [...mapa.values()];
}

interface RoomTypeApi {
  roomTypeID: string;
  roomRate?: number | string;
  roomsAvailable?: number | string;
}

// Disponibilidad de UN rango. Cloudbeds devuelve solo los tipos con tarifa
// activa y sin ocupar en TODO el rango; `roomRate` es el total del rango.
// Devuelve null si el sistema no respondió (distinto de "no hay nada libre").
export async function disponibilidadRango(opts: {
  desde: string;
  hasta: string;
  adultos?: number;
  ninos?: number;
  habitaciones?: number;
}): Promise<TipoDisponible[] | null> {
  const c = credencialesPms();
  if (!c) return null;
  const r = await pms<
    Array<{ propertyRooms?: RoomTypeApi[] }>
  >("getAvailableRoomTypes", {
    propertyIDs: c.propertyId,
    startDate: opts.desde,
    endDate: opts.hasta,
    adults: opts.adultos ?? 1,
    children: opts.ninos ?? 0,
    rooms: opts.habitaciones ?? 1,
  });
  if (!r.ok) {
    console.error(`cloudbeds disponibilidad ${opts.desde}:`, r.error);
    return null;
  }
  if (!Array.isArray(r.data)) return null;
  return (r.data[0]?.propertyRooms ?? []).map((t) => ({
    id: t.roomTypeID,
    tarifa: Number(t.roomRate) || 0,
    disponibles: Number(t.roomsAvailable) || 0,
  }));
}

export async function listarReservas(limite = 50): Promise<ReservaPms[]> {
  const c = credencialesPms();
  if (!c) return [];
  const r = await pms<
    Array<{
      reservationID: string;
      guestName: string;
      startDate: string;
      endDate: string;
      adults: string | number;
      children: string | number;
      status: string;
      balance: number;
      sourceName: string;
      dateCreated: string;
    }>
  >("getReservations", { propertyID: c.propertyId, pageNumber: 1, pageSize: limite });
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data.map((x) => ({
    id: x.reservationID,
    huesped: x.guestName,
    desde: x.startDate,
    hasta: x.endDate,
    adultos: Number(x.adults) || 0,
    ninos: Number(x.children) || 0,
    estado: x.status,
    saldo: Number(x.balance) || 0,
    fuente: x.sourceName,
    creada: x.dateCreated,
  }));
}

// ── Fechas en la zona horaria de la propiedad ──
// El servidor puede correr en cualquier huso; "hoy" tiene que ser el del hotel.

export function hoyEnZona(zona: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

export function noches(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400000));
}
