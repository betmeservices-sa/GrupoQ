import Anthropic from "@anthropic-ai/sdk";
import {
  consultarDisponibilidad,
  confirmarCita,
  type InputDisponibilidad,
  type InputConfirmar,
} from "./n8n";
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
  if (tenantId && TENANTS[tenantId]) return TENANTS[tenantId].ai.systemPrompt;
  return activeTenant().ai.systemPrompt;
}

export interface TurnoIA {
  autor: "cliente" | "staff";
  texto: string;
}

interface AccionesIA {
  onGuardarContacto?: (d: { nombre?: string; correo?: string }) => Promise<void> | void;
  onReaccionar?: (emoji: string) => Promise<void> | void;
}

// Herramientas comunes a todos los tenants. `sucursal` es opcional: Grupo Q la
// usa (salas de venta), el hospital no. La persona de cada tenant decide si la
// pide o no.
const TOOLS: Anthropic.Tool[] = [
  {
    name: "guardar_datos_contacto",
    description:
      "Guarda o actualiza la ficha del contacto. Llámala en cuanto mencione su nombre completo o su correo electrónico, aunque sea a media conversación.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre completo del contacto, si lo dio" },
        correo: { type: "string", description: "Correo electrónico del contacto, si lo dio" },
      },
    },
  },
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

// Fecha y hora actual en El Salvador, para que la IA agende con sentido (no
// ofrezca dias/horas que ya pasaron). Se recalcula en cada llamada.
function contextoTemporal(): string {
  const ahora = new Date();
  const fecha = new Intl.DateTimeFormat("es-ES", {
    timeZone: "America/El_Salvador",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(ahora);
  const hora = new Intl.DateTimeFormat("es-ES", {
    timeZone: "America/El_Salvador",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ahora);
  return `CONTEXTO TEMPORAL (zona horaria El Salvador, UTC-6): hoy es ${fecha} y son las ${hora}. Usa SIEMPRE esta fecha y hora como referencia para agendar. Ofrece SOLO dias y horas FUTUROS (de hoy en adelante; si propones hoy, que sea despues de la hora actual y dentro del horario). Nunca ofrezcas un dia u hora que ya paso. Al proponer un dia, menciona el dia de la semana y la fecha, por ejemplo "el lunes 29 a las 10:00 a.m.".`;
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

  let texto = "";
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: `${systemPrompt}\n\n${contextoTemporal()}`,
      tools: TOOLS,
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
      let contenido = "Listo.";
      try {
        if (tu.name === "guardar_datos_contacto") {
          await acciones?.onGuardarContacto?.(tu.input as { nombre?: string; correo?: string });
        } else if (tu.name === "reaccionar") {
          const emoji = (tu.input as { emoji?: string }).emoji;
          if (emoji) await acciones?.onReaccionar?.(emoji);
        } else if (tu.name === "consultar_disponibilidad") {
          const inp = tu.input as InputDisponibilidad;
          const r = await consultarDisponibilidad({ ...inp, telefono: contexto?.telefono });
          contenido = JSON.stringify(r.ok ? r.data : { error: r.error ?? "no disponible" });
        } else if (tu.name === "confirmar_cita") {
          const inp = tu.input as InputConfirmar;
          const r = await confirmarCita({ ...inp, telefono: contexto?.telefono });
          contenido = JSON.stringify(r.ok ? r.data : { error: r.error ?? "no se pudo agendar" });
        }
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
