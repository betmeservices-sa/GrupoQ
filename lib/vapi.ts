// Costura FAKE/REAL para llamadas. Con VAPI_PRIVATE_KEY lee datos reales de la
// API de Vapi; sin llave devuelve un seed de demo.
// Este modulo SOLO se importa desde el servidor (route handlers): la key jamas
// llega al browser.
import type { CallCostBreakdown, CallDirection, CallRecord } from "./data/types";

const VAPI_BASE = "https://api.vapi.ai";

export interface VapiCall {
  id: string;
  type?: string;
  status?: string;
  customer?: { number?: string };
  phoneNumberId?: string;
  assistantId?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  cost?: number;
  costBreakdown?: Partial<CallCostBreakdown>;
  transcript?: string;
  recordingUrl?: string;
}

// Catalogos que traducen ids de Vapi a algo legible. Se piden una vez por
// sincronizacion, no una vez por llamada.
export interface Directorio {
  numeros: Map<string, { numero: string; nombre: string }>;
  assistants: Map<string, string>;
}

const DIRECTORIO_VACIO: Directorio = { numeros: new Map(), assistants: new Map() };

// Reparte un costo entre componentes con la proporcion real observada en la
// cuenta: plataforma 64%, modelo 23%, transcripcion 13%. TTS y transporte van
// en cero, igual que en produccion (voz con llave propia y trunk propio).
function desgloseDemo(costo: number, caracteres = 0): CallCostBreakdown {
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return {
    vapi: r(costo * 0.64),
    llm: r(costo * 0.23),
    stt: r(costo * 0.13),
    tts: 0,
    transport: 0,
    total: costo,
    ttsCharacters: caracteres,
    llmPromptTokens: 0,
    llmCompletionTokens: 0,
  };
}

// Respaldo para el demo sin llave: llamadas representativas de un dia.
const SEED_CALLS: CallRecord[] = [
  { id: "demo-1", direccion: "inbound", numeroCliente: "+50375391721", creada: "2026-06-24T14:02:03Z", inicio: "2026-06-24T14:02:11Z", fin: "2026-06-24T14:05:39Z", duracionSeg: 208, costo: 0.18, costoDesglose: desgloseDemo(0.18, 742), estadoFinal: "customer-ended-call", nombreNumero: "BetMe Services", numeroPropio: "+50325054600", nombreAssistant: "Sofía - Banco BetMe" },
  { id: "demo-2", direccion: "inbound", numeroCliente: "+50378204455", creada: "2026-06-24T13:39:55Z", inicio: "2026-06-24T13:40:02Z", fin: "2026-06-24T13:41:12Z", duracionSeg: 70, costo: 0.06, costoDesglose: desgloseDemo(0.06, 268), estadoFinal: "assistant-forwarded-call", nombreNumero: "BetMe Services", numeroPropio: "+50325054600", nombreAssistant: "Sofía - Banco BetMe" },
  { id: "demo-3", direccion: "outbound", numeroCliente: "+50370119088", creada: "2026-06-24T12:18:44Z", inicio: "2026-06-24T12:18:50Z", fin: "2026-06-24T12:22:30Z", duracionSeg: 220, costo: 0.2, costoDesglose: desgloseDemo(0.2, 810), estadoFinal: "assistant-ended-call", nombreNumero: "BetMe Services", numeroPropio: "+50325054600", nombreAssistant: "Sofía - Banco BetMe" },
  { id: "demo-4", direccion: "inbound", numeroCliente: "+50322503300", creada: "2026-06-24T11:04:52Z", inicio: "2026-06-24T11:05:00Z", fin: "2026-06-24T11:05:42Z", duracionSeg: 42, costo: 0.04, costoDesglose: desgloseDemo(0.04, 195), estadoFinal: "assistant-forwarded-call", nombreNumero: "Hospital gineco", numeroPropio: "+50325054602", nombreAssistant: "Hospital" },
  { id: "demo-5", direccion: "outbound", numeroCliente: "+50361611519", creada: "2026-06-24T10:30:00Z", duracionSeg: 0, costo: 0, estadoFinal: "call.in-progress.error-providerfault-outbound-sip-480-temporarily-unavailable", nombreNumero: "BetMe Services", numeroPropio: "+50325054600", nombreAssistant: "Sofía - Banco BetMe" },
  { id: "demo-6", direccion: "inbound", numeroCliente: "+50360557788", creada: "2026-06-24T09:11:52Z", inicio: "2026-06-24T09:12:00Z", fin: "2026-06-24T09:15:20Z", duracionSeg: 200, costo: 0.17, costoDesglose: desgloseDemo(0.17, 703), estadoFinal: "customer-ended-call", nombreNumero: "Miagentia", numeroPropio: "+50325054601", nombreAssistant: "Sofia (Copy)" },
];

function direccionDe(type: unknown): CallDirection {
  if (type === "inboundPhoneCall") return "inbound";
  if (type === "outboundPhoneCall") return "outbound";
  return "web";
}

function duracionSeg(inicio?: string, fin?: string): number {
  if (!inicio || !fin) return 0;
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  return ms > 0 ? Math.round(ms / 1000) : 0;
}

function desgloseDe(raw?: Partial<CallCostBreakdown>): CallCostBreakdown | undefined {
  if (!raw) return undefined;
  return {
    transport: raw.transport ?? 0,
    stt: raw.stt ?? 0,
    llm: raw.llm ?? 0,
    tts: raw.tts ?? 0,
    vapi: raw.vapi ?? 0,
    total: raw.total ?? 0,
    ttsCharacters: raw.ttsCharacters ?? 0,
    llmPromptTokens: raw.llmPromptTokens ?? 0,
    llmCompletionTokens: raw.llmCompletionTokens ?? 0,
  };
}

export function normalizarCall(call: VapiCall, dir: Directorio = DIRECTORIO_VACIO): CallRecord {
  const num = call.phoneNumberId ? dir.numeros.get(call.phoneNumberId) : undefined;
  return {
    id: call.id,
    direccion: direccionDe(call.type),
    numeroCliente: call.customer?.number,
    inicio: call.startedAt,
    fin: call.endedAt,
    duracionSeg: duracionSeg(call.startedAt, call.endedAt),
    costo: typeof call.cost === "number" ? call.cost : 0,
    estadoFinal: call.endedReason,
    assistantId: call.assistantId,
    creada: call.createdAt,
    phoneNumberId: call.phoneNumberId,
    numeroPropio: num?.numero,
    nombreNumero: num?.nombre,
    nombreAssistant: call.assistantId ? dir.assistants.get(call.assistantId) : undefined,
    estado: call.status,
    costoDesglose: desgloseDe(call.costBreakdown),
    transcript: call.transcript,
    grabacionUrl: call.recordingUrl,
  };
}

export function hayLlaveVapi(): boolean {
  return Boolean(process.env.VAPI_PRIVATE_KEY);
}

interface ErrorConEstado extends Error {
  status?: number;
}

async function pedirUnaVez<T>(ruta: string, key: string): Promise<T> {
  // Timeout duro: en Vercel un fetch colgado se lleva toda la funcion. Preferimos
  // cortar a los 15s y reintentar antes que quedar esperando indefinido.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(`${VAPI_BASE}${ruta}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) {
      const e: ErrorConEstado = new Error(`Vapi respondio ${res.status} en ${ruta}`);
      e.status = res.status;
      throw e;
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Un corte de socket ("terminated"), un abort por timeout o un 5xx/429 son
// transitorios: reintentar casi siempre funciona. Un 401/404 no lo es.
function esTransitorio(err: unknown): boolean {
  const status = (err as ErrorConEstado)?.status;
  if (status && [429, 500, 502, 503, 504].includes(status)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /terminated|aborted|abort|timeout|fetch failed|ECONNRESET|network|socket/i.test(msg);
}

async function pedir<T>(ruta: string, key: string): Promise<T> {
  const intentos = 3;
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await pedirUnaVez<T>(ruta, key);
    } catch (err) {
      ultimoError = err;
      if (i === intentos - 1 || !esTransitorio(err)) throw err;
      // Backoff corto antes de reintentar (300ms, 600ms).
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw ultimoError;
}

// Trae los catalogos de numeros y assistants. Si fallan, se devuelve un
// directorio vacio: preferimos mostrar ids crudos antes que romper la vista.
async function cargarDirectorio(key: string): Promise<Directorio> {
  try {
    const [numeros, assistants] = await Promise.all([
      pedir<Array<{ id: string; number?: string; name?: string }>>("/phone-number", key),
      pedir<Array<{ id: string; name?: string }>>("/assistant", key),
    ]);
    return {
      numeros: new Map(
        (Array.isArray(numeros) ? numeros : []).map((n) => [
          n.id,
          { numero: n.number ?? "", nombre: n.name ?? "" },
        ]),
      ),
      assistants: new Map(
        (Array.isArray(assistants) ? assistants : []).map((a) => [a.id, a.name ?? ""]),
      ),
    };
  } catch {
    return DIRECTORIO_VACIO;
  }
}

export async function fetchVapiCalls(limit = 200): Promise<CallRecord[]> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) return SEED_CALLS;

  const dir = await cargarDirectorio(key);
  const data = await pedir<unknown>(`/call?limit=${limit}`, key);
  const arr = Array.isArray(data) ? (data as VapiCall[]) : [];
  return arr.map((c) => normalizarCall(c, dir));
}

// ---------------------------------------------------------------------------
// AGENTES (assistants de Vapi + el numero que tienen asignado)
// ---------------------------------------------------------------------------

export interface VapiAssistant {
  id: string;
  name?: string;
  firstMessage?: string;
  model?: {
    model?: string;
    provider?: string;
    messages?: Array<{ role?: string; content?: string }>;
  };
  voice?: { provider?: string; voiceId?: string };
}

export interface VapiPhoneNumber {
  id: string;
  number?: string;
  name?: string;
  assistantId?: string;
}

export interface NumeroAsignado {
  id: string;
  numero: string;
  nombre: string;
}

export interface AgenteRecord {
  id: string;
  nombre: string;
  modelo?: string;
  voz?: string;
  primerMensaje?: string;
  // El "script": el system prompt con el que corre el agente.
  script: string;
  // Un assistant puede tener 0, 1 o varios numeros apuntandole. Sin numero
  // asignado NO se puede llamar desde el (Vapi exige phoneNumberId).
  numeros: NumeroAsignado[];
}

// El script vive en el primer mensaje de rol "system" del modelo.
export function extraerScript(a: VapiAssistant): string {
  const msgs = a.model?.messages ?? [];
  return msgs.find((m) => m.role === "system")?.content ?? "";
}

function nombreVoz(a: VapiAssistant): string | undefined {
  const v = a.voice;
  if (!v?.provider) return undefined;
  return v.voiceId ? `${v.provider} / ${v.voiceId}` : v.provider;
}

// Pura a proposito: la prueba la ejerce sin tocar la red.
export function normalizarAgentes(
  assistants: VapiAssistant[],
  numeros: VapiPhoneNumber[],
): AgenteRecord[] {
  return assistants.map((a) => ({
    id: a.id,
    nombre: a.name?.trim() || "(sin nombre)",
    modelo: a.model?.model,
    voz: nombreVoz(a),
    primerMensaje: a.firstMessage,
    script: extraerScript(a),
    numeros: numeros
      .filter((n) => n.assistantId === a.id)
      .map((n) => ({ id: n.id, numero: n.number ?? "", nombre: n.name ?? "" })),
  }));
}

const SEED_AGENTES: AgenteRecord[] = [
  {
    id: "demo-assistant-1",
    nombre: "Sofía - Banco BetMe (Demo Outbound)",
    modelo: "gpt-5.4",
    voz: "11labs / qO4CSH9mbCZnV8sWQTpn",
    primerMensaje: "Buenas, le saluda Sofía, de Banco BetMe. ¿Hablo con {{nombre}}?",
    script:
      "IDENTIDAD\nEres Sofía, asistente de voz de Banco BetMe...\n\n(Script de demostración: conectá VAPI_PRIVATE_KEY para ver el real.)",
    numeros: [{ id: "demo-num-1", numero: "+50325054600", nombre: "BetMe Services" }],
  },
  {
    id: "demo-assistant-2",
    nombre: "Hospital",
    modelo: "gpt-5.4",
    voz: "11labs / qO4CSH9mbCZnV8sWQTpn",
    primerMensaje: "Hospital Ginecológico, les saluda Sofía. ¿En qué le puedo ayudar?",
    script:
      "IDENTIDAD\nEres Sofía, asistente de voz del Hospital Centro Ginecológico...\n\n(Script de demostración: conectá VAPI_PRIVATE_KEY para ver el real.)",
    numeros: [{ id: "demo-num-2", numero: "+50325054602", nombre: "Hospital gineco" }],
  },
  {
    id: "demo-assistant-3",
    nombre: "Sofia (Copy)",
    modelo: "gpt-5.4",
    voz: "11labs / qO4CSH9mbCZnV8sWQTpn",
    primerMensaje: "Buenas, le saluda Sofía. ¿Con quién tengo el gusto?",
    script: "(Script de demostración: conectá VAPI_PRIVATE_KEY para ver el real.)",
    numeros: [{ id: "demo-num-3", numero: "+50325054601", nombre: "Miagentia" }],
  },
];

export async function fetchVapiAgentes(): Promise<AgenteRecord[]> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) return SEED_AGENTES;

  const [assistants, numeros] = await Promise.all([
    pedir<unknown>("/assistant?limit=100", key),
    pedir<unknown>("/phone-number?limit=100", key),
  ]);
  return normalizarAgentes(
    Array.isArray(assistants) ? (assistants as VapiAssistant[]) : [],
    Array.isArray(numeros) ? (numeros as VapiPhoneNumber[]) : [],
  );
}

// ---------------------------------------------------------------------------
// DISPARAR UNA LLAMADA
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// EDITAR EL SCRIPT
// ---------------------------------------------------------------------------

// El `model` de un assistant NO es parcheable por partes: Vapi lo reemplaza
// completo. Varios assistants llevan toolIds (transferencia, reservar cita,
// callback...) y temperature ahi dentro, asi que mandar un model armado a mano
// los borraria en silencio. Por eso se lee el actual, se cambia SOLO el
// contenido del mensaje system, y se devuelve el objeto entero tal como vino.
export async function actualizarScriptVapi(
  assistantId: string,
  script: string,
): Promise<{ script: string }> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("Falta VAPI_PRIVATE_KEY: no se puede editar en modo demostración.");

  const actual = await pedir<{ model?: Record<string, unknown> }>(`/assistant/${assistantId}`, key);
  const model = actual.model;
  if (!model) throw new Error("Ese agente no tiene un modelo configurado en Vapi.");

  const previos = Array.isArray(model.messages)
    ? (model.messages as Array<{ role?: string; content?: string }>)
    : [];
  const messages = [...previos];
  const i = messages.findIndex((m) => m.role === "system");
  if (i >= 0) messages[i] = { ...messages[i], content: script };
  else messages.unshift({ role: "system", content: script });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  try {
    const res = await fetch(`${VAPI_BASE}/assistant/${assistantId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      // Solo se toca `model`, y con todas sus llaves originales intactas.
      body: JSON.stringify({ model: { ...model, messages } }),
      cache: "no-store",
      signal: ac.signal,
    });
    const cuerpo = (await res.json().catch(() => null)) as
      | { model?: { messages?: Array<{ role?: string; content?: string }> }; message?: string | string[] }
      | null;
    if (!res.ok) {
      const m = cuerpo?.message;
      const detalle = Array.isArray(m) ? m.join("; ") : m;
      throw new Error(detalle || `Vapi respondio ${res.status} al guardar el script`);
    }
    // Se devuelve lo que Vapi dejo guardado, no lo que creemos que mandamos.
    const guardado =
      cuerpo?.model?.messages?.find((m) => m.role === "system")?.content ?? script;
    return { script: guardado };
  } finally {
    clearTimeout(timer);
  }
}

export interface LlamadaLanzada {
  id: string;
  status?: string;
}

export async function lanzarLlamadaVapi(params: {
  assistantId: string;
  phoneNumberId: string;
  numero: string;
}): Promise<LlamadaLanzada> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("Falta VAPI_PRIVATE_KEY: no se puede llamar en modo demostración.");

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(`${VAPI_BASE}/call`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        assistantId: params.assistantId,
        phoneNumberId: params.phoneNumberId,
        customer: { number: params.numero },
      }),
      cache: "no-store",
      signal: ac.signal,
    });
    const cuerpo = (await res.json().catch(() => null)) as
      | (LlamadaLanzada & { message?: string | string[] })
      | null;
    if (!res.ok) {
      // Vapi manda el detalle util en message (a veces array de validaciones).
      const m = cuerpo?.message;
      const detalle = Array.isArray(m) ? m.join("; ") : m;
      throw new Error(detalle || `Vapi respondio ${res.status} al crear la llamada`);
    }
    return { id: cuerpo?.id ?? "", status: cuerpo?.status };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// NUMEROS: listado completo y (des)asignacion a un agente
// ---------------------------------------------------------------------------

export interface NumeroRecord {
  id: string;
  numero: string;
  nombre: string;
  // null = libre, sin agente atendiendolo.
  assistantId: string | null;
  nombreAssistant?: string;
}

/** Todos los numeros de la cuenta, con el agente que los atiende (si hay). */
export async function fetchVapiNumeros(): Promise<NumeroRecord[]> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) {
    return [
      { id: "demo-n1", numero: "+50325054600", nombre: "BetMe Services", assistantId: "demo-a1", nombreAssistant: "Sofía - Banco BetMe" },
      { id: "demo-n2", numero: "+50325054601", nombre: "Miagentia", assistantId: null },
      { id: "demo-n3", numero: "+50325054602", nombre: "Hospital gineco", assistantId: "demo-a2", nombreAssistant: "Hospital" },
    ];
  }
  const [numeros, assistants] = await Promise.all([
    pedir<VapiPhoneNumber[]>("/phone-number", key),
    pedir<VapiAssistant[]>("/assistant", key).catch(() => [] as VapiAssistant[]),
  ]);
  const nombres = new Map((Array.isArray(assistants) ? assistants : []).map((a) => [a.id, a.name ?? ""]));
  return (Array.isArray(numeros) ? numeros : []).map((n) => ({
    id: n.id,
    numero: n.number ?? "",
    nombre: n.name ?? "",
    assistantId: n.assistantId ?? null,
    nombreAssistant: n.assistantId ? nombres.get(n.assistantId) : undefined,
  }));
}

/**
 * Asigna un numero a un agente, o lo libera con assistantId = null.
 * Vapi permite UN agente por numero: asignar a otro reemplaza al anterior, que
 * es justo lo que se necesita para "intercambiar" sin pasos intermedios.
 */
export async function asignarNumeroVapi(
  phoneNumberId: string,
  assistantId: string | null,
): Promise<NumeroRecord> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("Falta VAPI_PRIVATE_KEY: no se puede cambiar la asignación en modo demostración.");

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch(`${VAPI_BASE}/phone-number/${phoneNumberId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ assistantId }),
      cache: "no-store",
      signal: ac.signal,
    });
    const cuerpo = (await res.json().catch(() => null)) as
      | (VapiPhoneNumber & { message?: string | string[] })
      | null;
    if (!res.ok) {
      const m = cuerpo?.message;
      const detalle = Array.isArray(m) ? m.join("; ") : m;
      throw new Error(detalle || `Vapi respondio ${res.status} al asignar el numero`);
    }
    return {
      id: cuerpo?.id ?? phoneNumberId,
      numero: cuerpo?.number ?? "",
      nombre: cuerpo?.name ?? "",
      assistantId: cuerpo?.assistantId ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}
