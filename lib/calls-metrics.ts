// Materializacion de la data cruda de llamadas de Vapi.
// TODO lo de este modulo son funciones puras: sin fetch, sin env, sin React.
// Por eso se puede testear directo y se puede importar desde cliente o servidor.
import type {
  CallCostBreakdown,
  CallDerived,
  CallMetrics,
  CallOutcome,
  CallRecord,
  CarrierBucket,
  PrefijoStats,
} from "./data/types";

function segundosEntre(desde?: string, hasta?: string): number | null {
  if (!desde || !hasta) return null;
  const ms = new Date(hasta).getTime() - new Date(desde).getTime();
  if (Number.isNaN(ms)) return null;
  return ms > 0 ? Math.round(ms / 1000) : 0;
}

// Cuanto sono antes de que contestaran. null = nunca contestaron.
export function ringSeg(c: CallRecord): number | null {
  return segundosEntre(c.creada, c.inicio);
}

// Tiempo de conversacion real. Es lo UNICO que factura Vapi: las llamadas
// rechazadas por el carrier (SIP 480) llegan con costo 0 y sin inicio.
export function hablaSeg(c: CallRecord): number {
  return segundosEntre(c.inicio, c.fin) ?? 0;
}

export function costoPorMinuto(c: CallRecord): number | null {
  const seg = hablaSeg(c);
  if (seg <= 0) return null;
  return c.costo / (seg / 60);
}

// Costo REAL de la llamada: lo que cobra Vapi mas lo que cobra el carrier por
// los minutos hablados. Con tarifaCarrier en 0, es igual al costo de Vapi.
export function costoRealLlamada(c: CallRecord, tarifaCarrier = 0): number {
  const carrier = (hablaSeg(c) / 60) * tarifaCarrier;
  return Math.round((c.costo + carrier) * 10000) / 10000;
}

// --- Costo de telefonia del carrier (Tigo SV) ---
// Hay un bucket de minutos incluidos; pasado el bucket, cada minuto extra se
// cobra segun el destino. Tarifas dadas por el usuario (2026-07-22):
//   numeros que empiezan en 2 (fijos):       2 centavos/min
//   numeros que empiezan en 6 o 7 (moviles): 8 centavos/min
// La fija on-net es gratis y el movil de otra compania podria variar, pero no se
// puede saber on/off-net por el numero (portabilidad), asi que se cobra plano
// por rango.
export const BUCKET_MINUTOS = 50;
const TARIFA_FIJA = 0.02;
const TARIFA_CELULAR = 0.08;

export function tarifaCarrierSV(numero?: string): number {
  const p = prefijoSV(numero);
  if (p === "2") return TARIFA_FIJA;
  if (p === "6" || p === "7") return TARIFA_CELULAR;
  return 0;
}

export function calcularCarrierBucket(
  calls: CallRecord[],
  bucketMin = BUCKET_MINUTOS,
): CarrierBucket {
  // Se ordenan por tiempo para asignar el bucket cronologicamente: los primeros
  // `bucketMin` minutos hablados van incluidos, el resto se cobra.
  const conHabla = calls
    .filter((c) => hablaSeg(c) > 0)
    .map((c) => ({ c, min: hablaSeg(c) / 60, ts: new Date(c.creada ?? c.inicio ?? 0).getTime() }))
    .sort((a, b) => a.ts - b.ts);

  let acumulado = 0;
  let costoCarrier = 0;
  let fijaMin = 0;
  let fijaCosto = 0;
  let celularMin = 0;
  let celularCosto = 0;

  for (const { c, min } of conHabla) {
    const inicio = acumulado;
    const fin = acumulado + min;
    acumulado = fin;
    // Minutos de esta llamada que caen FUERA del bucket (maneja la llamada que
    // cruza el limite de los 50 min).
    const overage = Math.max(0, fin - bucketMin) - Math.max(0, inicio - bucketMin);
    if (overage <= 0) continue;
    const tarifa = tarifaCarrierSV(c.numeroCliente);
    if (tarifa === 0) continue;
    const costo = overage * tarifa;
    costoCarrier += costo;
    if (tarifa === TARIFA_FIJA) {
      fijaMin += overage;
      fijaCosto += costo;
    } else {
      celularMin += overage;
      celularCosto += costo;
    }
  }

  return {
    bucketMin,
    minutosTotales: redondear(acumulado, 1),
    minutosEnBucket: redondear(Math.min(acumulado, bucketMin), 1),
    minutosFueraBucket: redondear(Math.max(0, acumulado - bucketMin), 1),
    costoCarrier: redondear(costoCarrier, 4),
    fijaMin: redondear(fijaMin, 1),
    fijaCosto: redondear(fijaCosto, 4),
    celularMin: redondear(celularMin, 1),
    celularCosto: redondear(celularCosto, 4),
  };
}

// Agrupa los endedReason de Vapi en categorias legibles. El caso por defecto
// existe a proposito: Vapi agrega motivos nuevos y no queremos romper la UI.
export function categoriaOutcome(motivo?: string): CallOutcome {
  if (!motivo) return "otro";
  const m = motivo.toLowerCase();
  if (m.includes("did-not-receive-customer-audio")) return "sin_audio";
  if (m.includes("providerfault") || m.includes("sip-480") || m.includes("sip-503")) {
    return "falla_carrier";
  }
  if (m.includes("pipeline-error") || m.includes("error-get-assistant")) {
    return "falla_plataforma";
  }
  if (m === "assistant-forwarded-call") return "transferida";
  if (m === "customer-did-not-answer" || m === "silence-timed-out") return "sin_respuesta";
  if (
    m === "customer-ended-call" ||
    m === "assistant-ended-call" ||
    m === "assistant-said-end-call-phrase"
  ) {
    return "exitosa";
  }
  return "otro";
}

// Primer digito del numero nacional salvadoreno (2 fijo, 6 y 7 moviles).
// Sirve para ver la tasa de conexion por rango, que es donde se detecto que
// el trunk no enruta el rango 6.
export function prefijoSV(numero?: string): string | null {
  if (!numero) return null;
  const m = numero.replace(/\D/g, "").match(/^503(\d)/);
  return m ? m[1] : null;
}

export function derivar(c: CallRecord): CallDerived {
  return {
    ringSeg: ringSeg(c),
    hablaSeg: hablaSeg(c),
    costoPorMinuto: costoPorMinuto(c),
    outcome: categoriaOutcome(c.estadoFinal),
  };
}

const DESGLOSE_CERO: CallCostBreakdown = {
  transport: 0,
  stt: 0,
  llm: 0,
  tts: 0,
  vapi: 0,
  total: 0,
  ttsCharacters: 0,
  llmPromptTokens: 0,
  llmCompletionTokens: 0,
};

const OUTCOMES: CallOutcome[] = [
  "exitosa",
  "transferida",
  "falla_carrier",
  "falla_plataforma",
  "sin_audio",
  "sin_respuesta",
  "otro",
];

function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

/**
 * Agrega un conjunto de llamadas.
 * @param tarifaCarrier USD por minuto que cobra el carrier. Vapi NO lo incluye
 *   (transport llega en 0 cuando el trunk es propio), asi que sin este dato el
 *   costo mostrado no es el costo real.
 */
export function resumirLlamadas(calls: CallRecord[], tarifaCarrier = 0): CallMetrics {
  const derivadas = calls.map((c) => ({ call: c, d: derivar(c) }));
  const conHabla = derivadas.filter((x) => x.d.hablaSeg > 0);
  const totalSeg = conHabla.reduce((s, x) => s + x.d.hablaSeg, 0);
  const costoTotal = calls.reduce((s, c) => s + c.costo, 0);

  const rings = derivadas.map((x) => x.d.ringSeg).filter((r): r is number => r !== null);

  const desglose = calls.reduce<CallCostBreakdown>(
    (acc, c) => {
      const d = c.costoDesglose;
      if (!d) return acc;
      return {
        transport: acc.transport + d.transport,
        stt: acc.stt + d.stt,
        llm: acc.llm + d.llm,
        tts: acc.tts + d.tts,
        vapi: acc.vapi + d.vapi,
        total: acc.total + d.total,
        ttsCharacters: acc.ttsCharacters + d.ttsCharacters,
        llmPromptTokens: acc.llmPromptTokens + d.llmPromptTokens,
        llmCompletionTokens: acc.llmCompletionTokens + d.llmCompletionTokens,
      };
    },
    { ...DESGLOSE_CERO },
  );

  const porOutcome = OUTCOMES.reduce<Record<CallOutcome, number>>(
    (acc, o) => {
      acc[o] = derivadas.filter((x) => x.d.outcome === o).length;
      return acc;
    },
    {} as Record<CallOutcome, number>,
  );

  const mapaPrefijo = new Map<string, { total: number; conectadas: number }>();
  for (const { call, d } of derivadas) {
    const p = prefijoSV(call.numeroCliente);
    if (!p) continue;
    const actual = mapaPrefijo.get(p) ?? { total: 0, conectadas: 0 };
    actual.total += 1;
    if (d.hablaSeg > 0) actual.conectadas += 1;
    mapaPrefijo.set(p, actual);
  }
  const porPrefijo: PrefijoStats[] = [...mapaPrefijo.entries()]
    .map(([prefijo, v]) => ({
      prefijo,
      total: v.total,
      conectadas: v.conectadas,
      tasa: v.total ? v.conectadas / v.total : 0,
    }))
    .sort((a, b) => a.prefijo.localeCompare(b.prefijo));

  const minutosHablados = totalSeg / 60;
  const costoCarrier = redondear(minutosHablados * tarifaCarrier, 4);

  return {
    total: calls.length,
    entrantes: calls.filter((c) => c.direccion === "inbound").length,
    salientes: calls.filter((c) => c.direccion === "outbound").length,
    conectadas: conHabla.length,
    minutosTotales: redondear(minutosHablados, 1),
    duracionPromedioSeg: conHabla.length ? Math.round(totalSeg / conHabla.length) : 0,
    costoTotal: redondear(costoTotal, 4),
    tasaConexion: calls.length ? conHabla.length / calls.length : 0,
    costoPorMinutoPromedio: totalSeg > 0 ? costoTotal / minutosHablados : null,
    ringPromedioSeg: rings.length
      ? Math.round(rings.reduce((s, r) => s + r, 0) / rings.length)
      : null,
    desglose,
    porOutcome,
    porPrefijo,
    costoCarrier,
    costoReal: redondear(costoTotal + costoCarrier, 4),
    caracteresTTS: desglose.ttsCharacters,
    // Solo sobre las llamadas que realmente hablaron: promediar incluyendo las
    // rechazadas (0 caracteres) daria un numero enganosamente bajo.
    caracteresPorLlamada: (() => {
      const conVoz = calls.filter((c) => (c.costoDesglose?.ttsCharacters ?? 0) > 0);
      if (conVoz.length === 0) return 0;
      const suma = conVoz.reduce((s, c) => s + (c.costoDesglose?.ttsCharacters ?? 0), 0);
      return Math.round(suma / conVoz.length);
    })(),
    carrierBucket: calcularCarrierBucket(calls),
  };
}
