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

async function pedir<T>(ruta: string, key: string): Promise<T> {
  const res = await fetch(`${VAPI_BASE}${ruta}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Vapi respondio ${res.status} en ${ruta}`);
  return (await res.json()) as T;
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
