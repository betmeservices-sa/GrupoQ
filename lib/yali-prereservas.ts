// Reservas apartadas por Sofía que una persona confirma.
//
// El flujo que pidió Yali: en pocos mensajes Sofía junta fechas, personas,
// habitación, nombre y correo; con eso APARTA la habitación una hora, dice el
// total y pide el comprobante. El comprobante (una imagen) no lo revisa ella:
// el sistema lo detecta, se lo pasa a Verónica, y Verónica confirma la reserva
// desde el panel. Recién ahí entra al sistema del hotel (Cloudbeds cuando la
// escritura está encendida; si no, al registro del panel para cargarla a mano).
//
// Por qué no confirma Sofía sola: el pago lo verifica una persona contra la
// cuenta del hotel, y una reserva mal confirmada bloquea noches reales.

import { getSupabase } from "./supabase";
import { SIMBOLO_YALI, MONEDA_YALI, sedePorId } from "./tenants/yali-inventario";
import {
  consultarDisponibilidadYali,
  emparejarHabitacion,
  fechaLarga,
  type InputReservaYali,
} from "./yali-agente";
import { disponibilidadEnVivo, escrituraHabilitada, reservarEnVivo, sedeEnVivo } from "./yali-cloudbeds";
import { addAdjunto, upsertContacto } from "./contacts-store";
import { guardarComprobanteDesdeUrl } from "./comprobantes-store";
import { actualizarAdjuntoMeta } from "./meta-messages-store";
import { contactoDeClave } from "./contacto-canal";

export type EstadoPreReserva = "pendiente_pago" | "comprobante_recibido" | "confirmada" | "rechazada";

export interface PreReserva {
  id: string;
  tenant: string;
  clave: string;
  sedeId: string;
  sedeNombre: string;
  habitacionId: string;
  habitacionNombre: string;
  huesped: string;
  correo: string | null;
  telefono: string | null;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  noches: number;
  total: number;
  moneda: string;
  notas: string | null;
  estado: EstadoPreReserva;
  comprobanteUrl: string | null;
  comprobanteMid: string | null;
  comprobanteTs: string | null;
  vence: string | null;
  confirmadaPor: string | null;
  confirmadaTs: string | null;
  motivoRechazo: string | null;
  reservaCloudbeds: string | null;
  creada: string;
  actualizada: string;
}

/** Cuánto tiempo queda apartada la habitación desde que se dan los datos de pago. */
export const APARTADO_MINUTOS = 60;

/** Los estados en los que un apartado sigue vivo (no cerrado). */
export const ESTADOS_VIVOS: EstadoPreReserva[] = ["pendiente_pago", "comprobante_recibido"];

/**
 * Los datos de pago que Sofía le pasa al huésped, tal como el hotel los cargó.
 * Sin esto Sofía no puede cobrar: el apartado queda hecho y ella avisa que
 * una persona del equipo manda los datos.
 */
export function datosDePago(): string | null {
  const t = (process.env.YALI_DATOS_PAGO ?? "").trim();
  return t || null;
}

// ─────────────────────────── almacenamiento ───────────────────────────

const mem = new Map<string, PreReserva>();
const TABLA = "reservas_pendientes";

interface Fila {
  id: string;
  tenant: string;
  clave: string;
  sede_id: string;
  sede_nombre: string;
  habitacion_id: string;
  habitacion_nombre: string;
  huesped: string;
  correo: string | null;
  telefono: string | null;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  noches: number;
  total: number | string;
  moneda: string;
  notas: string | null;
  estado: string;
  comprobante_url: string | null;
  comprobante_mid: string | null;
  comprobante_ts: string | null;
  vence: string | null;
  confirmada_por: string | null;
  confirmada_ts: string | null;
  motivo_rechazo: string | null;
  reserva_cloudbeds: string | null;
  creada: string;
  actualizada: string;
}

function deFila(r: Fila): PreReserva {
  return {
    id: r.id,
    tenant: r.tenant,
    clave: r.clave,
    sedeId: r.sede_id,
    sedeNombre: r.sede_nombre,
    habitacionId: r.habitacion_id,
    habitacionNombre: r.habitacion_nombre,
    huesped: r.huesped,
    correo: r.correo,
    telefono: r.telefono,
    desde: r.desde,
    hasta: r.hasta,
    adultos: Number(r.adultos) || 0,
    ninos: Number(r.ninos) || 0,
    noches: Number(r.noches) || 0,
    total: Number(r.total) || 0,
    moneda: r.moneda,
    notas: r.notas,
    estado: r.estado as EstadoPreReserva,
    comprobanteUrl: r.comprobante_url,
    comprobanteMid: r.comprobante_mid,
    comprobanteTs: r.comprobante_ts,
    vence: r.vence,
    confirmadaPor: r.confirmada_por,
    confirmadaTs: r.confirmada_ts,
    motivoRechazo: r.motivo_rechazo,
    reservaCloudbeds: r.reserva_cloudbeds,
    creada: r.creada,
    actualizada: r.actualizada,
  };
}

function aFila(p: PreReserva): Fila {
  return {
    id: p.id,
    tenant: p.tenant,
    clave: p.clave,
    sede_id: p.sedeId,
    sede_nombre: p.sedeNombre,
    habitacion_id: p.habitacionId,
    habitacion_nombre: p.habitacionNombre,
    huesped: p.huesped,
    correo: p.correo,
    telefono: p.telefono,
    desde: p.desde,
    hasta: p.hasta,
    adultos: p.adultos,
    ninos: p.ninos,
    noches: p.noches,
    total: p.total,
    moneda: p.moneda,
    notas: p.notas,
    estado: p.estado,
    comprobante_url: p.comprobanteUrl,
    comprobante_mid: p.comprobanteMid,
    comprobante_ts: p.comprobanteTs,
    vence: p.vence,
    confirmada_por: p.confirmadaPor,
    confirmada_ts: p.confirmadaTs,
    motivo_rechazo: p.motivoRechazo,
    reserva_cloudbeds: p.reservaCloudbeds,
    creada: p.creada,
    actualizada: p.actualizada,
  };
}

export async function guardarPreReserva(p: PreReserva): Promise<void> {
  return guardar(p);
}

async function guardar(p: PreReserva): Promise<void> {
  const sb = getSupabase(p.tenant);
  if (!sb) {
    mem.set(p.id, p);
    return;
  }
  const { error } = await sb.from(TABLA).upsert(aFila(p), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function preReservaPorId(tenant: string, id: string): Promise<PreReserva | null> {
  const sb = getSupabase(tenant);
  if (!sb) return mem.get(id) ?? null;
  const { data, error } = await sb.from(TABLA).select("*").eq("tenant", tenant).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? deFila(data as Fila) : null;
}

/** El apartado vivo de una conversación (el más reciente), si hay. */
export async function preReservaViva(tenant: string, clave: string): Promise<PreReserva | null> {
  const sb = getSupabase(tenant);
  if (!sb) {
    return (
      [...mem.values()]
        .filter((p) => p.tenant === tenant && p.clave === clave && ESTADOS_VIVOS.includes(p.estado))
        .sort((a, b) => (a.creada < b.creada ? 1 : -1))[0] ?? null
    );
  }
  const { data, error } = await sb
    .from(TABLA)
    .select("*")
    .eq("tenant", tenant)
    .eq("clave", clave)
    .in("estado", ESTADOS_VIVOS)
    .order("creada", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data && data[0] ? deFila(data[0] as Fila) : null;
}

/**
 * Lo que hay que mirar: por clave, todo lo de esa conversación (vivo y
 * cerrado, lo más nuevo primero); sin clave, los apartados vivos del tenant y
 * los últimos cerrados, para la lista del panel.
 */
export async function listarPreReservas(tenant: string, clave?: string): Promise<PreReserva[]> {
  const sb = getSupabase(tenant);
  if (!sb) {
    return [...mem.values()]
      .filter((p) => p.tenant === tenant && (!clave || p.clave === clave))
      .sort((a, b) => (a.creada < b.creada ? 1 : -1))
      .slice(0, 40);
  }
  let q = sb.from(TABLA).select("*").eq("tenant", tenant).order("creada", { ascending: false }).limit(40);
  if (clave) q = q.eq("clave", clave);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Fila[]).map(deFila);
}

/**
 * Las reservas de una ficha de Contactos: por la conversación (clave de
 * Meta o wa:teléfono) y, si la llave es un teléfono, también las tomadas a
 * mano con ese número.
 */
export async function listarPreReservasDeContacto(tenant: string, from: string): Promise<PreReserva[]> {
  const digitos = from.replace(/\D/g, "");
  const esTelefono = !from.includes(":") && digitos.length >= 8;
  const sb = getSupabase(tenant);
  const coincide = (p: PreReserva) =>
    p.clave === from || (esTelefono && (p.clave === `wa:${digitos}` || (p.telefono ?? "").replace(/\D/g, "").endsWith(digitos.slice(-8))));
  if (!sb) return [...mem.values()].filter((p) => p.tenant === tenant && coincide(p)).sort((a, b) => (a.creada < b.creada ? 1 : -1));
  let q = sb.from(TABLA).select("*").eq("tenant", tenant).order("creada", { ascending: false }).limit(60);
  q = esTelefono ? q.or(`clave.eq.wa:${digitos},telefono.ilike.%${digitos.slice(-8)}`) : q.eq("clave", from);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Fila[]).map(deFila);
}

// ─────────────────────────── apartar ───────────────────────────

const PREFIJO_SEDE: Record<string, string> = { a: "YA", b: "CS", c: "PL" };

export function nuevoCodigo(sedeId: string): string {
  return codigoDe(sedeId);
}

function codigoDe(sedeId: string): string {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += letras[Math.floor(Math.random() * letras.length)];
  return `${PREFIJO_SEDE[sedeId] ?? "YH"}-${s}`;
}

export interface ContextoApartado {
  tenant: string;
  /** La conversación: "facebook:pagina:persona", "instagram:..." o "wa:telefono". */
  clave: string;
}

export interface ResultadoApartado {
  ok: boolean;
  codigo?: string;
  sede?: string;
  habitacion?: string;
  llegada?: string;
  salida?: string;
  /** Las fechas con día de la semana, para decirlas tal cual. */
  fechas?: string;
  noches?: number;
  huespedes?: number;
  total?: number;
  moneda?: string;
  /** Minutos que queda apartada desde ahora. */
  apartada_minutos?: number;
  /** Tal cual hay que dárselos al huésped. null = el hotel no los cargó todavía. */
  datos_pago?: string | null;
  instrucciones?: string;
  error?: string;
}

/**
 * Deja la habitación apartada una hora a nombre del huésped, con el total
 * exacto. Es lo que Sofía llama cuando ya tiene los seis datos. La reserva
 * NO queda confirmada: eso lo hace una persona cuando llega el comprobante.
 */
export async function apartarEstadiaYali(
  input: InputReservaYali,
  sedeId: string | null,
  ctx: ContextoApartado,
): Promise<ResultadoApartado> {
  const nombre = (input.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre completo del huésped." };
  const adultos = Math.max(1, Number(input.adultos) || 1);
  const ninos = Math.max(0, Number(input.ninos) || 0);
  const disp = await consultarDisponibilidadYali(
    { llegada: input.llegada, salida: input.salida, adultos, ninos, sede: input.sede },
    sedeId,
  );
  if (!disp.ok || !disp.opciones) return { ok: false, error: disp.error ?? "No se pudo revisar la disponibilidad." };
  const opcion = emparejarHabitacion(
    disp.opciones.map((o) => ({ ...o, nombre: o.habitacion })),
    input.habitacion ?? "",
  );
  if (!opcion) {
    return {
      ok: false,
      error: `${input.habitacion || "Esa habitación"} no está libre en ${disp.sede} para esas fechas. Ofrece solo lo que devuelva consultar_habitaciones.`,
    };
  }
  const sede = (sedeId ? sedePorId(sedeId) : null) ?? sedePorNombre(disp.sede ?? "");
  if (!sede) return { ok: false, error: "Falta saber a cuál de los tres hoteles se refiere." };

  // Un apartado nuevo reemplaza al anterior de la misma conversación: el
  // huésped cambió de idea, no tiene dos habitaciones apartadas.
  const previo = await preReservaViva(ctx.tenant, ctx.clave);
  if (previo && previo.estado === "pendiente_pago") {
    await guardar({ ...previo, estado: "rechazada", motivoRechazo: "reemplazada por un apartado nuevo", actualizada: new Date().toISOString() });
  }

  const ahora = new Date();
  const p: PreReserva = {
    id: codigoDe(sede.id),
    tenant: ctx.tenant,
    clave: ctx.clave,
    sedeId: sede.id,
    sedeNombre: sede.nombre,
    habitacionId: opcion.habitacion_id,
    habitacionNombre: opcion.habitacion,
    huesped: nombre,
    correo: (input.correo ?? "").trim() || null,
    telefono: (input.telefono ?? "").trim() || null,
    desde: disp.llegada!,
    hasta: disp.salida!,
    adultos,
    ninos,
    noches: disp.noches ?? 1,
    total: opcion.total_estadia,
    moneda: MONEDA_YALI,
    notas: (input.notas ?? "").trim() || null,
    estado: "pendiente_pago",
    comprobanteUrl: null,
    comprobanteMid: null,
    comprobanteTs: null,
    vence: new Date(ahora.getTime() + APARTADO_MINUTOS * 60 * 1000).toISOString(),
    confirmadaPor: null,
    confirmadaTs: null,
    motivoRechazo: null,
    reservaCloudbeds: null,
    creada: ahora.toISOString(),
    actualizada: ahora.toISOString(),
  };
  await guardar(p);
  const pago = datosDePago();
  return {
    ok: true,
    codigo: p.id,
    sede: p.sedeNombre,
    habitacion: p.habitacionNombre,
    llegada: p.desde,
    salida: p.hasta,
    fechas: `del ${fechaLarga(p.desde)} al ${fechaLarga(p.hasta)}`,
    noches: p.noches,
    huespedes: adultos + ninos,
    total: p.total,
    moneda: p.moneda,
    apartada_minutos: APARTADO_MINUTOS,
    datos_pago: pago,
    instrucciones: pago
      ? `Dile el total (${SIMBOLO_YALI}${p.total}), pásale los datos de pago tal cual, dile que la habitación le queda apartada ${APARTADO_MINUTOS} minutos y pídele la captura del comprobante por este mismo chat. Cuando la mande, una persona del equipo verifica el pago y le confirma.`
      : `El hotel todavía no cargó sus datos de pago. Dile el total (${SIMBOLO_YALI}${p.total}), que la habitación le queda apartada ${APARTADO_MINUTOS} minutos y que una persona del equipo le manda por aquí los datos para pagar. Llama a crear_ticket con tipo "pago" para que el equipo lo haga.`,
  };
}

function sedePorNombre(nombre: string) {
  const n = nombre.toLowerCase();
  for (const id of ["a", "b", "c"]) {
    const s = sedePorId(id);
    if (s && n.includes(s.nombre.toLowerCase())) return s;
  }
  return null;
}

// ─────────────────────────── comprobante ───────────────────────────

/**
 * Llegó una imagen en una conversación con apartado vivo: se toma como el
 * comprobante y el apartado pasa a "comprobante_recibido". Devuelve null si no
 * había nada apartado (una foto cualquiera).
 */
export async function recibirComprobante(
  tenant: string,
  clave: string,
  comprobante: { url?: string | null; mid?: string | null },
): Promise<PreReserva | null> {
  const p = await preReservaViva(tenant, clave);
  if (!p) return null;
  const ahora = new Date().toISOString();
  // La foto se baja YA y se guarda con nosotros: el enlace de Meta caduca y
  // además descarga en vez de mostrar. Si no se puede, queda el enlace.
  let url = comprobante.url ?? p.comprobanteUrl;
  let mime: string | undefined;
  if (comprobante.url) {
    const g = await guardarComprobanteDesdeUrl(tenant, { apartadoId: p.id, clave, url: comprobante.url }).catch(() => null);
    if (g) {
      url = g.ruta;
      mime = g.mime;
    }
  }
  const nuevo: PreReserva = {
    ...p,
    estado: "comprobante_recibido",
    comprobanteUrl: url,
    comprobanteMid: comprobante.mid ?? p.comprobanteMid,
    comprobanteTs: ahora,
    actualizada: ahora,
  };
  await guardar(nuevo);
  if (url && url.startsWith("/api/comprobantes/")) {
    // La ficha del contacto (con el nombre y correo del apartado, para que
    // exista en Contactos) y el archivo pegado a ella; el mensaje de la
    // bandeja apunta al archivo guardado (no al enlace que vence).
    const [nombre, ...resto] = p.huesped.split(/s+/);
    await upsertContacto({
      from: contactoDeClave(clave),
      nombre,
      apellido: resto.join(" ") || undefined,
      correo: p.correo ?? undefined,
      tenant,
    }).catch((e) => console.error("[prereservas] contacto:", e));
    await addAdjunto({
      from: contactoDeClave(clave),
      tipo: "image",
      mime,
      filename: `comprobante-${p.id}.${mime?.includes("png") ? "png" : "jpg"}`,
      caption: `Comprobante de pago · ${p.id} · ${p.huesped} · ${SIMBOLO_YALI}${p.total}`,
      ts: ahora,
      url,
    }).catch((e) => console.error("[prereservas] adjunto:", e));
    if (comprobante.mid && !clave.startsWith("wa:") && !clave.startsWith("prueba:")) {
      await actualizarAdjuntoMeta(tenant, comprobante.mid, url).catch(() => {});
    }
  }
  return nuevo;
}

/** Lo que se le dice al huésped apenas manda el comprobante. */
// Sin nombres propios: al huésped se le habla de "una persona del equipo".
export function textoComprobanteRecibido(): string {
  return "Recibí su comprobante, ¡gracias! Una persona del equipo verifica el pago y le confirma la reserva por aquí en un momento.";
}

/** A qué ficha de Contactos va este apartado: la conversación, o el teléfono si se reservó a mano. */
function llaveDeContacto(p: PreReserva): string | null {
  if (p.clave.startsWith("manual:")) {
    const tel = (p.telefono ?? "").replace(/\D/g, "");
    return tel.length >= 8 ? tel : null;
  }
  return contactoDeClave(p.clave);
}

/**
 * Reservar a mano desde el panel: mismas validaciones y tarifas que Sofía,
 * pero sin apartado ni comprobante. Queda confirmada de una vez, a nombre de
 * quien la tomó, y sigue el mismo camino al sistema (Cloudbeds o panel).
 */
export async function reservarManualYali(
  tenant: string,
  input: InputReservaYali,
  sedeId: string | null,
  quien: { staffId?: string | null; nombre?: string | null },
  /** La conversación de la que sale (para que la tarjeta aparezca en ese chat). */
  claveChat?: string | null,
): Promise<ResultadoConfirmacion> {
  const nombre = (input.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre del huésped." };
  const adultos = Math.max(1, Number(input.adultos) || 1);
  const ninos = Math.max(0, Number(input.ninos) || 0);
  const disp = await consultarDisponibilidadYali(
    { llegada: input.llegada, salida: input.salida, adultos, ninos, sede: input.sede },
    sedeId,
  );
  if (!disp.ok || !disp.opciones) return { ok: false, error: disp.error ?? "No se pudo revisar la disponibilidad." };
  const opcion = emparejarHabitacion(
    disp.opciones.map((o) => ({ ...o, nombre: o.habitacion })),
    input.habitacion ?? "",
  );
  if (!opcion) return { ok: false, error: `${input.habitacion || "Esa habitación"} no está libre para esas fechas.` };
  const sede = (sedeId ? sedePorId(sedeId) : null) ?? sedePorNombre(disp.sede ?? "");
  if (!sede) return { ok: false, error: "Falta el hotel." };
  const ahora = new Date().toISOString();
  const p: PreReserva = {
    id: codigoDe(sede.id),
    tenant,
    clave: claveChat && /^(instagram|facebook):\d+:\d+$|^wa:\d+$/.test(claveChat) ? claveChat : `manual:${Date.now().toString(36)}`,
    sedeId: sede.id,
    sedeNombre: sede.nombre,
    habitacionId: opcion.habitacion_id,
    habitacionNombre: opcion.habitacion,
    huesped: nombre,
    correo: (input.correo ?? "").trim() || null,
    telefono: (input.telefono ?? "").trim() || null,
    desde: disp.llegada!,
    hasta: disp.salida!,
    adultos,
    ninos,
    noches: disp.noches ?? 1,
    total: opcion.total_estadia,
    moneda: MONEDA_YALI,
    notas: [`Reserva tomada a mano por ${quien.nombre ?? quien.staffId ?? "el equipo"}.`, (input.notas ?? "").trim()].filter(Boolean).join(" "),
    estado: "comprobante_recibido",
    comprobanteUrl: null,
    comprobanteMid: null,
    comprobanteTs: null,
    vence: null,
    confirmadaPor: null,
    confirmadaTs: null,
    motivoRechazo: null,
    reservaCloudbeds: null,
    creada: ahora,
    actualizada: ahora,
  };
  await guardar(p);
  return confirmarPreReserva(tenant, p.id, quien);
}

// ─────────────────────────── confirmar / rechazar ───────────────────────────

export interface ResultadoConfirmacion {
  ok: boolean;
  reserva?: PreReserva;
  /** true si quedó tomada en el Cloudbeds del hotel; false si solo en el panel. */
  enCloudbeds?: boolean;
  error?: string;
}

/**
 * Verónica verificó el pago: la reserva entra al sistema. En Cloudbeds si la
 * sede está en vivo y la escritura está encendida; si no, al registro del
 * panel (y el equipo la carga a mano).
 */
export async function confirmarPreReserva(
  tenant: string,
  id: string,
  quien: { staffId?: string | null; nombre?: string | null },
): Promise<ResultadoConfirmacion> {
  const p = await preReservaPorId(tenant, id);
  if (!p) return { ok: false, error: "No existe ese apartado." };
  if (p.estado === "confirmada") return { ok: true, reserva: p, enCloudbeds: Boolean(p.reservaCloudbeds) };
  if (p.estado === "rechazada") return { ok: false, error: "Ese apartado ya fue rechazado." };
  const sede = sedePorId(p.sedeId);
  if (!sede) return { ok: false, error: "La sede del apartado ya no existe." };

  let numeroCloudbeds: string | null = null;
  if (sedeEnVivo(sede.id) && escrituraHabilitada()) {
    const vivo = await disponibilidadEnVivo(sede, p.desde, p.hasta, p.adultos, p.ninos, p.noches);
    const tipo = vivo?.find((o) => o.habitacion_id === p.habitacionId || o.habitacion === p.habitacionNombre);
    if (!tipo) {
      return { ok: false, error: `${p.habitacionNombre} ya no aparece libre en Cloudbeds para esas fechas. Revísalo en Cloudbeds antes de confirmar.` };
    }
    const r = await reservarEnVivo({
      sede,
      roomTypeId: tipo.roomTypeId,
      roomRateId: tipo.roomRateId,
      desde: p.desde,
      hasta: p.hasta,
      adultos: p.adultos,
      ninos: p.ninos,
      nombre: p.huesped,
      correo: p.correo ?? "sin-correo@yalihospitality.com",
      telefono: p.telefono ?? undefined,
      notas: [p.notas, `Pago verificado por ${quien.nombre ?? quien.staffId ?? "el equipo"}. Apartado ${p.id}.`].filter(Boolean).join(" "),
    });
    if (!r.ok) return { ok: false, error: `Cloudbeds no tomó la reserva: ${r.error}` };
    numeroCloudbeds = r.reservationId ?? null;
  }
  const ahora = new Date().toISOString();
  const nuevo: PreReserva = {
    ...p,
    estado: "confirmada",
    confirmadaPor: quien.nombre ?? quien.staffId ?? null,
    confirmadaTs: ahora,
    reservaCloudbeds: numeroCloudbeds,
    actualizada: ahora,
  };
  await guardar(nuevo);
  // A Contactos: quién reservó, con qué correo y qué reservó. Si falla no
  // frena la confirmación (la reserva ya está tomada).
  const llave = llaveDeContacto(p);
  if (llave) try {
    const [nombre, ...resto] = p.huesped.split(/\s+/);
    await upsertContacto({
      from: llave,
      nombre,
      apellido: resto.join(" ") || undefined,
      correo: p.correo ?? undefined,
      // Sin notas: upsertContacto las reemplaza y pisaría lo que escribió el equipo.
      tags: ["Reserva confirmada"],
      tenant,
    });
  } catch (e) {
    console.error("[prereservas] no se pudo guardar el contacto:", e);
  }
  return { ok: true, reserva: nuevo, enCloudbeds: Boolean(numeroCloudbeds) };
}

export async function rechazarPreReserva(
  tenant: string,
  id: string,
  motivo: string,
  quien: { staffId?: string | null; nombre?: string | null },
): Promise<ResultadoConfirmacion> {
  const p = await preReservaPorId(tenant, id);
  if (!p) return { ok: false, error: "No existe ese apartado." };
  if (p.estado === "confirmada") return { ok: false, error: "Ese apartado ya está confirmado." };
  const ahora = new Date().toISOString();
  const nuevo: PreReserva = {
    ...p,
    estado: "rechazada",
    motivoRechazo: motivo.trim() || `rechazada por ${quien.nombre ?? quien.staffId ?? "el equipo"}`,
    confirmadaPor: quien.nombre ?? quien.staffId ?? null,
    actualizada: ahora,
  };
  await guardar(nuevo);
  return { ok: true, reserva: nuevo, enCloudbeds: false };
}

/** El mensaje de confirmación que recibe el huésped cuando Verónica confirma. */
export function textoReservaConfirmada(p: PreReserva): string {
  const noches = p.noches === 1 ? "1 noche" : `${p.noches} noches`;
  return `¡Listo! Su reserva quedó confirmada ✅\n${p.habitacionNombre} en ${p.sedeNombre}, ${noches}: entra el ${fechaBonita(p.desde)} y sale el ${fechaBonita(p.hasta)}. Número de reserva ${p.reservaCloudbeds ?? p.id}.\nCheck in desde las 3:00 p. m. y check out hasta el mediodía. ¡La esperamos!`;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaBonita(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} de ${MESES[Number(m) - 1] ?? m}`;
}

/** Solo para pruebas: vacía el almacenamiento en memoria. */
export function _vaciarPreReservas(): void {
  mem.clear();
}
