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

// Nota (2026-07-22): el cruce por llamada NO se implemento a proposito. El
// historial de ElevenLabs (/v1/history) SI registra las generaciones de Vapi en
// la hora exacta de cada llamada, pero para el streaming que usa Vapi el texto y
// el nombre de voz vienen VACIOS: solo hay conteo de caracteres, y ese ya lo da
// Vapi por llamada (ttsCharacters). Cruzar aportaria solo una verificacion
// contable de nicho, asi que se dejo en la cuota a nivel cuenta.

// Estado de una voz: para que modelos esta entrenada (fine-tuned). Diagnostico
// del error "voice not fine-tuned and cannot be used".
export async function fetchVozEstado(voiceId: string): Promise<{
  name: string;
  category: string;
  fineTuningState: Record<string, string> | null;
  highQualityModels: string[];
  verifiedLanguages: unknown[];
} | null> {
  const key = claveEleven();
  if (!key) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const res = await fetch(`${EL_BASE}/v1/voices/${voiceId}`, {
      headers: { "xi-api-key": key },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`ElevenLabs voz respondio ${res.status}`);
    const d = (await res.json()) as {
      name?: string;
      category?: string;
      fine_tuning?: { state?: Record<string, string> };
      high_quality_base_model_ids?: string[];
      verified_languages?: unknown[];
    };
    return {
      name: d.name ?? "",
      category: d.category ?? "",
      fineTuningState: d.fine_tuning?.state ?? null,
      highQualityModels: d.high_quality_base_model_ids ?? [],
      verifiedLanguages: d.verified_languages ?? [],
    };
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
