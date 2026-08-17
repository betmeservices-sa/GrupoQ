// La pieza que convierte una llamada en una ficha actualizada.
//
// Después de cada llamada llega un transcript. Un gestor humano lo leería y
// movería la tarjeta: "prometió pagar 150 el viernes", "dice que ya pagó",
// "número equivocado". Eso es lo que hace este módulo con Claude, y lo hace con
// SALIDA ESTRUCTURADA (output_config.format): el modelo no devuelve un párrafo
// que después hay que interpretar, devuelve el JSON exacto que la ficha
// necesita, validado contra un esquema.
//
// El archivo está partido en dos a propósito:
//   - analizarLlamada: habla con el modelo (impura, cuesta dinero).
//   - aplicarAnalisis: mueve la ficha (pura, se prueba sin gastar un token).
// Así la regla de negocio (cuándo una cuenta pasa a "promesa de pago", cuándo
// se deja de llamar) se puede probar entera sin red.
//
// SOLO SERVIDOR: importa la llave de Anthropic.

import Anthropic from "@anthropic-ai/sdk";
import {
  RESULTADO_NOMBRE,
  type Deudor,
  type Gestion,
  type NivelRiesgo,
  type ProximaAccion,
  type ProximaAccionTipo,
  type ResultadoLlamada,
  type Sentimiento,
} from "./cobros-tipos";
import { diasEntre, hoyEnSv } from "./cobros-cartera";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Opus 5 por defecto: la clasificación decide si una cuenta deja de recibir
// llamadas, y equivocarse ahí es caro de otra forma. Para una base de 10,000 en
// la que el costo por llamada manda, se baja con COBROS_AI_MODEL (por ejemplo
// claude-haiku-4-5) sin tocar código.
const MODELO = process.env.COBROS_AI_MODEL || "claude-opus-5";

const RESULTADOS = Object.keys(RESULTADO_NOMBRE) as ResultadoLlamada[];

// El esquema es el contrato. Cada objeto lleva additionalProperties:false, que
// es lo que exige la salida estructurada; los campos que pueden faltar (una
// llamada sin promesa no tiene monto ni fecha) quedan fuera de `required`.
const ESQUEMA_ANALISIS = {
  type: "object",
  additionalProperties: false,
  properties: {
    resultado: {
      type: "string",
      enum: RESULTADOS,
      description: "Cómo terminó la llamada desde el punto de vista del cobro.",
    },
    resumen: {
      type: "string",
      description:
        "Una o dos frases, en español, con lo que pasó y lo que el cliente dijo. Es lo que lee el gestor antes de volver a marcar.",
    },
    sentimiento: {
      type: "string",
      enum: ["cooperativo", "neutral", "evasivo", "molesto"],
      description: "Actitud del cliente durante la llamada.",
    },
    riesgo: {
      type: "string",
      enum: ["bajo", "medio", "alto"],
      description:
        "Riesgo de que la cuenta NO se recupere, según lo que dijo el cliente y su disposición.",
    },
    promesa: {
      type: "object",
      additionalProperties: false,
      description:
        "Solo si el cliente se comprometió a un monto y una fecha concretos. Si dijo 'la otra semana' sin fecha, no la inventes: omite este objeto.",
      properties: {
        monto: { type: "number", description: "Monto en dólares que se comprometió a pagar." },
        fecha: { type: "string", description: "Fecha comprometida en formato AAAA-MM-DD." },
      },
      required: ["monto", "fecha"],
    },
    proximaAccion: {
      type: "object",
      additionalProperties: false,
      properties: {
        tipo: {
          type: "string",
          enum: [
            "recontactar",
            "esperar_pago",
            "enviar_convenio",
            "escalar_humano",
            "escalar_legal",
            "cerrar",
            "sacar_de_campana",
          ],
        },
        cuando: {
          type: "string",
          description: "Fecha sugerida en formato AAAA-MM-DD, si la acción tiene fecha.",
        },
        nota: { type: "string", description: "Una línea con el porqué de la acción." },
      },
      required: ["tipo"],
    },
    datosNuevos: {
      type: "object",
      additionalProperties: false,
      description: "Datos de contacto que el cliente dio durante la llamada.",
      properties: {
        telefonoAlterno: { type: "string" },
        correo: { type: "string" },
      },
    },
    alerta: {
      type: "object",
      additionalProperties: false,
      description:
        "Solo si en la llamada pasó algo que un supervisor tiene que revisar: el agente prometió algo que el banco no puede cumplir, amenazó, habló de la deuda con un tercero, o el cliente pidió expresamente que no lo llamen más.",
      properties: {
        motivo: { type: "string" },
      },
      required: ["motivo"],
    },
  },
  required: ["resultado", "resumen", "sentimiento", "riesgo"],
} as const;

export interface AnalisisLlamada {
  resultado: ResultadoLlamada;
  resumen: string;
  sentimiento: Sentimiento;
  riesgo: NivelRiesgo;
  promesa?: { monto: number; fecha: string };
  proximaAccion?: ProximaAccion;
  datosNuevos?: { telefonoAlterno?: string; correo?: string };
  alerta?: { motivo: string };
}

const SYSTEM = `Eres el analista de cobranza de Banco Promerica. Lees la transcripción de una llamada de cobro que hizo un agente de voz y la conviertes en la actualización de la ficha del cliente.

QUÉ SE ESPERA DE TI
Precisión, no optimismo. La ficha que produces decide si a esta persona se le vuelve a llamar, si se le manda un convenio o si el caso se escala. Un dato inflado cuesta una promesa rota; un dato inventado cuesta un cliente.

REGLAS DURAS
1. Solo registras lo que está EN la transcripción. Si el cliente no dijo un monto, no hay monto. Si no dio una fecha concreta, no hay promesa de pago: eso es "quiere_negociar" o "pidio_recontacto", no "promesa_pago".
2. "La otra semana", "cuando me paguen" o "ahí veo" NO son fechas. Solo pones fecha cuando el cliente dijo un día que se puede escribir en el calendario.
3. Si el cliente dice que ya pagó, el resultado es "ya_pago" aunque el sistema muestre saldo: quien verifica el pago es el banco, no tú. Déjalo anotado en el resumen.
4. Si quien contestó NO es el titular, el resultado es "contesto_tercero" o "numero_equivocado". Nunca registres una promesa que hizo un tercero.
5. Si el cliente pide que no lo llamen más, el resultado es "solicita_no_llamar" y levantas alerta. Eso cierra la cuenta para las campañas.
6. Levantas alerta también si el agente amenazó, presionó de forma indebida, le contó la deuda a un tercero, o prometió condonar, rebajar o refinanciar algo sin que eso esté autorizado.

EL RESUMEN
Una o dos frases en español salvadoreño neutro, en tercera persona, con lo concreto: qué dijo el cliente, qué se acordó y qué falta. Nada de relleno ni de repetir la etiqueta que ya pusiste en "resultado".

RIESGO
- bajo: se comprometió con fecha y monto, o ya pagó.
- medio: quiere resolver pero no puede todavía, o pidió que lo llamen después.
- alto: no puede pagar, evade, reclama la deuda, o no se logró contactar al titular.

FORMATO
Devuelves únicamente el JSON del esquema. Sin texto alrededor.`;

/**
 * Traduce el error del SDK a algo que un gestor pueda leer.
 *
 * El SDK trae el JSON crudo de la API en `message`, y eso terminaba pintado tal
 * cual en la ficha del cliente. El gestor no puede hacer nada con
 * `{"type":"error","error":{...}}`; sí puede hacer algo con "se acabó el saldo".
 */
export function mensajeDeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "La llave de Anthropic no es válida. Revisá ANTHROPIC_API_KEY.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Se alcanzó el límite de peticiones. Volvé a intentar en un momento.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "No se pudo conectar con la API de Anthropic.";
  }
  if (err instanceof Anthropic.APIError) {
    const detalle = (err.error as { error?: { message?: string } } | undefined)?.error?.message;
    if (detalle?.includes("credit balance")) {
      return "La cuenta de Anthropic se quedó sin saldo, así que el análisis no corrió.";
    }
    return detalle || `La API de Anthropic respondió ${err.status}.`;
  }
  return err instanceof Error ? err.message : "No se pudo analizar la llamada.";
}

/** Convierte un fin de llamada de la telefonía en un resultado, sin modelo. */
export function resultadoDeEndedReason(reason?: string): ResultadoLlamada | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  if (r.includes("no-answer") || r.includes("noanswer")) return "no_contesto";
  if (r.includes("busy")) return "no_contesto";
  if (r.includes("voicemail") || r.includes("machine")) return "no_contesto";
  if (r.includes("customer-did-not-answer")) return "no_contesto";
  if (r.includes("customer-ended-call")) return null; // sí habló: hay que leer el transcript
  return null;
}

/**
 * Lee el transcript y devuelve la actualización de la ficha.
 *
 * Devuelve null cuando no hay nada que leer (llamada que no conectó): ahí el
 * resultado sale del motivo de corte, no del modelo, y no se gasta una llamada
 * al modelo por cada número que no contestó, que en una base de 10,000 es la
 * mayoría.
 */
export async function analizarLlamada(params: {
  deudor: Pick<
    Deudor,
    "nombre" | "producto" | "montoVencido" | "saldoTotal" | "cuotaMensual" | "diasMora" | "cuenta"
  >;
  transcript: string;
  duracionSeg?: number;
  endedReason?: string;
}): Promise<AnalisisLlamada | null> {
  const texto = (params.transcript ?? "").trim();
  if (texto.length < 20) return null;

  const { deudor } = params;
  const contexto = [
    `Cliente: ${deudor.nombre}`,
    `Producto: ${deudor.producto}`,
    `Cuenta: ${deudor.cuenta}`,
    `Saldo total: $${deudor.saldoTotal.toFixed(2)}`,
    `Monto vencido: $${deudor.montoVencido.toFixed(2)}`,
    `Cuota mensual: $${deudor.cuotaMensual.toFixed(2)}`,
    `Días de mora: ${deudor.diasMora}`,
    `Duración de la llamada: ${params.duracionSeg ?? 0} segundos`,
    `Motivo de corte de la telefonía: ${params.endedReason ?? "desconocido"}`,
    `Hoy es ${hoyEnSv()} (usa esta fecha para resolver "el viernes", "el 15" y demás).`,
  ].join("\n");

  let res: Anthropic.Message;
  try {
    res = await client.messages.create({
      model: MODELO,
      max_tokens: 2000,
      // Clasificar un transcript corto no necesita razonamiento profundo, y el
      // esfuerzo es el freno de costo que sí funciona en un lote de 10,000.
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_ANALISIS } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `DATOS DE LA CUENTA\n${contexto}\n\nTRANSCRIPCIÓN DE LA LLAMADA\n${texto}`,
        },
      ],
    });
  } catch (err) {
    throw new Error(mensajeDeError(err));
  }

  // El rechazo llega con HTTP 200 y content vacío: leer content[0] sin mirar
  // stop_reason revienta justo cuando el sistema tiene que seguir funcionando.
  if (res.stop_reason === "refusal") {
    throw new Error("El modelo declinó analizar esta llamada.");
  }

  const json = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  if (!json) return null;

  try {
    return JSON.parse(json) as AnalisisLlamada;
  } catch {
    throw new Error("El análisis no vino en el formato esperado.");
  }
}

// ── La parte pura: cómo se mueve la ficha ──

function nuevoId(p: string): string {
  return `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Qué estado le corresponde a la cuenta según cómo terminó la llamada. Es la
// tabla de decisión del módulo: si algo del tablero se ve raro, se arregla acá.
const ESTADO_POR_RESULTADO: Record<ResultadoLlamada, Deudor["estado"] | null> = {
  promesa_pago: "promesa_pago",
  ya_pago: "pagado",
  pago_parcial: "pago_parcial",
  no_puede_pagar: "en_gestion",
  quiere_negociar: "negociacion",
  disputa: "disputa",
  numero_equivocado: "ilocalizable",
  contesto_tercero: "en_gestion",
  no_contesto: "en_gestion",
  colgo: "en_gestion",
  pidio_recontacto: "en_gestion",
  solicita_no_llamar: "no_contactar",
  sin_clasificar: null,
};

// Resultados tras los cuales la cuenta deja de entrar a las campañas. "Pagado"
// y "no contactar" son obvios; "ilocalizable" evita seguir marcando un número
// que ya se sabe que no es de esta persona.
const CIERRA_LLAMADAS: ResultadoLlamada[] = ["ya_pago", "solicita_no_llamar", "numero_equivocado"];

const ACCION_POR_RESULTADO: Record<ResultadoLlamada, ProximaAccionTipo> = {
  promesa_pago: "esperar_pago",
  ya_pago: "cerrar",
  pago_parcial: "recontactar",
  no_puede_pagar: "enviar_convenio",
  quiere_negociar: "enviar_convenio",
  disputa: "escalar_humano",
  numero_equivocado: "sacar_de_campana",
  contesto_tercero: "recontactar",
  no_contesto: "recontactar",
  colgo: "recontactar",
  pidio_recontacto: "recontactar",
  solicita_no_llamar: "sacar_de_campana",
  sin_clasificar: "recontactar",
};

/**
 * Aplica el análisis a la ficha y devuelve el deudor actualizado.
 *
 * No muta: devuelve una copia. Y no borra historia: la gestión se antepone a
 * las anteriores, así la tarjeta siempre muestra por qué está donde está.
 */
export function aplicarAnalisis(
  deudor: Deudor,
  analisis: AnalisisLlamada,
  ctx: {
    ahora: Date;
    hoy?: string;
    callId?: string;
    campanaId?: string;
    duracionSeg?: number;
    transcript?: string;
    grabacionUrl?: string;
  },
): Deudor {
  const iso = ctx.ahora.toISOString();
  const hoy = ctx.hoy ?? hoyEnSv(ctx.ahora);

  const gestion: Gestion = {
    id: nuevoId("g"),
    tipo: "llamada",
    cuando: iso,
    autor: "ia",
    resumen: analisis.resumen,
    resultado: analisis.resultado,
    duracionSeg: ctx.duracionSeg,
    callId: ctx.callId,
    campanaId: ctx.campanaId,
    transcript: ctx.transcript,
    grabacionUrl: ctx.grabacionUrl,
  };

  const estado = ESTADO_POR_RESULTADO[analisis.resultado] ?? deudor.estado;

  // Una promesa con fecha ya pasada no es una promesa: es un dato mal leído.
  // Antes de guardarla se descarta, para que el tablero no muestre promesas
  // vigentes que nacieron vencidas.
  const promesaValida =
    analisis.promesa && diasEntre(hoy, analisis.promesa.fecha) >= 0
      ? {
          monto: analisis.promesa.monto,
          fecha: analisis.promesa.fecha,
          registrada: iso,
          origen: "ia" as const,
        }
      : undefined;

  const accion: ProximaAccion = analisis.proximaAccion ?? {
    tipo: ACCION_POR_RESULTADO[analisis.resultado],
  };

  return {
    ...deudor,
    estado,
    riesgo: analisis.riesgo,
    sentimiento: analisis.sentimiento,
    promesa: promesaValida ?? deudor.promesa,
    proximaAccion: accion,
    resumenIa: analisis.resumen,
    telefonoAlterno: analisis.datosNuevos?.telefonoAlterno ?? deudor.telefonoAlterno,
    correo: analisis.datosNuevos?.correo ?? deudor.correo,
    etiquetas: analisis.alerta
      ? Array.from(new Set([...deudor.etiquetas, "Revisar"]))
      : deudor.etiquetas,
    llamable: CIERRA_LLAMADAS.includes(analisis.resultado) ? false : deudor.llamable,
    gestiones: [gestion, ...deudor.gestiones].slice(0, 80),
    actualizado: iso,
  };
}

/**
 * Camino sin modelo: la llamada no conectó, así que la ficha solo suma el
 * intento. No se toca el estado ni el riesgo, porque un número que no contestó
 * no dice nada nuevo del cliente.
 */
export function aplicarSinContacto(
  deudor: Deudor,
  resultado: ResultadoLlamada,
  ctx: { ahora: Date; callId?: string; campanaId?: string; motivo?: string },
): Deudor {
  const iso = ctx.ahora.toISOString();
  const gestion: Gestion = {
    id: nuevoId("g"),
    tipo: "llamada",
    cuando: iso,
    autor: "ia",
    resumen:
      resultado === "no_contesto"
        ? "No contestó."
        : `Llamada sin contacto${ctx.motivo ? ` (${ctx.motivo})` : ""}.`,
    resultado,
    duracionSeg: 0,
    callId: ctx.callId,
    campanaId: ctx.campanaId,
  };
  return {
    ...deudor,
    estado: deudor.estado === "sin_gestionar" ? "en_gestion" : deudor.estado,
    gestiones: [gestion, ...deudor.gestiones].slice(0, 80),
    actualizado: iso,
  };
}
