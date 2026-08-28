// Sacar la reserva de un chat que atendió una persona.
//
// Cuando Sofía atiende, ella misma aparta y la tarjeta existe. Cuando atiende
// el equipo desde la app de Instagram o Facebook, la reserva se cierra en el
// chat (fechas, nombre, comprobante, "ya la ingresé al sistema") y el panel
// no se entera: no hay tarjeta, no hay contacto, no hay archivo. Esto lee el
// hilo, saca los datos con el modelo, busca la reserva en Cloudbeds y deja la
// tarjeta como si Sofía la hubiera hecho: confirmada si ya está en Cloudbeds,
// "comprobante recibido" si mandó la foto y todavía no está, apartada si
// solo acordaron fechas.

import Anthropic from "@anthropic-ai/sdk";
import { TENANTS } from "./tenants";
import type { TenantId } from "./tenants/types";
import { SEDES_YALI, MONEDA_YALI, sedePorId } from "./tenants/yali-inventario";
import { sucursalDePagina } from "./sucursal-gate";
import { conexionesDe } from "./meta-store";
import { mensajesAnteriores, actualizarAdjuntoMeta, type MetaMensaje } from "./meta-messages-store";
import { partesDeClave } from "./meta-conversaciones";
import { credencialesDeSede, pedir } from "./yali-cloudbeds";
import { consultarDisponibilidadYali, emparejarHabitacion } from "./yali-agente";
import { guardarPreReserva, nuevoCodigo, preReservaViva, listarPreReservas, type PreReserva } from "./yali-prereservas";
import { guardarComprobanteDesdeUrl } from "./comprobantes-store";
import { addAdjunto, upsertContacto } from "./contacts-store";
import { contactoDeClave } from "./contacto-canal";
import { hoyYali } from "./yali-pms";

const MODEL = process.env.AI_MODEL || "claude-haiku-4-5";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MENSAJES = 60;

export interface ReservaExtraida {
  hay_reserva: boolean;
  huesped?: string;
  correo?: string;
  telefono?: string;
  llegada?: string;
  salida?: string;
  adultos?: number;
  ninos?: number;
  habitacion?: string;
  total?: number;
  pago: "sin_pagar" | "comprobante_enviado" | "pago_confirmado";
  hotel_confirmo: boolean;
  resumen?: string;
}

const HERRAMIENTA: Anthropic.Tool = {
  name: "reserva_detectada",
  description: "Lo que se acordó en el chat sobre una reserva de habitación. Si en el chat no hay una reserva concreta (solo preguntas, day pass, quejas), hay_reserva = false.",
  input_schema: {
    type: "object",
    properties: {
      hay_reserva: { type: "boolean", description: "true solo si acordaron una estadía concreta con fechas" },
      huesped: { type: "string", description: "Nombre completo del huésped tal como lo escribió" },
      correo: { type: "string" },
      telefono: { type: "string", description: "Con código de país si lo dio, solo dígitos y espacios" },
      llegada: { type: "string", description: "AAAA-MM-DD" },
      salida: { type: "string", description: "AAAA-MM-DD" },
      adultos: { type: "number" },
      ninos: { type: "number" },
      habitacion: { type: "string", description: "Tipo de habitación acordado, con el nombre que usó el hotel" },
      total: { type: "number", description: "Total en dólares si se dijo; si no, omitir" },
      pago: { type: "string", enum: ["sin_pagar", "comprobante_enviado", "pago_confirmado"], description: "comprobante_enviado si el huésped mandó una foto/captura del pago; pago_confirmado si el hotel dijo que el pago está verificado o la reserva ingresada" },
      hotel_confirmo: { type: "boolean", description: "true si el hotel dijo que la reserva ya quedó ingresada/confirmada" },
      resumen: { type: "string", description: "Una línea: qué quedó acordado y qué falta" },
    },
    required: ["hay_reserva", "pago", "hotel_confirmo"],
  },
};

function textoDelHilo(msgs: MetaMensaje[]): string {
  return msgs
    .map((m) => {
      const quien = m.direction === "in" ? "HUÉSPED" : "HOTEL";
      const fecha = m.ts.slice(0, 16).replace("T", " ");
      return `[${fecha}] ${quien}: ${m.texto}`;
    })
    .join("\n");
}

/** El modelo lee el hilo y devuelve los datos. Pura respecto al panel: no guarda nada. */
export async function extraerReservaDeChat(msgs: MetaMensaje[], sedeNombre: string, hoy: string): Promise<ReservaExtraida> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY");
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: `Lees conversaciones de Messenger e Instagram del hotel ${sedeNombre} (Yali Hospitality, El Salvador) y extraes SOLO lo que se dijo sobre una reserva de habitación. Hoy es ${hoy}. Las fechas vienen en formato día/mes (29/08/2026 = 29 de agosto). "[imagen]" es una foto que mandó esa persona: si viene después de hablar de pago, es el comprobante. "[audio]" es una nota de voz que no puedes oír. No inventes nada: lo que no está en el chat, se omite.`,
    tools: [HERRAMIENTA],
    tool_choice: { type: "tool", name: "reserva_detectada" },
    messages: [{ role: "user", content: textoDelHilo(msgs) || "(chat vacío)" }],
  });
  const uso = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const r = (uso?.input ?? { hay_reserva: false, pago: "sin_pagar", hotel_confirmo: false }) as ReservaExtraida;
  return r;
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** ¿El nombre de la reserva de Cloudbeds es la misma persona? Dos palabras de 3+ letras en común. */
export function mismoNombre(a: string, b: string): boolean {
  const ta = new Set(normalizar(a).split(" ").filter((t) => t.length >= 3));
  const tb = normalizar(b).split(" ").filter((t) => t.length >= 3);
  const comunes = tb.filter((t) => ta.has(t)).length;
  return comunes >= 2 || (comunes >= 1 && Math.min(ta.size, tb.length) === 1);
}

interface ReservaCloudbeds {
  reservationID: string;
  guestName?: string;
  startDate: string;
  endDate: string;
  status: string;
}

/** La reserva del huésped en el Cloudbeds de la sede, si el hotel ya la ingresó. */
export async function buscarEnCloudbeds(sedeId: string, huesped: string, llegada: string): Promise<ReservaCloudbeds | null> {
  const c = credencialesDeSede(sedeId as "a" | "b" | "c");
  if (!c) return null;
  const r = await pedir<ReservaCloudbeds[]>(c, "getReservations", {
    propertyID: c.propertyId,
    checkInFrom: llegada,
    checkInTo: llegada,
    pageSize: 100,
  });
  if (!r.ok) return null;
  return (r.data ?? []).find((x) => !["canceled", "no_show"].includes(x.status) && x.guestName && mismoNombre(x.guestName, huesped)) ?? null;
}

export interface ResultadoDeteccion {
  ok: boolean;
  reserva: PreReserva | null;
  extraido?: ReservaExtraida;
  motivo?: string;
}

/**
 * Lee el chat, saca la reserva y deja (o actualiza) la tarjeta. No pisa un
 * apartado que Sofía hizo en ese chat salvo para completarlo con Cloudbeds.
 */
export async function detectarReservaEnChat(tenant: string, clave: string): Promise<ResultadoDeteccion> {
  const partes = partesDeClave(clave);
  if (!partes) return { ok: false, reserva: null, motivo: "Solo Messenger e Instagram por ahora." };
  const cfg = TENANTS[tenant as TenantId];
  const cx = (await conexionesDe(tenant)).find((c) => c.pageId === partes.pageId);
  const sucursal = sucursalDePagina(cfg?.sucursales, cx?.pageName);
  const sede = sucursal ? sedePorId(sucursal.id) : null;
  if (!sede) return { ok: false, reserva: null, motivo: "No se sabe de qué hotel es esta página." };

  const { mensajes } = await mensajesAnteriores(partes, null, MENSAJES, tenant);
  const hilo = mensajes.slice().sort((a, b) => a.seq - b.seq);
  if (hilo.length === 0) return { ok: false, reserva: null, motivo: "Chat vacío." };

  const hoy = hoyYali();
  const x = await extraerReservaDeChat(hilo, sede.nombre, hoy);
  if (!x.hay_reserva || !x.llegada || !x.salida || !x.huesped) {
    return { ok: true, reserva: null, extraido: x, motivo: "En el chat no hay una reserva concreta (fechas y nombre)." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.llegada) || !/^\d{4}-\d{2}-\d{2}$/.test(x.salida) || x.salida <= x.llegada) {
    return { ok: true, reserva: null, extraido: x, motivo: "Las fechas del chat no se entienden." };
  }
  const adultos = Math.max(1, Number(x.adultos) || 1);
  const ninos = Math.max(0, Number(x.ninos) || 0);

  // La habitación y el total: lo que dijo el chat, o lo que dice Cloudbeds hoy.
  const hab = emparejarHabitacion(sede.habitaciones, x.habitacion ?? "");
  let total = Number(x.total) || 0;
  let habitacionId = hab?.id ?? "";
  let habitacionNombre = hab?.nombre ?? (x.habitacion ?? "Por definir");
  if (!total || !habitacionId) {
    const disp = await consultarDisponibilidadYali({ llegada: x.llegada, salida: x.salida, adultos, ninos }, sede.id).catch(() => null);
    const op = disp?.opciones && emparejarHabitacion(disp.opciones.map((o) => ({ ...o, nombre: o.habitacion })), x.habitacion ?? "");
    if (op) {
      if (!total) total = op.total_estadia;
      habitacionId = op.habitacion_id;
      habitacionNombre = op.habitacion;
    }
  }

  // ¿Ya está en Cloudbeds? Entonces la reserva es real y confirmada.
  const enCloudbeds = await buscarEnCloudbeds(sede.id, x.huesped, x.llegada).catch(() => null);

  // El comprobante: la última foto que mandó el huésped.
  const foto = [...hilo].reverse().find((m) => m.direction === "in" && m.texto.startsWith("[imagen]") && m.adjuntoMiniatura);
  const ahora = new Date().toISOString();
  const previa = (await preReservaViva(tenant, clave)) ?? (await listarPreReservas(tenant, clave)).find((p) => p.estado === "confirmada" && p.desde === x.llegada) ?? null;
  const id = previa?.id ?? nuevoCodigo(sede.id);

  let comprobanteUrl = previa?.comprobanteUrl ?? null;
  if (foto && !comprobanteUrl) {
    const url = foto.adjuntoMiniatura!;
    if (url.startsWith("/api/comprobantes/")) comprobanteUrl = url;
    else {
      const g = await guardarComprobanteDesdeUrl(tenant, { apartadoId: id, clave, url }).catch(() => null);
      if (g) {
        comprobanteUrl = g.ruta;
        await actualizarAdjuntoMeta(tenant, foto.mid, g.ruta).catch(() => {});
      } else comprobanteUrl = url; // el enlace de Meta, mientras dure
    }
  }

  const estado: PreReserva["estado"] = enCloudbeds || (x.hotel_confirmo && x.pago === "pago_confirmado")
    ? "confirmada"
    : foto || x.pago !== "sin_pagar"
      ? "comprobante_recibido"
      : "pendiente_pago";

  const p: PreReserva = {
    id,
    tenant,
    clave,
    sedeId: sede.id,
    sedeNombre: sede.nombre,
    habitacionId: habitacionId || `${sede.id}-por-definir`,
    habitacionNombre,
    huesped: x.huesped,
    correo: x.correo ?? previa?.correo ?? null,
    telefono: x.telefono ?? previa?.telefono ?? null,
    desde: x.llegada,
    hasta: x.salida,
    adultos,
    ninos,
    noches: Math.max(1, Math.round((Date.parse(x.salida) - Date.parse(x.llegada)) / 86_400_000)),
    total,
    moneda: MONEDA_YALI,
    notas: [`Detectada del chat (atendió el equipo).`, x.resumen ?? "", previa?.notas ?? ""].filter(Boolean).join(" "),
    estado,
    comprobanteUrl,
    comprobanteMid: foto?.mid ?? previa?.comprobanteMid ?? null,
    comprobanteTs: foto ? foto.ts : previa?.comprobanteTs ?? null,
    vence: previa?.vence ?? null,
    confirmadaPor: estado === "confirmada" ? (enCloudbeds ? "Cloudbeds (ya ingresada por el hotel)" : "el equipo, en el chat") : previa?.confirmadaPor ?? null,
    confirmadaTs: estado === "confirmada" ? previa?.confirmadaTs ?? ahora : null,
    motivoRechazo: null,
    reservaCloudbeds: enCloudbeds?.reservationID ?? previa?.reservaCloudbeds ?? null,
    creada: previa?.creada ?? ahora,
    actualizada: ahora,
  };
  await guardarPreReserva(p);

  // La ficha del contacto y el comprobante pegado a ella.
  try {
    const [nombre, ...resto] = x.huesped.split(/\s+/);
    await upsertContacto({
      from: contactoDeClave(clave),
      nombre,
      apellido: resto.join(" ") || undefined,
      correo: x.correo || undefined,
      tenant,
      tags: estado === "confirmada" ? ["Reserva confirmada"] : undefined,
    });
    if (comprobanteUrl && comprobanteUrl.startsWith("/api/comprobantes/") && !previa?.comprobanteUrl) {
      await addAdjunto({ from: contactoDeClave(clave), tipo: "image", mime: "image/jpeg", filename: `comprobante-${id}.jpg`, caption: `Comprobante de pago · ${id} · ${x.huesped}`, ts: ahora, url: comprobanteUrl });
    }
  } catch (e) {
    console.error("[detectar-reserva] contacto:", e);
  }
  return { ok: true, reserva: p, extraido: x };
}

/** Las conversaciones de Meta con una foto del huésped en los últimos N días. */
export async function chatsConFotoReciente(tenant: string, dias: number): Promise<string[]> {
  const { getSupabase } = await import("./supabase");
  const sb = getSupabase(tenant);
  if (!sb) return [];
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await sb
    .from("meta_messages")
    .select("canal, page_id, sender_id")
    .eq("tenant", tenant)
    .eq("direction", "in")
    .like("texto", "[imagen]%")
    .gte("ts", desde)
    .limit(2000);
  if (error) {
    console.error("[detectar-reserva] chats con foto:", error.message);
    return [];
  }
  const claves = new Set<string>();
  for (const r of (data ?? []) as { canal: string; page_id: string; sender_id: string }[]) claves.add(`${r.canal}:${r.page_id}:${r.sender_id}`);
  return [...claves];
}

/**
 * Las conversaciones con señal de reserva en los últimos N días: una foto del
 * huésped, o mensajes entrantes clasificados como reserva o precio.
 */
export async function chatsConSenalDeReserva(tenant: string, dias: number): Promise<string[]> {
  const { getSupabase } = await import("./supabase");
  const sb = getSupabase(tenant);
  if (!sb) return [];
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data, error } = await sb
    .from("meta_messages")
    .select("canal, page_id, sender_id, texto, tema")
    .eq("tenant", tenant)
    .eq("direction", "in")
    .gte("ts", desde)
    .limit(5000);
  if (error) {
    console.error("[detectar-reserva] chats con señal:", error.message);
    return [];
  }
  const claves = new Set<string>();
  for (const r of (data ?? []) as { canal: string; page_id: string; sender_id: string; texto: string; tema: string | null }[]) {
    if (r.texto.startsWith("[imagen]") || r.tema === "reserva" || r.tema === "precio") claves.add(`${r.canal}:${r.page_id}:${r.sender_id}`);
  }
  return [...claves];
}

export { SEDES_YALI };
