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
import { activeTenant } from "./tenants/active";
import { TENANTS } from "./tenants";
import type { TenantId } from "./tenants/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Modelo. Haiku 4.5 es el mas rapido y barato (ideal para Vercel Hobby, donde la
// funcion topa a 10s). Cambia con AI_MODEL: "claude-sonnet-4-6" u "claude-opus-4-8".
const MODEL = process.env.AI_MODEL || "claude-haiku-4-5";

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

export interface TurnoIA {
  autor: "cliente" | "staff";
  texto: string;
}

interface AccionesIA {
  onGuardarContacto?: (d: {
    nombre?: string;
    apellido?: string;
    correo?: string;
    interes?: string;
  }) => Promise<void> | void;
  onReaccionar?: (emoji: string) => Promise<void> | void;
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

function toolsPara(tenantId?: TenantId): Anthropic.Tool[] {
  return tenantId === "hotel" ? TOOLS_HOTEL : TOOLS_BASE;
}

// Zona horaria del negocio de cada tenant. Guatemala y El Salvador comparten
// UTC-6 sin horario de verano, pero el prompt debe nombrar la del cliente.
function zonaDe(tenantId?: TenantId): { tz: string; etiqueta: string } {
  return tenantId === "hotel"
    ? { tz: "America/Guatemala", etiqueta: "Guatemala" }
    : { tz: "America/El_Salvador", etiqueta: "El Salvador" };
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
  contexto?: { telefono?: string },
): Promise<string> {
  if (nombre === "guardar_datos_contacto") {
    await acciones?.onGuardarContacto?.(
      input as { nombre?: string; apellido?: string; correo?: string; interes?: string },
    );
    return "Listo.";
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
  return "Listo.";
}

// Herramientas que ve el modelo para un tenant (se exporta para poder probar el
// cableado sin llamar al modelo).
export function herramientasDeTenant(tenantId?: TenantId): string[] {
  return [toolGuardarContacto(tenantId), ...toolsPara(tenantId)].map((t) => t.name);
}

// Genera la respuesta de la IA. Usa tool use para guardar datos del contacto y
// para reaccionar; ejecuta esas acciones vía los callbacks de `acciones`.
export async function generarRespuesta(
  historial: TurnoIA[],
  acciones?: AccionesIA,
  contexto?: { telefono?: string; tenantId?: TenantId },
): Promise<string> {
  const messages: Anthropic.MessageParam[] = historial.map((t) => ({
    role: t.autor === "cliente" ? "user" : "assistant",
    content: t.texto,
  }));

  const systemPrompt = systemPromptFor(contexto?.tenantId);
  const tools: Anthropic.Tool[] = [
    toolGuardarContacto(contexto?.tenantId),
    ...toolsPara(contexto?.tenantId),
  ];

  let texto = "";
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: `${systemPrompt}\n\n${contextoTemporal(contexto?.tenantId)}`,
      tools,
      messages,
    });

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

  return texto || "Disculpe, ¿me lo puede repetir por favor?";
}
