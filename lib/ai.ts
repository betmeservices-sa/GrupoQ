import Anthropic from "@anthropic-ai/sdk";
import {
  consultarDisponibilidad,
  confirmarCita,
  type InputDisponibilidad,
  type InputConfirmar,
} from "./n8n";
import {
  consultarDisponibilidadHotel,
  reservarHabitacionSimulada,
  type InputDisponibilidadHotel,
  type InputReservaHotel,
} from "./hotel-agente";
import {
  consultarDisponibilidadYali,
  reservarHabitacionYali,
  type InputDisponibilidadYali,
  type InputReservaYali,
} from "./yali-agente";
import { activeTenant } from "./tenants/active";
import { TENANTS } from "./tenants";
import type { SucursalTenant, TenantId } from "./tenants/types";
import { contextoSucursal, interpretarSucursal } from "./sucursal-gate";
import { bloquePromociones, usaPromos } from "./promos";
import { listarPromos } from "./promos-store";
import { sumarUso, USO_CERO, type UsoTokens } from "./tokens-precios";
import type { MimeImagenIA } from "./wa-media";
import type { TipoTicket } from "./tickets";
import { areaYaliPara } from "./tickets-tenant";
import { pasarAPersona, type Traspaso } from "./pasar-a-persona";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Modelo. Haiku 4.5 es el mas rapido y barato (ideal para Vercel Hobby, donde la
// funcion topa a 10s). Cambia con AI_MODEL: "claude-sonnet-5" u "claude-opus-5".
// OJO: cada registro de consumo guarda ESTE valor, porque cambiarlo mañana
// invalidaria el calculo del historico (ver lib/tokens-store.ts).
const MODEL = process.env.AI_MODEL || "claude-haiku-4-5";

/** El modelo con el que responde el agente (lo lee el panel de consumo). */
export function modeloActivo(): string {
  return MODEL;
}

// La persona (system prompt) depende del tenant. En el webhook real se pasa el
// tenantId (derivado del phone_number_id); si no, se usa el tenant activo.
function systemPromptFor(tenantId?: TenantId): string {
  const t = tenantId && TENANTS[tenantId] ? TENANTS[tenantId] : activeTenant();
  const tags = t.tags ?? [];
  const clasificacion = tags.length
    ? `\n\nCLASIFICACIÓN Y FICHA: en cuanto entiendas qué busca el contacto, llama a la herramienta guardar_datos_contacto con el "interes" que mejor aplique de esta lista: ${tags.join(", ")}. Actualízalo si el interés cambia. Guarda también su nombre, apellido y correo apenas los mencione. Haz esto de forma natural, sin anunciar que estás "guardando datos".`
    : "";
  return t.ai.systemPrompt + clasificacion;
}

/** Imagen que el contacto mandó por WhatsApp, ya lista para el modelo. */
export interface ImagenIA {
  base64: string;
  mime: MimeImagenIA;
}

export interface TurnoIA {
  autor: "cliente" | "staff";
  texto: string;
  /** Solo en turnos del cliente: fotos que se le pasan al modelo para que las vea. */
  imagenes?: ImagenIA[];
}

interface AccionesIA {
  onGuardarContacto?: (d: {
    nombre?: string;
    apellido?: string;
    correo?: string;
    interes?: string;
  }) => Promise<void> | void;
  onReaccionar?: (emoji: string) => Promise<void> | void;
  /** El modelo dedujo a cuál sede le escribe el huésped. */
  onElegirHotel?: (sede: SucursalTenant) => Promise<void> | void;
}

// Tags de interés del tenant, para clasificar al contacto (autos en Grupo Q,
// servicios en el hospital). Se inyectan como enum en la tool guardar_datos_contacto.
function tagsFor(tenantId?: TenantId): string[] {
  const t = tenantId && TENANTS[tenantId] ? TENANTS[tenantId] : activeTenant();
  return t.tags ?? [];
}

// Herramienta de ficha del contacto. El `interes` es un enum con los tags del
// tenant, así la IA clasifica en una etiqueta válida (o ninguna).
function toolGuardarContacto(tenantId?: TenantId): Anthropic.Tool {
  return {
    name: "guardar_datos_contacto",
    description:
      "Guarda o actualiza la ficha del contacto (nombre, apellido, correo) y su INTERÉS. Llámala EN CUANTO tengas el nombre o el correo, o EN CUANTO identifiques qué busca el cliente, aunque sea a media conversación. Puedes llamarla varias veces conforme obtengas más datos.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre (de pila) del contacto, si lo dio" },
        apellido: { type: "string", description: "Apellido del contacto, si lo dio" },
        correo: { type: "string", description: "Correo electrónico del contacto, si lo dio" },
        interes: {
          type: "string",
          enum: tagsFor(tenantId),
          description:
            "La etiqueta que MEJOR resume lo que busca el cliente según lo que escribió. Elige SOLO una de la lista; si aún no está claro, omítela.",
        },
      },
    },
  };
}

// Herramientas comunes a todos los tenants. `sucursal` es opcional: Grupo Q la
// usa (salas de venta), el hospital no. La persona de cada tenant decide si la
// pide o no.
const TOOLS_BASE: Anthropic.Tool[] = [
  {
    name: "consultar_disponibilidad",
    description:
      "Consulta los espacios disponibles para agendar. Llámala cuando el contacto quiera agendar y ya tengas el motivo/modelo y una fecha preferida (y la sucursal, si aplica). Devuelve una lista de espacios libres; ofrece SOLO esos.",
    input_schema: {
      type: "object",
      properties: {
        especialidad: {
          type: "string",
          description: "Especialidad, modelo o motivo de la cita",
        },
        sucursal: {
          type: "string",
          description: "Sucursal elegida, si el tenant maneja sucursales (ej. Autopista Sur, Santa Ana)",
        },
        fecha_preferida: {
          type: "string",
          description: "Fecha preferida en formato AAAA-MM-DD (usa el contexto temporal)",
        },
        rango_dias: {
          type: "number",
          description: "Cuántos días hacia adelante buscar (por defecto 7)",
        },
      },
      required: ["especialidad", "fecha_preferida"],
    },
  },
  {
    name: "confirmar_cita",
    description:
      "Agenda y confirma la cita en un espacio devuelto por consultar_disponibilidad. Llámala SOLO después de que el contacto eligió un espacio y diste su nombre. Devuelve la confirmación.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre completo del contacto" },
        especialidad: { type: "string", description: "Especialidad, modelo o motivo de la cita" },
        sucursal: { type: "string", description: "Sucursal de la cita, si aplica" },
        fecha: { type: "string", description: "Fecha del espacio elegido (AAAA-MM-DD)" },
        hora: { type: "string", description: "Hora del espacio elegido (HH:mm)" },
        medico: { type: "string", description: "Asesor o médico del espacio, si lo indicó la disponibilidad" },
      },
      required: ["nombre", "especialidad", "fecha", "hora"],
    },
  },
  {
    name: "reaccionar",
    description:
      "Reacciona al último mensaje del contacto con un solo emoji (por ejemplo 👍, ❤️, 🙏). Úsalo con moderación, como complemento cálido; NO reemplaza tu respuesta de texto.",
    input_schema: {
      type: "object",
      properties: { emoji: { type: "string", description: "Un solo emoji" } },
      required: ["emoji"],
    },
  },
];

// Herramientas del tenant "hotel": la disponibilidad y las tarifas salen del PMS
// en vivo, y la reserva se toma en el demo (nunca se escribe en el PMS).
const TOOLS_HOTEL: Anthropic.Tool[] = [
  {
    name: "consultar_disponibilidad_hotel",
    description:
      "Consulta el sistema del hotel y devuelve las habitaciones libres con su tarifa para un rango de fechas. Llámala SIEMPRE antes de hablar de disponibilidad o de precios, en cuanto tengas llegada, salida y cuántas personas. Ofrece SOLO lo que devuelva.",
    input_schema: {
      type: "object",
      properties: {
        llegada: { type: "string", description: "Fecha de entrada en formato AAAA-MM-DD" },
        salida: { type: "string", description: "Fecha de salida en formato AAAA-MM-DD" },
        adultos: { type: "number", description: "Cuántos adultos se hospedan (mínimo 1)" },
        ninos: { type: "number", description: "Cuántos niños se hospedan (0 si no hay)" },
      },
      required: ["llegada", "salida", "adultos"],
    },
  },
  {
    name: "reservar_habitacion",
    description:
      "Toma la reserva de una habitación devuelta por consultar_disponibilidad_hotel. Llámala SOLO cuando el huésped ya eligió habitación y fechas y te dio su nombre completo. Devuelve el número de reserva.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre completo del huésped" },
        habitacion: {
          type: "string",
          description: "Nombre exacto de la habitación, tal como lo devolvió la consulta",
        },
        llegada: { type: "string", description: "Fecha de entrada en formato AAAA-MM-DD" },
        salida: { type: "string", description: "Fecha de salida en formato AAAA-MM-DD" },
        adultos: { type: "number", description: "Cuántos adultos se hospedan (mínimo 1)" },
        ninos: { type: "number", description: "Cuántos niños se hospedan (0 si no hay)" },
      },
      required: ["nombre", "habitacion", "llegada", "salida", "adultos"],
    },
  },
  {
    name: "reaccionar",
    description:
      "Reacciona al último mensaje del contacto con un solo emoji (por ejemplo 👍, ❤️, 🙏). Úsalo con moderación, como complemento cálido; NO reemplaza tu respuesta de texto.",
    input_schema: {
      type: "object",
      properties: { emoji: { type: "string", description: "Un solo emoji" } },
      required: ["emoji"],
    },
  },
];

// Herramientas del tenant "yaly" (Yali Hospitality, tres sedes). Distintas de
// las del hotel de Antigua a propósito: aquí la sede sale del contexto de la
// conversación, no del modelo, y la reserva se toma en el demo del grupo.
const TOOLS_YALI: Anthropic.Tool[] = [
  {
    name: "consultar_habitaciones",
    description:
      "Consulta las habitaciones libres de la sede del huésped, con su tarifa por noche y el total de la estadía. Llámala SIEMPRE antes de hablar de disponibilidad o de precios, en cuanto tengas llegada, salida y cuántas personas. Ofrece SOLO lo que devuelva.",
    input_schema: {
      type: "object",
      properties: {
        llegada: { type: "string", description: "Fecha de entrada en formato AAAA-MM-DD" },
        salida: { type: "string", description: "Fecha de salida en formato AAAA-MM-DD" },
        adultos: { type: "number", description: "Cuántos adultos se hospedan (mínimo 1)" },
        ninos: { type: "number", description: "Cuántos niños se hospedan (0 si no hay)" },
        sede: {
          type: "string",
          description:
            "Solo si el huésped pregunta por una sede distinta a la suya (Yalí, Costa del Surf o Playa Linda). Si se omite, se usa la sede que ya eligió.",
        },
      },
      required: ["llegada", "salida", "adultos"],
    },
  },
  {
    name: "reservar_estadia",
    description:
      "Toma la reserva de una habitación devuelta por consultar_habitaciones. Llámala SOLO cuando el huésped ya eligió habitación y fechas, te dio su nombre completo, y su comprobante de pago cuadra con el monto EXACTO de la reserva. Si el monto no cuadra, NO la llames: abre el caso con crear_ticket. Devuelve el número de reserva.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre completo del huésped" },
        habitacion: {
          type: "string",
          description: "Nombre exacto de la habitación, tal como lo devolvió la consulta",
        },
        llegada: { type: "string", description: "Fecha de entrada en formato AAAA-MM-DD" },
        salida: { type: "string", description: "Fecha de salida en formato AAAA-MM-DD" },
        adultos: { type: "number", description: "Cuántos adultos se hospedan (mínimo 1)" },
        ninos: { type: "number", description: "Cuántos niños se hospedan (0 si no hay)" },
        sede: { type: "string", description: "Solo si la reserva es en una sede distinta a la del huésped" },
        notas: {
          type: "string",
          description:
            "Lo que el hotel tiene que saber antes de que llegue: cuántos desayunos van incluidos (uno por persona, salvo en Playa Linda que no lleva), si llega de madrugada, si pidió cama extra. Va a la nota de la reserva.",
        },
      },
      required: ["nombre", "habitacion", "llegada", "salida", "adultos"],
    },
  },
  {
    name: "crear_ticket",
    description:
      "Abre un caso para que una persona del equipo lo resuelva y le dé seguimiento. Llámala SIEMPRE que el asunto se salga de lo que puedes cerrar tú: socio o interesado en la membresía, un comprobante que no cuadra, alguien que no pagó a tiempo, entrada o salida fuera de horario, un reclamo, algo olvidado o algo descompuesto. Llámala UNA sola vez por asunto. Después dile al huésped que ya quedó anotado y quién le va a escribir; nunca menciones la palabra ticket.",
    input_schema: {
      type: "object",
      properties: {
        tipo: {
          type: "string",
          description: "De qué se trata el caso",
          enum: [
            "membresia",
            "pago",
            "reserva",
            "checkin_especial",
            "queja",
            "objeto_perdido",
            "mantenimiento",
            "cotizacion",
            "informacion",
            "otro",
          ],
        },
        titulo: {
          type: "string",
          description: "Una línea que diga qué pasa, como la escribiría una persona. Ej: 'Comprobante por $100 y la reserva es de $125'",
        },
        detalle: {
          type: "string",
          description:
            "Todo lo que la persona necesita para resolverlo sin volver a preguntar: fechas, habitación, montos, qué se le dijo ya. Escríbelo en frases, no en lista.",
        },
        nombre: { type: "string", description: "Nombre del huésped, si lo dio" },
        urgente: {
          type: "boolean",
          description: "true solo si hay alguien más esperando esa misma habitación hoy, o si el huésped ya está adentro y sin servicio",
        },
      },
      required: ["tipo", "titulo", "detalle"],
    },
  },
  {
    name: "reaccionar",
    description:
      "Reacciona al último mensaje del contacto con un solo emoji (por ejemplo 👍, ❤️, 🙏). Úsalo con moderación, como complemento cálido; NO reemplaza tu respuesta de texto.",
    input_schema: {
      type: "object",
      properties: { emoji: { type: "string", description: "Un solo emoji" } },
      required: ["emoji"],
    },
  },
];

// Con esta el modelo registra a cuál sede le escribe el huésped, cuando lo
// deduce de lo que dijo. Existe porque el comparador determinista no puede con
// todo: una nota de voz transcrita como "Jalip Playel Sunsal" es obviamente
// Yalí en El Sunzal para cualquiera que lea, y no puede terminar en un menú.
function toolElegirHotel(tenantId?: TenantId): Anthropic.Tool | null {
  const t = tenantId && TENANTS[tenantId] ? TENANTS[tenantId] : activeTenant();
  const sedes = t.sucursales?.opciones;
  if (!sedes?.length) return null;
  return {
    name: "elegir_hotel",
    description:
      "Registra a cuál de nuestros hoteles le escribe el huésped. Llámala UNA vez, apenas lo sepas: te lo dijo, lo nombró aunque sea mal escrito, o quedó claro por el contexto. Es obligatoria antes de consultar disponibilidad o precios.",
    input_schema: {
      type: "object",
      properties: {
        hotel: {
          type: "string",
          description: "El hotel, tal como está escrito en la lista",
          enum: sedes.map((s) => s.nombre),
        },
      },
      required: ["hotel"],
    },
  };
}

function toolsPara(tenantId?: TenantId): Anthropic.Tool[] {
  const base =
    tenantId === "hotel" ? TOOLS_HOTEL : tenantId === "yaly" ? TOOLS_YALI : TOOLS_BASE;
  const elegir = toolElegirHotel(tenantId);
  return elegir ? [...base, elegir] : base;
}

/**
 * Bloque que se le pega al guion cuando NO sabemos a cuál sede le escribe.
 *
 * Es la respuesta a un problema real: el huésped mandó una nota de voz diciendo
 * el nombre del hotel, la transcripción lo escribió mal y el agente le contestó
 * "responda A, B o C" ignorando las fechas que acababa de dar. Eso no es un
 * agente, es un formulario.
 */
function contextoPedirSede(tenantId?: TenantId): string {
  const t = tenantId && TENANTS[tenantId] ? TENANTS[tenantId] : activeTenant();
  const sedes = t.sucursales?.opciones;
  if (!sedes?.length) return "";
  const lista = sedes.map((s) => s.nombre).join(" · ");
  return `

TODAVÍA NO SABEMOS A CUÁL HOTEL LE ESCRIBE (vale solo para este turno)
Nuestros hoteles: ${lista}.
1. Si por lo que dijo se entiende de cuál habla, AUNQUE VENGA MAL ESCRITO O MAL TRANSCRITO (por ejemplo "Jalip Playel Sunsal" es Yalí, Playa El Sunzal), dalo por bueno: llama a "elegir_hotel" y sigue la conversación normal, confirmándolo de paso en tu respuesta.
2. Si de verdad no se entiende, PRIMERO responde o acusa recibo de lo que te preguntó, y después pide el hotel dentro de la misma frase, con naturalidad.
3. PROHIBIDO mandarle una lista de opciones, pedirle que conteste con una letra, o ignorar lo que acaba de decir para preguntar otra cosa.
4. No des disponibilidad ni precios hasta saber el hotel.`;
}

// Zona horaria del negocio de cada tenant. Guatemala y El Salvador comparten
// UTC-6 sin horario de verano, pero el prompt debe nombrar la del cliente.
function zonaDe(tenantId?: TenantId): { tz: string; etiqueta: string } {
  return tenantId === "hotel"
    ? { tz: "America/Guatemala", etiqueta: "Guatemala" }
    : { tz: "America/El_Salvador", etiqueta: "El Salvador" };
}

/** Hoy (AAAA-MM-DD) en la zona del negocio, para vencer promociones a tiempo. */
function hoyDeTenant(tenantId?: TenantId): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaDe(tenantId).tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Las promociones que el cliente tiene encendidas AHORA. Se leen en cada
 * respuesta a propósito: apagar una promo tiene que sacarla de la conversación
 * al instante, sin volver a desplegar.
 *
 * Si la lectura falla, se manda el bloque de "ninguna". Un error de base nunca
 * puede terminar en el agente inventando una oferta.
 */
async function contextoPromociones(tenantId?: TenantId): Promise<string> {
  const tenant = tenantId ?? activeTenant().id;
  if (!usaPromos(tenant)) return "";
  const hoy = hoyDeTenant(tenantId);
  try {
    return bloquePromociones(await listarPromos(tenant), hoy);
  } catch (err) {
    console.error("promociones para el guion:", err);
    return bloquePromociones([], hoy);
  }
}

// Fecha y hora actual del negocio, para que la IA agende con sentido (no
// ofrezca dias/horas que ya pasaron). Se recalcula en cada llamada.
function contextoTemporal(tenantId?: TenantId): string {
  const { tz, etiqueta } = zonaDe(tenantId);
  const ahora = new Date();
  const fecha = new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(ahora);
  const hora = new Intl.DateTimeFormat("es-ES", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ahora);
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  return `CONTEXTO TEMPORAL (zona horaria ${etiqueta}, UTC-6): hoy es ${fecha} (${iso}) y son las ${hora}. Usa SIEMPRE esta fecha y hora como referencia. Ofrece SOLO dias y horas FUTUROS (de hoy en adelante; si propones hoy, que sea despues de la hora actual y dentro del horario). Nunca ofrezcas un dia u hora que ya paso. Al proponer un dia, menciona el dia de la semana y la fecha, por ejemplo "el lunes 29 a las 10:00 a.m.".`;
}

// Ejecuta UNA herramienta y devuelve lo que se le entrega de vuelta al modelo.
// Está separada del bucle para poder probarla sin gastar una llamada al modelo.
export async function ejecutarHerramienta(
  nombre: string,
  input: unknown,
  acciones?: AccionesIA,
  contexto?: {
    telefono?: string;
    tenantId?: TenantId;
    sucursal?: SucursalTenant | null;
    pedirSede?: boolean;
  },
): Promise<string> {
  if (nombre === "guardar_datos_contacto") {
    await acciones?.onGuardarContacto?.(
      input as { nombre?: string; apellido?: string; correo?: string; interes?: string },
    );
    return "Listo.";
  }
  if (nombre === "elegir_hotel") {
    const t = contexto?.tenantId && TENANTS[contexto.tenantId] ? TENANTS[contexto.tenantId] : activeTenant();
    const pedido = (input as { hotel?: string }).hotel ?? "";
    const sede =
      t.sucursales?.opciones.find((o) => o.nombre === pedido) ??
      (t.sucursales ? interpretarSucursal(pedido, t.sucursales) : null);
    if (!sede) return JSON.stringify({ error: "No reconocimos ese hotel." });
    await acciones?.onElegirHotel?.(sede);
    // Se fija en el contexto para que las herramientas que vengan DESPUÉS en
    // este mismo turno (cotizar, reservar) ya sepan de qué sede hablan.
    if (contexto) contexto.sucursal = sede;
    return JSON.stringify({ ok: true, hotel: sede.nombre });
  }
  if (nombre === "reaccionar") {
    const emoji = (input as { emoji?: string }).emoji;
    if (emoji) await acciones?.onReaccionar?.(emoji);
    return "Listo.";
  }
  if (nombre === "consultar_disponibilidad") {
    const r = await consultarDisponibilidad({
      ...(input as InputDisponibilidad),
      telefono: contexto?.telefono,
    });
    return JSON.stringify(r.ok ? r.data : { error: r.error ?? "no disponible" });
  }
  if (nombre === "confirmar_cita") {
    const r = await confirmarCita({
      ...(input as InputConfirmar),
      telefono: contexto?.telefono,
    });
    return JSON.stringify(r.ok ? r.data : { error: r.error ?? "no se pudo agendar" });
  }
  if (nombre === "consultar_disponibilidad_hotel") {
    // Lectura REAL del sistema de reservas del hotel.
    return JSON.stringify(await consultarDisponibilidadHotel(input as InputDisponibilidadHotel));
  }
  if (nombre === "reservar_habitacion") {
    // Reserva SIMULADA: se guarda en el demo, nunca en el PMS.
    return JSON.stringify(
      await reservarHabitacionSimulada({
        ...(input as InputReservaHotel),
        telefono: contexto?.telefono,
      }),
    );
  }
  // Yali Hospitality: la sede sale del contexto de la conversación (el sistema
  // ya se la preguntó al huésped), no de lo que suponga el modelo.
  if (nombre === "consultar_habitaciones") {
    return JSON.stringify(
      await consultarDisponibilidadYali(
        input as InputDisponibilidadYali,
        contexto?.sucursal?.id ?? null,
      ),
    );
  }
  if (nombre === "crear_ticket") {
    const t = input as {
      tipo?: TipoTicket;
      titulo?: string;
      detalle?: string;
      nombre?: string;
      urgente?: boolean;
    };
    const tenant = contexto?.tenantId ?? "yaly";
    try {
      // Se carga aquí y no arriba a propósito: el store de tickets arrastra el
      // cliente de Supabase, y este archivo es el que se importa en cada
      // mensaje que entra. Solo lo paga la conversación que abre un caso.
      const { crearTicket } = await import("./tickets-store");
      const ticket = await crearTicket(tenant, {
        titulo: (t.titulo ?? "").trim() || "Caso sin título",
        detalle: (t.detalle ?? "").trim(),
        tipo: t.tipo ?? "otro",
        prioridad: t.urgente ? "urgente" : undefined,
        origen: "chat",
        creadoPor: "Sofía",
        contactoNombre: (t.nombre ?? "").trim() || "Sin nombre",
        contactoTelefono: contexto?.telefono,
        area: areaYaliPara(t.tipo ?? "otro", contexto?.sucursal?.id ?? null),
      });
      // Un socio no se atiende con un ticket y ya: hay que SALIR del chat.
      //
      // Antes solo se abria el caso. Olga recibia el ticket mientras Sofia
      // seguia conversando con el socio, asi que el socio hablaba con la
      // maquina y con Olga a la vez, y con precios distintos.
      let traspaso: Traspaso | null = null;
      if (t.tipo === "membresia" || t.tipo === "pago" || t.tipo === "queja") {
        const motivo = t.tipo === "membresia" ? "socio" : t.tipo === "pago" ? "pago" : "reclamo";
        traspaso = await pasarAPersona(contexto?.telefono ?? "", motivo, ticket.area);
      }

      return JSON.stringify({
        ok: true,
        numero: ticket.numero,
        area: ticket.area,
        // Si el traspaso fallo, el modelo NO puede decir que alguien le va a
        // escribir: prometer seguimiento que nadie va a ver es peor que no
        // ofrecerlo.
        pasado_a_persona: traspaso ? traspaso.ok : false,
      });
    } catch (e) {
      // Si el caso no se pudo anotar, el modelo NO puede decir que quedó
      // anotado: prometer seguimiento que nadie va a ver es peor que no
      // ofrecerlo. Se lo decimos para que ofrezca pasar con una persona.
      console.error("crear_ticket:", e);
      return JSON.stringify({ ok: false, error: "No se pudo abrir el caso." });
    }
  }
  if (nombre === "reservar_estadia") {
    return JSON.stringify(
      await reservarHabitacionYali(
        { ...(input as InputReservaYali), telefono: contexto?.telefono },
        contexto?.sucursal?.id ?? null,
      ),
    );
  }
  return "Listo.";
}

// Herramientas que ve el modelo para un tenant (se exporta para poder probar el
// cableado sin llamar al modelo).
export function herramientasDeTenant(tenantId?: TenantId): string[] {
  return [toolGuardarContacto(tenantId), ...toolsPara(tenantId)].map((t) => t.name);
}

// Arma el contenido de un turno del cliente. Con imágenes, primero los bloques
// `image` y después el texto: es el orden que recomienda Anthropic, porque el
// modelo responde mejor cuando ve la foto antes de leer la pregunta.
function contenidoDeTurno(t: TurnoIA): Anthropic.MessageParam["content"] {
  const texto = t.texto || "[imagen]"; // la API rechaza un bloque de texto vacío
  if (!t.imagenes || t.imagenes.length === 0) return texto;
  const bloques: Anthropic.ContentBlockParam[] = t.imagenes.map((img) => ({
    type: "image",
    source: { type: "base64", media_type: img.mime, data: img.base64 },
  }));
  bloques.push({ type: "text", text: texto });
  return bloques;
}

function sinImagenes(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === "string") return m;
    const limpio = m.content.filter((b) => b.type !== "image");
    // El bloque de texto siempre viaja junto a la imagen (ver contenidoDeTurno),
    // así que `limpio` nunca queda vacío; el fallback es solo defensivo.
    return { ...m, content: limpio.length ? limpio : "[imagen]" };
  });
}

/**
 * Cuántos tokens aportan las IMÁGENES de un envío.
 *
 * Las imágenes no se facturan aparte: entran como tokens de entrada y quedan
 * mezcladas con el texto en `usage.input_tokens`. Para poder separarlas (que es
 * justo lo que se quiere ver en el dashboard) se cuenta el MISMO contenido dos
 * veces con count_tokens, con y sin los bloques de imagen, y se resta.
 *
 * A propósito NO se estima con tiktoken ni por caracteres: subestima los tokens
 * de Claude. Si count_tokens falla, se devuelve 0 y el turno se contabiliza
 * entero como texto (nunca se inventa un número).
 */
async function medirTokensImagen(
  system: string,
  tools: Anthropic.Tool[],
  messages: Anthropic.MessageParam[],
): Promise<number> {
  const hayImagen = messages.some(
    (m) => typeof m.content !== "string" && m.content.some((b) => b.type === "image"),
  );
  if (!hayImagen) return 0;
  try {
    const [con, sin] = await Promise.all([
      client.messages.countTokens({ model: MODEL, system, tools, messages }),
      client.messages.countTokens({
        model: MODEL,
        system,
        tools,
        messages: sinImagenes(messages),
      }),
    ]);
    return Math.max(con.input_tokens - sin.input_tokens, 0);
  } catch (e) {
    console.error("IA: no se pudo medir el peso de la imagen", e);
    return 0;
  }
}

// El `usage` de la API trae los campos de caché como `number | null` (null =
// no se usó caché en esa llamada). Se normaliza a 0 aquí para que el resto del
// sistema trabaje siempre con los cuatro números.
function usoDeRespuesta(u: Anthropic.Usage): UsoTokens {
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
  };
}

export interface RespuestaIA {
  texto: string;
  /** `usage` acumulado de todas las llamadas del turno (los cuatro campos). */
  uso: UsoTokens;
  /** Modelo con el que se generó. Se guarda con el consumo, no se infiere después. */
  modelo: string;
  /** Llamadas al modelo que hizo este turno (el bucle de herramientas puede dar varias). */
  llamadas: number;
  /** Tokens de entrada que aportaron las imágenes en TODO el turno. */
  tokensImagen: number;
  /** Cuántas imágenes se le pasaron al modelo. */
  imagenes: number;
}

// Genera la respuesta de la IA. Usa tool use para guardar datos del contacto y
// para reaccionar; ejecuta esas acciones vía los callbacks de `acciones`.
// Devuelve también el consumo, porque es el único punto donde se conoce.
export async function generarRespuesta(
  historial: TurnoIA[],
  acciones?: AccionesIA,
  contexto?: {
    telefono?: string;
    tenantId?: TenantId;
    sucursal?: SucursalTenant | null;
    /** true = no sabemos la sede y el modelo tiene que resolverla este turno. */
    pedirSede?: boolean;
  },
): Promise<RespuestaIA> {
  const messages: Anthropic.MessageParam[] = historial.map((t) => ({
    role: t.autor === "cliente" ? "user" : "assistant",
    content: contenidoDeTurno(t),
  }));

  const system = `${systemPromptFor(contexto?.tenantId)}${contextoSucursal(
    contexto?.sucursal ?? null,
  )}${contexto?.pedirSede ? contextoPedirSede(contexto?.tenantId) : ""}${await contextoPromociones(contexto?.tenantId)}\n\n${contextoTemporal(contexto?.tenantId)}`;
  const tools: Anthropic.Tool[] = [
    toolGuardarContacto(contexto?.tenantId),
    ...toolsPara(contexto?.tenantId),
  ];

  const imagenes = historial.reduce((n, t) => n + (t.imagenes?.length ?? 0), 0);
  // Se mide UNA vez, sobre el envío inicial. Las imágenes se quedan en
  // `messages` durante todo el bucle de herramientas, así que viajan (y se
  // cobran) en cada llamada: por eso al final se multiplica por `llamadas`.
  const tokensImagenPorLlamada = await medirTokensImagen(system, tools, messages);

  let uso: UsoTokens = { ...USO_CERO };
  let llamadas = 0;
  let texto = "";

  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system,
      tools,
      messages,
    });
    llamadas++;
    uso = sumarUso(uso, usoDeRespuesta(res.usage));

    const t = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (t) texto = t;

    const toolUses = res.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) break;

    messages.push({ role: "assistant", content: res.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      let contenido: string;
      try {
        contenido = await ejecutarHerramienta(tu.name, tu.input, acciones, contexto);
      } catch (err) {
        console.error("IA tool error:", err);
        contenido = JSON.stringify({ error: "fallo la herramienta" });
      }
      resultados.push({ type: "tool_result", tool_use_id: tu.id, content: contenido });
    }
    messages.push({ role: "user", content: resultados });
  }

  return {
    texto: texto || "Disculpe, ¿me lo puede repetir por favor?",
    uso,
    modelo: MODEL,
    llamadas,
    tokensImagen: tokensImagenPorLlamada * Math.max(llamadas, 1),
    imagenes,
  };
}
