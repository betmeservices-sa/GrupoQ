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
// aquí sería violar la frontera de arriba. Un test recorre esta lista y falla si
// alguna entrada no empieza con "get".
export const METODOS = [
  "getHotels",
  "getHotelDetails",
  "getRooms",
  "getReservations",
  "getReservation",
  "getAvailableRoomTypes",
  "getGuestList",
  "getGuestNotes",
  "getReservationNotes",
  "getGuestsByStatus",
  "getRoomsUnassigned",
  "getHousekeepingStatus",
  "getRoomBlocks",
  "getSources",
  "getPaymentMethods",
] as const;
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

// ── Lecturas de operación (ficha del huésped y día de recepción) ──
//
// Estas devuelven `Lectura<T>`: o trae datos, o dice por qué no pudo. Nunca se
// traduce un fallo a lista vacía, porque en recepción "no hay salidas hoy" y
// "no se pudo consultar" llevan a decisiones opuestas.

export type Lectura<T> = { ok: true; datos: T } | { ok: false; error: string };

// El PMS devuelve "N/A", "-" y fechas cero para campos vacíos. Se limpian aquí
// para que la pantalla no muestre relleno del sistema como si fuera un dato.
export function limpio(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s === "N/A" || s === "-" || s === "0000-00-00" || s === "-0001-11-30") return "";
  return s;
}

export interface DireccionPropiedad {
  pais: string; // ISO 2 letras, ej. GT
  zip: string;
  ciudad: string;
  estado: string;
  linea1: string;
}

export interface DetallePropiedad extends PropiedadPms {
  tipo: string;
  telefono: string;
  correo: string;
  direccion: DireccionPropiedad;
  checkIn: string;
  checkOut: string;
  urlReservas: string;
}

interface HotelDetailsApi {
  propertyID: string;
  propertyName: string;
  propertyType?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  propertyCurrency?: { currencyCode?: string; currencySymbol?: string };
  propertyAddress?: {
    propertyAddress1?: string;
    propertyCity?: string;
    propertyState?: string;
    propertyZip?: string;
    propertyCountry?: string;
  };
  propertyPolicy?: { propertyCheckInTime?: string; propertyCheckOutTime?: string };
  propertyBookingUrl?: string;
}

// Puro, para poder probarlo sin red.
export function armarDetallePropiedad(d: HotelDetailsApi, zonaHoraria: string): DetallePropiedad {
  const a = d.propertyAddress ?? {};
  return {
    id: d.propertyID,
    nombre: d.propertyName,
    moneda: d.propertyCurrency?.currencyCode ?? "USD",
    simbolo: d.propertyCurrency?.currencySymbol ?? "$",
    zonaHoraria,
    tipo: limpio(d.propertyType),
    telefono: limpio(d.propertyPhone),
    correo: limpio(d.propertyEmail),
    direccion: {
      pais: limpio(a.propertyCountry).toUpperCase(),
      zip: limpio(a.propertyZip),
      ciudad: limpio(a.propertyCity),
      estado: limpio(a.propertyState),
      linea1: limpio(a.propertyAddress1),
    },
    checkIn: limpio(d.propertyPolicy?.propertyCheckInTime),
    checkOut: limpio(d.propertyPolicy?.propertyCheckOutTime),
    urlReservas: limpio(d.propertyBookingUrl),
  };
}

export async function detallePropiedad(): Promise<Lectura<DetallePropiedad>> {
  const r = await pms<HotelDetailsApi>("getHotelDetails", {});
  if (!r.ok) return { ok: false, error: r.error };
  if (!r.data?.propertyID) return { ok: false, error: "La propiedad no devolvió sus datos" };
  // getHotelDetails no trae la zona horaria; getHotels sí.
  const base = await obtenerPropiedad();
  return { ok: true, datos: armarDetallePropiedad(r.data, base?.zonaHoraria ?? "America/Guatemala") };
}

/**
 * País y código postal de la PROPIEDAD.
 *
 * Decisión del hotel: cuando se abra la escritura, la reserva se crea con el
 * país y el código postal del alojamiento, no con los del huésped (no se le
 * preguntan). Sale de aquí y no escrito a mano, para que el día que cambien de
 * dirección, o que esto se monte para otro hotel, salga solo.
 *
 * Cacheado: es un dato que casi nunca se mueve y se va a pedir en cada reserva.
 */
const TTL_DIRECCION_MS = 60 * 60 * 1000;
let cacheDireccion: { ts: number; datos: DireccionPropiedad } | null = null;

export async function paisYZipDeLaPropiedad(
  leer: () => Promise<Lectura<DetallePropiedad>> = detallePropiedad,
): Promise<Lectura<DireccionPropiedad>> {
  if (cacheDireccion && Date.now() - cacheDireccion.ts < TTL_DIRECCION_MS) {
    return { ok: true, datos: cacheDireccion.datos };
  }
  const r = await leer();
  if (!r.ok) return { ok: false, error: r.error };
  const dir = r.datos.direccion;
  if (!dir.pais || !dir.zip) {
    // Sin uno de los dos no se cachea ni se completa a mano: se dice que falta.
    return { ok: false, error: "La propiedad no tiene país o código postal cargados" };
  }
  cacheDireccion = { ts: Date.now(), datos: dir };
  return { ok: true, datos: dir };
}

export function olvidarDireccionPropiedad(): void {
  cacheDireccion = null;
}

// ── Huéspedes ──

export interface HuespedPms {
  id: string;
  reservaId: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  correo: string;
  telefono: string;
  celular: string;
  pais: string;
  esPrincipal: boolean;
}

interface GuestApi {
  guestID?: string;
  reservationID?: string;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestCellPhone?: string;
  guestCountry?: string;
  isMainGuest?: boolean;
}

export function armarHuesped(g: GuestApi): HuespedPms {
  const nombre = limpio(g.guestFirstName);
  const apellido = limpio(g.guestLastName);
  return {
    id: limpio(g.guestID),
    reservaId: limpio(g.reservationID),
    nombre,
    apellido,
    nombreCompleto: limpio(g.guestName) || [nombre, apellido].filter(Boolean).join(" "),
    correo: limpio(g.guestEmail),
    telefono: limpio(g.guestPhone),
    celular: limpio(g.guestCellPhone),
    pais: limpio(g.guestCountry),
    esPrincipal: g.isMainGuest !== false,
  };
}

/**
 * Padrón de huéspedes del alojamiento, con teléfono y correo. Es lo que permite
 * reconocer si quien escribe por WhatsApp ya se hospedó.
 *
 * Va paginado y con tope: si el hotel creciera a miles de fichas, se avisa que
 * el barrido quedó corto en vez de dar por hecho que no está.
 */
export async function listarHuespedes(
  tope = 500,
): Promise<Lectura<{ huespedes: HuespedPms[]; total: number; completo: boolean }>> {
  const PAGINA = 100;
  const acumulado: HuespedPms[] = [];
  let total = 0;
  for (let pagina = 1; pagina <= Math.ceil(tope / PAGINA); pagina++) {
    const r = await pms<GuestApi[]>("getGuestList", {
      propertyID: credencialesPms()?.propertyId ?? "",
      includeGuestInfo: "true",
      pageNumber: pagina,
      pageSize: PAGINA,
    });
    if (!r.ok) return { ok: false, error: r.error };
    const lote = Array.isArray(r.data) ? r.data : [];
    acumulado.push(...lote.map(armarHuesped));
    total = acumulado.length;
    if (lote.length < PAGINA) return { ok: true, datos: { huespedes: acumulado, total, completo: true } };
  }
  return { ok: true, datos: { huespedes: acumulado, total, completo: false } };
}

// ── Notas del sistema del hotel ──

export interface NotaPms {
  id: string;
  texto: string;
  fecha: string;
  autor: string;
}

interface NotaApi {
  noteID?: string | number;
  id?: string | number;
  note?: string;
  noteText?: string;
  text?: string;
  message?: string;
  dateCreated?: string;
  date?: string;
  createdAt?: string;
  userName?: string;
  user?: string;
  createdBy?: string;
}

/**
 * Normaliza las notas venga como venga: el sistema responde a veces con arreglo,
 * a veces con un objeto indexado, y cuando no hay ninguna omite el campo entero
 * (sin `data`). Omitido con éxito = no hay notas, no es un fallo de lectura.
 */
export function normalizarNotas(bruto: unknown): NotaPms[] {
  const lista: NotaApi[] = Array.isArray(bruto)
    ? (bruto as NotaApi[])
    : bruto && typeof bruto === "object"
      ? (Object.values(bruto as Record<string, NotaApi>).filter(
          (v) => v && typeof v === "object",
        ) as NotaApi[])
      : [];
  return lista
    .map((n, i) => ({
      id: limpio(n.noteID ?? n.id) || `n${i + 1}`,
      texto: limpio(n.note ?? n.noteText ?? n.text ?? n.message),
      fecha: limpio(n.dateCreated ?? n.date ?? n.createdAt),
      autor: limpio(n.userName ?? n.user ?? n.createdBy),
    }))
    .filter((n) => n.texto !== "");
}

export async function notasDeHuesped(guestId: string): Promise<Lectura<NotaPms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const r = await pms<unknown>("getGuestNotes", { propertyID: c.propertyId, guestID: guestId });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, datos: normalizarNotas(r.data) };
}

export async function notasDeReserva(reservaId: string): Promise<Lectura<NotaPms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const r = await pms<unknown>("getReservationNotes", {
    propertyID: c.propertyId,
    reservationID: reservaId,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, datos: normalizarNotas(r.data) };
}

// ── Reservas con detalle de huésped y habitación ──

export interface EstadiaPms {
  id: string;
  estado: string;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  saldo: number;
  fuenteId: string;
  fuente: string;
  creada: string;
  habitaciones: string[]; // nombre de la habitación asignada
  tipos: string[]; // nombre del tipo, sirve cuando aún no hay habitación
  sinAsignar: number; // huéspedes de la reserva todavía sin habitación
  huespedes: HuespedPms[];
}

interface ReservaDetalleApi {
  reservationID: string;
  status: string;
  startDate: string;
  endDate: string;
  adults?: string | number;
  children?: string | number;
  balance?: number | string;
  sourceID?: string;
  sourceName?: string;
  dateCreated?: string;
  guestList?: Record<
    string,
    GuestApi & {
      assignedRoom?: boolean;
      roomName?: string;
      roomTypeName?: string;
      rooms?: Array<{ roomName?: string; roomTypeName?: string }>;
    }
  >;
}

export function armarEstadia(r: ReservaDetalleApi): EstadiaPms {
  const invitados = Object.values(r.guestList ?? {});
  const habitaciones = new Set<string>();
  const tipos = new Set<string>();
  let sinAsignar = 0;
  for (const g of invitados) {
    if (g.assignedRoom === false) sinAsignar += 1;
    for (const h of g.rooms ?? []) {
      if (limpio(h.roomName)) habitaciones.add(limpio(h.roomName));
      if (limpio(h.roomTypeName)) tipos.add(limpio(h.roomTypeName));
    }
    if (limpio(g.roomName)) habitaciones.add(limpio(g.roomName));
    if (limpio(g.roomTypeName)) tipos.add(limpio(g.roomTypeName));
  }
  return {
    id: r.reservationID,
    estado: limpio(r.status),
    desde: r.startDate,
    hasta: r.endDate,
    adultos: Number(r.adults) || 0,
    ninos: Number(r.children) || 0,
    saldo: Number(r.balance) || 0,
    fuenteId: limpio(r.sourceID),
    fuente: limpio(r.sourceName),
    creada: limpio(r.dateCreated),
    habitaciones: [...habitaciones],
    tipos: [...tipos],
    sinAsignar,
    huespedes: invitados.map(armarHuesped),
  };
}

// Busca reservas con los filtros del sistema (por huésped, por fecha de entrada
// o de salida). Devuelve la estadía ya armada, con habitación y saldo.
export async function buscarEstadias(filtros: {
  guestId?: string;
  entradaDesde?: string;
  entradaHasta?: string;
  salidaDesde?: string;
  salidaHasta?: string;
  limite?: number;
}): Promise<Lectura<EstadiaPms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const params: Record<string, string | number> = {
    propertyID: c.propertyId,
    includeGuestsDetails: "true",
    pageNumber: 1,
    pageSize: filtros.limite ?? 50,
  };
  if (filtros.guestId) params.guestID = filtros.guestId;
  if (filtros.entradaDesde) params.checkInFrom = filtros.entradaDesde;
  if (filtros.entradaHasta) params.checkInTo = filtros.entradaHasta;
  if (filtros.salidaDesde) params.checkOutFrom = filtros.salidaDesde;
  if (filtros.salidaHasta) params.checkOutTo = filtros.salidaHasta;

  const r = await pms<ReservaDetalleApi[]>("getReservations", params);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, datos: (Array.isArray(r.data) ? r.data : []).map(armarEstadia) };
}

// ── Canales de venta ──

export interface FuentePms {
  id: string;
  nombre: string;
  externa: boolean; // portal de venta de terceros
  comision: number;
}

export async function listarFuentes(): Promise<Lectura<FuentePms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const r = await pms<unknown>("getSources", { propertyID: c.propertyId });
  if (!r.ok) return { ok: false, error: r.error };
  // El sistema devuelve un arreglo de arreglos (uno por propiedad).
  const plano = (Array.isArray(r.data) ? r.data : []).flat() as Array<{
    sourceID?: string;
    sourceName?: string;
    isThirdParty?: boolean;
    commission?: string | number;
  }>;
  return {
    ok: true,
    datos: plano
      .filter((f) => f && limpio(f.sourceID))
      .map((f) => ({
        id: limpio(f.sourceID),
        nombre: limpio(f.sourceName),
        externa: f.isThirdParty === true,
        comision: Number(f.commission) || 0,
      })),
  };
}

// ── Día de recepción ──

export interface HuespedEnCasaPms {
  reservaId: string;
  guestId: string;
  nombre: string;
  correo: string;
  telefono: string;
  habitacion: string;
  tipo: string;
  desde: string;
  hasta: string;
  estado: string;
}

// Estados que acepta el sistema. Los demás los rechaza con "valor no válido".
export type EstadoHuesped = "in_house" | "not_checked_in" | "checked_out" | "canceled";

export async function huespedesPorEstado(
  estado: EstadoHuesped,
): Promise<Lectura<HuespedEnCasaPms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const r = await pms<
    Array<
      GuestApi & {
        subReservationID?: string;
        roomName?: string;
        roomTypeID?: string;
        startDate?: string;
        endDate?: string;
        currentStatus?: string;
      }
    >
  >("getGuestsByStatus", { propertyID: c.propertyId, status: estado });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    datos: (Array.isArray(r.data) ? r.data : []).map((g) => ({
      reservaId: limpio(g.reservationID),
      guestId: limpio(g.guestID),
      nombre: limpio(g.guestName),
      correo: limpio(g.guestEmail),
      telefono: limpio(g.guestPhone) || limpio(g.guestCellPhone),
      habitacion: limpio(g.roomName),
      tipo: "",
      desde: limpio(g.startDate),
      hasta: limpio(g.endDate),
      estado: limpio(g.currentStatus) || estado,
    })),
  };
}

export interface HabitacionPms {
  id: string;
  nombre: string;
  tipo: string;
  maxHuespedes: number;
  bloqueada: boolean;
}

/**
 * Habitaciones que NO quedan tomadas por ninguna reserva en ese rango, o sea las
 * que recepción tiene libres para asignar. Ojo: el sistema llama "sin asignar" a
 * la habitación, no a la reserva.
 */
export async function habitacionesSinAsignar(
  desde: string,
  hasta: string,
): Promise<Lectura<HabitacionPms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const r = await pms<
    Array<{
      rooms?: Array<{
        roomID: string;
        roomName: string;
        roomTypeName: string;
        maxGuests?: number | string;
        roomBlocked?: boolean;
      }>;
    }>
  >("getRoomsUnassigned", { propertyID: c.propertyId, startDate: desde, endDate: hasta });
  if (!r.ok) return { ok: false, error: r.error };
  const filas = (Array.isArray(r.data) ? r.data : []).flatMap((p) => p.rooms ?? []);
  return {
    ok: true,
    datos: filas.map((h) => ({
      id: limpio(h.roomID),
      nombre: limpio(h.roomName),
      tipo: limpio(h.roomTypeName),
      maxHuespedes: Number(h.maxGuests) || 0,
      bloqueada: h.roomBlocked === true,
    })),
  };
}

export type CondicionLimpieza = "clean" | "dirty" | "inspected" | "no_service" | string;

export interface LimpiezaPms {
  habitacionId: string;
  habitacion: string;
  tipo: string;
  condicion: CondicionLimpieza;
  ocupada: boolean;
  bloqueada: boolean;
  usoFrontdesk: string;
  responsable: string;
  noMolestar: boolean;
  comentario: string;
  llegada: string;
  salida: string;
  actualizado: string;
}

export async function estadoDeLimpieza(): Promise<Lectura<LimpiezaPms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const r = await pms<
    Array<{
      roomID: string;
      roomName: string;
      roomTypeName: string;
      roomCondition: string;
      roomOccupied?: boolean;
      roomBlocked?: boolean;
      frontdeskStatus?: string;
      housekeeper?: string;
      doNotDisturb?: boolean;
      roomComments?: string;
      arrivalDate?: string;
      departureDate?: string;
      date?: string;
    }>
  >("getHousekeepingStatus", { propertyID: c.propertyId });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    datos: (Array.isArray(r.data) ? r.data : []).map((h) => ({
      habitacionId: limpio(h.roomID),
      habitacion: limpio(h.roomName),
      tipo: limpio(h.roomTypeName),
      condicion: limpio(h.roomCondition),
      ocupada: h.roomOccupied === true,
      bloqueada: h.roomBlocked === true,
      usoFrontdesk: limpio(h.frontdeskStatus),
      responsable: limpio(h.housekeeper),
      noMolestar: h.doNotDisturb === true,
      comentario: limpio(h.roomComments),
      llegada: limpio(h.arrivalDate),
      salida: limpio(h.departureDate),
      actualizado: limpio(h.date),
    })),
  };
}

export interface BloqueoPms {
  id: string;
  habitacion: string;
  tipo: string;
  desde: string;
  hasta: string;
  motivo: string;
}

// El sistema no acepta rangos de más de 35 días.
export const MAX_DIAS_BLOQUEOS = 35;

export async function bloqueosDeHabitacion(
  desde: string,
  hasta: string,
): Promise<Lectura<BloqueoPms[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const tope = noches(desde, hasta) > MAX_DIAS_BLOQUEOS ? sumarDias(desde, MAX_DIAS_BLOQUEOS) : hasta;
  const r = await pms<{
    roomBlocks?: Array<{
      roomBlockID?: string | number;
      roomID?: string;
      roomName?: string;
      roomTypeName?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
      notes?: string;
    }>;
  }>("getRoomBlocks", { propertyID: c.propertyId, startDate: desde, endDate: tope });
  if (!r.ok) return { ok: false, error: r.error };
  const lista = r.data?.roomBlocks ?? [];
  return {
    ok: true,
    datos: lista.map((b, i) => ({
      id: limpio(b.roomBlockID) || `b${i + 1}`,
      habitacion: limpio(b.roomName) || limpio(b.roomID),
      tipo: limpio(b.roomTypeName),
      desde: limpio(b.startDate),
      hasta: limpio(b.endDate),
      motivo: limpio(b.reason) || limpio(b.notes),
    })),
  };
}

export interface FormaDeCobro {
  codigo: string;
  nombre: string;
  tarjetas: string[];
}

export async function formasDeCobro(): Promise<Lectura<FormaDeCobro[]>> {
  const c = credencialesPms();
  if (!c) return { ok: false, error: "PMS sin configurar" };
  const r = await pms<{
    methods?: Array<{
      code?: string;
      method?: string;
      name?: string;
      cardTypes?: Array<{ cardName?: string }>;
    }>;
  }>("getPaymentMethods", { propertyID: c.propertyId });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    datos: (r.data?.methods ?? []).map((m) => ({
      codigo: limpio(m.code ?? m.method),
      nombre: limpio(m.name),
      tarjetas: (m.cardTypes ?? []).map((t) => limpio(t.cardName)).filter(Boolean),
    })),
  };
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
