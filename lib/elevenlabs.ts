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

export function hayLlaveEleven(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function fetchCuotaEleven(): Promise<CuotaEleven | null> {
  const key = process.env.ELEVENLABS_API_KEY;
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
