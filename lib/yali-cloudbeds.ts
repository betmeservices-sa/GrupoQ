// El Cloudbeds de cada hotel de Yali, para cotizar con disponibilidad y
// tarifas REALES en vez de las de demostración.
//
// Cada sede es una propiedad distinta en Cloudbeds y tiene su propia llave
// (la de Yalí solo ve a Yalí). Las llaves viven en el entorno, una por sede:
//   a) Yalí            CLOUDBEDS_YALI_API_KEY / CLOUDBEDS_YALI_PROPERTY_ID
//   b) Costa del Surf  CLOUDBEDS_CDS_API_KEY  / CLOUDBEDS_CDS_PROPERTY_ID
//   c) Playa Linda     CLOUDBEDS_PL_API_KEY   / CLOUDBEDS_PL_PROPERTY_ID
// Una sede sin llave sigue cotizando con lib/tenants/yali-inventario.ts
// (tarifas de demostración, con su aviso). Nada más hay que tocar.
//
// Lo que Cloudbeds devuelve: `roomRate` es el TOTAL del rango (no la noche),
// y solo lista los tipos con tarifa activa y libres todas las noches. La
// tarifa por noche se calcula dividiendo. Verificado el 2026-08-27 con la
// propiedad de Yalí (Bungalow: $115 por 1 noche, $240 por 2).

import type { HabitacionYali, SedeYali } from "./tenants/yali-inventario";
import { MONEDA_YALI } from "./tenants/yali-inventario";
import type { OpcionYali } from "./yali-pms";

// Mismo criterio que emparejarHabitacion en yali-agente (que no se importa
// desde acá para no cruzar imports): nombre igual, o uno contenido en el otro.
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, " ").trim();
}
function emparejarHabitacion<T extends { nombre: string }>(candidatas: T[], pedida: string): T | null {
  const p = normalizar(pedida);
  if (!p) return null;
  return (
    candidatas.find((h) => normalizar(h.nombre) === p) ??
    candidatas.find((h) => normalizar(h.nombre).includes(p) && p.length > 2) ??
    candidatas.find((h) => p.includes(normalizar(h.nombre))) ??
    null
  );
}

const BASE = "https://api.cloudbeds.com/api/v1.3";
const ESPERA_MS = 12_000;
const REINTENTOS = 3;

const ENV_POR_SEDE: Record<SedeYali["id"], { key: string; prop: string }> = {
  a: { key: "CLOUDBEDS_YALI_API_KEY", prop: "CLOUDBEDS_YALI_PROPERTY_ID" },
  b: { key: "CLOUDBEDS_CDS_API_KEY", prop: "CLOUDBEDS_CDS_PROPERTY_ID" },
  c: { key: "CLOUDBEDS_PL_API_KEY", prop: "CLOUDBEDS_PL_PROPERTY_ID" },
};

export interface CredencialesSede {
  apiKey: string;
  propertyId: string;
}

/** La llave de una sede, o null si esa sede todavía no dio la suya. */
export function credencialesDeSede(sedeId: SedeYali["id"]): CredencialesSede | null {
  const e = ENV_POR_SEDE[sedeId];
  const apiKey = process.env[e.key];
  const propertyId = process.env[e.prop];
  return apiKey && propertyId ? { apiKey, propertyId } : null;
}

/** ¿Esta sede cotiza con datos reales? */
export function sedeEnVivo(sedeId: SedeYali["id"]): boolean {
  return credencialesDeSede(sedeId) !== null;
}

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Un 429 NO es "no hay nada disponible": se reintenta con espera creciente y,
// si aun así falla, se devuelve error para que arriba se caiga al respaldo.
export async function pedir<T>(
  c: CredencialesSede,
  metodo: string,
  params: Record<string, string | number>,
  opciones: { metodoHttp?: "GET" | "POST" } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  let ultimo = "sin respuesta";
  for (let intento = 0; intento < REINTENTOS; intento++) {
    if (intento > 0) await esperar(400 * 2 ** (intento - 1) + Math.random() * 250);
    try {
      const esPost = opciones.metodoHttp === "POST";
      const res = await fetch(esPost ? `${BASE}/${metodo}` : `${BASE}/${metodo}?${qs}`, {
        method: esPost ? "POST" : "GET",
        headers: {
          "x-api-key": c.apiKey,
          ...(esPost ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body: esPost ? qs : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(ESPERA_MS),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; message?: string };
      if (res.ok && json.success !== false) return { ok: true, data: json.data as T };
      ultimo = json.message ?? `Cloudbeds respondió ${res.status}`;
      if (res.status !== 429 && res.status < 500) return { ok: false, error: ultimo };
    } catch (e) {
      ultimo = e instanceof Error ? e.message : "error de red";
    }
  }
  return { ok: false, error: ultimo };
}

interface TipoDisponibleApi {
  roomTypeID: string;
  roomTypeName: string;
  maxGuests?: number | string;
  roomRateID?: string;
  roomRate?: number | string;
  roomsAvailable?: number | string;
}

export interface DisponibleEnVivo extends OpcionYali {
  /** Ids de Cloudbeds, para tomar la reserva contra el mismo tipo y tarifa. */
  roomTypeId: string;
  roomRateId: string | null;
}

/**
 * Lo que se puede vender en una sede para un rango, según su Cloudbeds.
 *
 * Los tipos de Cloudbeds se emparejan por nombre con los del inventario, así la
 * reserva se guarda con el mismo id estable de siempre y la descripción sale
 * del inventario (la de Cloudbeds es más larga y con formato). Un tipo que no
 * calce con ninguno se ofrece igual, con lo que Cloudbeds diga.
 *
 * null = Cloudbeds no respondió (distinto de "no hay nada libre").
 */
export async function disponibilidadEnVivo(
  sede: SedeYali,
  desde: string,
  hasta: string,
  adultos: number,
  ninos: number,
  noches: number,
): Promise<DisponibleEnVivo[] | null> {
  const c = credencialesDeSede(sede.id);
  if (!c) return null;
  const r = await pedir<Array<{ propertyRooms?: TipoDisponibleApi[] }>>(c, "getAvailableRoomTypes", {
    propertyID: c.propertyId,
    startDate: desde,
    endDate: hasta,
    adults: adultos,
    children: ninos,
    rooms: 1,
  });
  if (!r.ok) {
    console.error(`[yali-cloudbeds] ${sede.nombre} ${desde}→${hasta}:`, r.error);
    return null;
  }
  const tipos = Array.isArray(r.data) ? (r.data[0]?.propertyRooms ?? []) : [];
  const out: DisponibleEnVivo[] = [];
  for (const t of tipos) {
    const libres = Number(t.roomsAvailable) || 0;
    const total = Number(t.roomRate) || 0;
    if (libres <= 0 || total <= 0) continue;
    const propia: HabitacionYali | null = emparejarHabitacion(sede.habitaciones, t.roomTypeName);
    const capacidad = Number(t.maxGuests) || propia?.maxHuespedes || 0;
    if (capacidad && capacidad < adultos + ninos) continue;
    out.push({
      habitacion_id: propia?.id ?? `cb-${t.roomTypeID}`,
      habitacion: propia?.nombre ?? t.roomTypeName,
      descripcion: propia?.descripcion ?? "",
      hasta_huespedes: capacidad,
      libres,
      noches,
      tarifa_por_noche: Math.round((total / noches) * 100) / 100,
      total_estadia: total,
      moneda: MONEDA_YALI,
      roomTypeId: t.roomTypeID,
      roomRateId: t.roomRateID ?? null,
    });
  }
  return out;
}

interface FuenteApi {
  sourceID?: string;
  sourceName?: string;
  isThirdParty?: boolean;
  status?: boolean;
}

const fuenteCache = new Map<string, string>();

/**
 * Con qué "fuente" entra la reserva en Cloudbeds (sourceID, obligatorio).
 *
 * Se prefiere una que diga WhatsApp, Messenger, Instagram, chat o MiAgentIA
 * (si el hotel la creó, así separa lo que trae el panel); si no, la del sitio
 * web; si no, la primera propia y activa. Se puede fijar con
 * CLOUDBEDS_YALI_SOURCE_ID para no adivinar.
 */
async function fuenteDeReservas(c: CredencialesSede): Promise<string | null> {
  const fija = process.env.CLOUDBEDS_YALI_SOURCE_ID;
  if (fija) return fija;
  const enCache = fuenteCache.get(c.propertyId);
  if (enCache) return enCache;
  const r = await pedir<FuenteApi[][] | FuenteApi[]>(c, "getSources", { propertyID: c.propertyId });
  if (!r.ok) {
    console.error("[yali-cloudbeds] getSources:", r.error);
    return null;
  }
  const lista = (Array.isArray(r.data) ? (r.data as unknown[]).flat() : []) as FuenteApi[];
  const propias = lista.filter((f) => f.sourceID && f.status !== false && !f.isThirdParty);
  const preferida =
    propias.find((f) => /whatsapp|messenger|instagram|redes|chat|miagentia/i.test(f.sourceName ?? "")) ??
    propias.find((f) => /website|booking engine|web/i.test(f.sourceName ?? "")) ??
    propias[0];
  if (!preferida?.sourceID) return null;
  fuenteCache.set(c.propertyId, preferida.sourceID);
  return preferida.sourceID;
}

export interface ReservaEnVivoInput {
  sede: SedeYali;
  roomTypeId: string;
  roomRateId: string | null;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  nombre: string;
  correo: string;
  telefono?: string;
  notas?: string;
}

/**
 * Dejar la reserva tomada en Cloudbeds. Solo cuando CLOUDBEDS_YALI_ESCRIBIR
 * está en "on": mientras no se pruebe con una reserva de verdad (que sincroniza
 * al channel manager), se queda en el registro del panel.
 */
export function escrituraHabilitada(): boolean {
  return (process.env.CLOUDBEDS_YALI_ESCRIBIR ?? "").toLowerCase() === "on";
}

export async function reservarEnVivo(
  i: ReservaEnVivoInput,
): Promise<{ ok: true; reservationId: string; status: string } | { ok: false; error: string }> {
  const c = credencialesDeSede(i.sede.id);
  if (!c) return { ok: false, error: "Esta sede no tiene Cloudbeds conectado." };
  const [nombre, ...resto] = i.nombre.trim().split(/\s+/);
  const apellido = resto.join(" ") || nombre;
  const fuente = await fuenteDeReservas(c);
  if (!fuente) return { ok: false, error: "Cloudbeds no devolvió una fuente de reservas (sourceID)." };
  // Documentado en developers.cloudbeds.com/reference/post_postreservation-2:
  // form-urlencoded; propertyID, fechas, nombre, apellido, correo, país (ISO2),
  // código postal, sourceID ("s-<id>") y paymentMethod son obligatorios.
  const params: Record<string, string | number> = {
    propertyID: c.propertyId,
    startDate: i.desde,
    endDate: i.hasta,
    guestFirstName: nombre,
    guestLastName: apellido,
    guestEmail: i.correo,
    guestCountry: "SV",
    // Cloudbeds lo exige aunque en El Salvador no se use: el postal de San Salvador.
    guestZip: "01101",
    sourceID: fuente,
    // Un tipo, una habitación, con la tarifa que se cotizó.
    "rooms[0][roomTypeID]": i.roomTypeId,
    "rooms[0][quantity]": 1,
    "adults[0][roomTypeID]": i.roomTypeId,
    "adults[0][quantity]": i.adultos,
    "children[0][roomTypeID]": i.roomTypeId,
    "children[0][quantity]": i.ninos,
    // El huésped paga por transferencia o enlace antes de que se tome (regla
    // del guion); en Cloudbeds queda como transferencia bancaria.
    paymentMethod: "ebanking",
    sendEmailConfirmation: "true",
  };
  if (i.roomRateId) params["rooms[0][roomRateID]"] = i.roomRateId;
  if (i.telefono) params.guestPhone = i.telefono;
  if (i.notas) {
    params["customFields[0][fieldName]"] = "Notas";
    params["customFields[0][fieldValue]"] = i.notas;
  }
  const r = await pedir<{ reservationID?: string; status?: string }>(c, "postReservation", params, { metodoHttp: "POST" });
  if (!r.ok) return { ok: false, error: r.error };
  const id = r.data?.reservationID;
  if (!id) return { ok: false, error: "Cloudbeds no devolvió el número de reserva." };
  return { ok: true, reservationId: id, status: r.data?.status ?? "confirmed" };
}
