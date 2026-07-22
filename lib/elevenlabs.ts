// Cuota de caracteres de ElevenLabs. SOLO servidor (la key nunca llega al
// browser). Sin ELEVENLABS_API_KEY, todo degrada devolviendo null y la UI
// muestra "no configurado" en vez de romperse.
//
// El costo de voz (tts) que reporta Vapi llega en 0 porque la voz se factura
// con esta cuenta propia de ElevenLabs. Por eso el unico lugar donde ves el
// consumo real de voz es aca: caracteres usados contra el limite del plan.

const EL_BASE = "https://api.elevenlabs.io";

export interface CuotaEleven {
  usados: number; // character_count
  limite: number; // character_limit
  restantes: number;
  porcentaje: number; // 0..1 usado/limite
  tier: string;
  reinicioUnix: number | null; // next_character_count_reset_unix
}

interface SubscriptionResp {
  character_count?: number;
  character_limit?: number;
  tier?: string;
  next_character_count_reset_unix?: number | null;
}

// Acepta los nombres mas comunes por si la variable se nombro distinto en Vercel.
// El nombre canonico es ELEVENLABS_API_KEY.
export function claveEleven(): string | undefined {
  return (
    process.env.ELEVENLABS_API_KEY ||
    process.env.ELEVEN_LABS_API_KEY ||
    process.env.ELEVENLABS_KEY ||
    process.env.ELEVEN_API_KEY ||
    process.env.XI_API_KEY ||
    undefined
  );
}

// Nombres de variables de entorno que PARECEN relacionadas (para diagnosticar
// cuando la clave no se encuentra). Devuelve solo los NOMBRES, nunca valores.
export function nombresRelacionados(): string[] {
  return Object.keys(process.env).filter((k) => /eleven|^xi_|xi.?api|11labs/i.test(k));
}

export function hayLlaveEleven(): boolean {
  return Boolean(claveEleven());
}

export interface ItemHistorial {
  fechaUnix: number;
  voiceId: string;
  voiceName: string;
  source: string; // TTS, ConvAI, etc.
  caracteres: number;
  textoSnippet: string;
}

// Sondeo: trae las ultimas generaciones registradas en ElevenLabs. Sirve para
// saber si el uso de Vapi (streaming) deja rastro aca o no. Si el streaming no
// registra, esta lista vendra vacia o sin items del rango de las llamadas.
export async function fetchHistorialReciente(pageSize = 100): Promise<{
  total: number;
  porSource: Record<string, number>;
  muestras: ItemHistorial[];
} | null> {
  const key = claveEleven();
  if (!key) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(`${EL_BASE}/v1/history?page_size=${pageSize}`, {
      headers: { "xi-api-key": key },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`ElevenLabs history respondio ${res.status}`);
    const d = (await res.json()) as { history?: Array<Record<string, unknown>> };
    const items = Array.isArray(d.history) ? d.history : [];

    const porSource: Record<string, number> = {};
    for (const it of items) {
      const s = String(it.source ?? "?");
      porSource[s] = (porSource[s] ?? 0) + 1;
    }
    const muestras: ItemHistorial[] = items.slice(0, 8).map((it) => ({
      fechaUnix: Number(it.date_unix ?? 0),
      voiceId: String(it.voice_id ?? ""),
      voiceName: String(it.voice_name ?? ""),
      source: String(it.source ?? "?"),
      caracteres: Number(it.character_count_change_to ?? 0) - Number(it.character_count_change_from ?? 0),
      textoSnippet: String(it.text ?? "").slice(0, 60),
    }));
    return { total: items.length, porSource, muestras };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCuotaEleven(): Promise<CuotaEleven | null> {
  const key = claveEleven();
  if (!key) return null;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(`${EL_BASE}/v1/user/subscription`, {
      headers: { "xi-api-key": key },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`ElevenLabs respondio ${res.status}`);
    const d = (await res.json()) as SubscriptionResp;

    const usados = d.character_count ?? 0;
    const limite = d.character_limit ?? 0;
    return {
      usados,
      limite,
      restantes: Math.max(0, limite - usados),
      porcentaje: limite > 0 ? usados / limite : 0,
      tier: d.tier ?? "desconocido",
      reinicioUnix: d.next_character_count_reset_unix ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}
