// Costura FAKE/REAL para llamadas. Si hay VAPI_PRIVATE_KEY, lee datos reales
// de la API de Vapi (GET /call). Si no, devuelve un seed de demo para que el
// dashboard funcione sin llaves. Este módulo SOLO se importa desde el server
// (el route handler), nunca desde el cliente: la key jamás llega al browser.
import type { CallDirection, CallMetrics, CallRecord } from "./data/types";

const VAPI_BASE = "https://api.vapi.ai";

// Respaldo para el demo sin llave: llamadas representativas de un día.
const SEED_CALLS: CallRecord[] = [
  { id: "demo-1", direccion: "inbound", numeroCliente: "7539-1721", inicio: "2026-06-24T14:02:11Z", fin: "2026-06-24T14:05:39Z", duracionSeg: 208, costo: 0.18, estadoFinal: "customer-ended-call" },
  { id: "demo-2", direccion: "inbound", numeroCliente: "7820-4455", inicio: "2026-06-24T13:40:02Z", fin: "2026-06-24T13:41:12Z", duracionSeg: 70, costo: 0.06, estadoFinal: "assistant-forwarded-call" },
  { id: "demo-3", direccion: "outbound", numeroCliente: "7011-9088", inicio: "2026-06-24T12:18:50Z", fin: "2026-06-24T12:22:30Z", duracionSeg: 220, costo: 0.2, estadoFinal: "assistant-ended-call" },
  { id: "demo-4", direccion: "inbound", numeroCliente: "2250-3300", inicio: "2026-06-24T11:05:00Z", fin: "2026-06-24T11:05:42Z", duracionSeg: 42, costo: 0.04, estadoFinal: "assistant-forwarded-call" },
  { id: "demo-5", direccion: "outbound", numeroCliente: "7766-1212", inicio: "2026-06-24T10:30:00Z", fin: undefined, duracionSeg: 0, costo: 0, estadoFinal: "customer-did-not-answer" },
  { id: "demo-6", direccion: "inbound", numeroCliente: "6055-7788", inicio: "2026-06-24T09:12:00Z", fin: "2026-06-24T09:15:20Z", duracionSeg: 200, costo: 0.17, estadoFinal: "customer-ended-call" },
];

interface VapiCall {
  id: string;
  type?: string;
  customer?: { number?: string };
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  endedReason?: string;
  assistantId?: string;
}

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

function normalizar(call: VapiCall): CallRecord {
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
  };
}

export function hayLlaveVapi(): boolean {
  return Boolean(process.env.VAPI_PRIVATE_KEY);
}

export async function fetchVapiCalls(limit = 100): Promise<CallRecord[]> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) return SEED_CALLS;

  const res = await fetch(`${VAPI_BASE}/call?limit=${limit}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Vapi respondió ${res.status}`);
  }
  const data: unknown = await res.json();
  const arr = Array.isArray(data) ? (data as VapiCall[]) : [];
  return arr.map(normalizar);
}

export function resumirLlamadas(calls: CallRecord[]): CallMetrics {
  const conDuracion = calls.filter((c) => c.duracionSeg > 0);
  const totalSeg = conDuracion.reduce((s, c) => s + c.duracionSeg, 0);
  const costoTotal = calls.reduce((s, c) => s + c.costo, 0);
  return {
    total: calls.length,
    entrantes: calls.filter((c) => c.direccion === "inbound").length,
    salientes: calls.filter((c) => c.direccion === "outbound").length,
    conectadas: conDuracion.length,
    minutosTotales: Math.round((totalSeg / 60) * 10) / 10,
    duracionPromedioSeg: conDuracion.length ? Math.round(totalSeg / conDuracion.length) : 0,
    costoTotal: Math.round(costoTotal * 100) / 100,
  };
}
