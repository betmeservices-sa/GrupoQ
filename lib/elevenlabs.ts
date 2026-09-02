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

// Nota (2026-07-22): el error "voice not fine-tuned and cannot be used" venia de
// usar el modelo eleven_v3 con la voz "Eli" (clon profesional). Se corrigio
// poniendo los agentes en eleven_turbo_v2_5, y la voz termino de entrenarse ahi.
// El endpoint de sondeo /v1/voices/{id} se quito tras diagnosticar.

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
    if (!res.ok) {
      // El cuerpo trae el motivo real y el status solo no alcanza: ElevenLabs
      // usa 400 invalid_api_key cuando el valor TIENE forma de llave pero esta
      // muerta, y 401 cuando ni siquiera parece llave (un key ID, comillas
      // pegadas) o cuando no llego el header. Sin el detalle los tres casos se
      // ven iguales en la UI.
      let motivo = "";
      try {
        const e = (await res.json()) as { detail?: { status?: string; message?: string } };
        motivo = e?.detail?.message || e?.detail?.status || "";
      } catch {
        // cuerpo no JSON: nos quedamos con el status a secas
      }
      throw new Error(`ElevenLabs respondio ${res.status}${motivo ? `: ${motivo}` : ""}`);
    }
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

// ===== Consumo por rango de fechas =====
//
// La cuota de arriba es UN numero del periodo de facturacion en curso: no se
// puede filtrar por fecha porque el endpoint no devuelve una serie. Para
// filtrar hay que ir al historial, que si trae una entrada por generacion con
// su fecha y sus caracteres.
//
// El historial completo de esta cuenta son ~1,400 entradas (2 paginas, ~4s),
// asi que se trae ENTERO una vez y se cachea en memoria. Aggregar rangos sobre
// el cache es instantaneo, y evita repaginar cada vez que alguien cambia el
// filtro. Si la instancia se recicla, el peor caso son esos 4 segundos.

const TTL_CACHE_MS = 60_000;
const PAGINAS_MAX = 20; // corte de seguridad si la cuenta crece mucho

interface ItemHistorial {
  date_unix?: number;
  character_count_change_from?: number;
  character_count_change_to?: number;
}

interface HistorialResp {
  history?: ItemHistorial[];
  has_more?: boolean;
  last_history_item_id?: string;
}

export interface ConsumoEleven {
  caracteres: number;
  generaciones: number;
  porDia: { dia: string; caracteres: number }[]; // dia YYYY-MM-DD en hora del cliente
  desdeUnix: number | null; // inicio del rango pedido (null = todo)
  hastaUnix: number | null;
  masAntiguoUnix: number | null; // lo mas viejo que existe en la cuenta
}

let cache: { items: ItemHistorial[]; ts: number } | null = null;

async function traerHistorial(key: string): Promise<ItemHistorial[]> {
  if (cache && Date.now() - cache.ts < TTL_CACHE_MS) return cache.items;

  const items: ItemHistorial[] = [];
  let despuesDe: string | undefined;
  for (let i = 0; i < PAGINAS_MAX; i++) {
    const url = new URL(`${EL_BASE}/v1/history`);
    url.searchParams.set("page_size", "1000");
    if (despuesDe) url.searchParams.set("start_after_history_item_id", despuesDe);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch(url, {
        headers: { "xi-api-key": key },
        cache: "no-store",
        signal: ac.signal,
      });
      if (!res.ok) throw new Error(`ElevenLabs respondio ${res.status} al leer el historial`);
      const d = (await res.json()) as HistorialResp;
      items.push(...(d.history ?? []));
      if (!d.has_more || !d.last_history_item_id) break;
      despuesDe = d.last_history_item_id;
    } finally {
      clearTimeout(timer);
    }
  }
  cache = { items, ts: Date.now() };
  return items;
}

// Los limites llegan en unix (segundos) ya resueltos por el cliente, que es
// quien conoce la zona horaria de quien mira. Asi "hoy" es el hoy del usuario y
// no el del servidor, que en Vercel corre en UTC.
//
// offsetMin es lo que devuelve getTimezoneOffset() en el navegador: minutos que
// hay que SUMAR a la hora local para llegar a UTC (El Salvador = 360). Se usa
// solo para agrupar por dia; sin el, una generacion de las 7pm de El Salvador
// caeria en el dia siguiente porque en UTC ya es la 1am.
export async function fetchConsumoEleven(
  desdeUnix: number | null,
  hastaUnix: number | null,
  offsetMin = 0,
): Promise<ConsumoEleven | null> {
  const key = claveEleven();
  if (!key) return null;

  const items = await traerHistorial(key);

  let caracteres = 0;
  let generaciones = 0;
  let masAntiguo: number | null = null;
  const dias = new Map<string, number>();

  for (const it of items) {
    const t = it.date_unix;
    if (typeof t !== "number") continue;
    masAntiguo = masAntiguo === null ? t : Math.min(masAntiguo, t);
    if (desdeUnix !== null && t < desdeUnix) continue;
    if (hastaUnix !== null && t > hastaUnix) continue;

    const usados = (it.character_count_change_to ?? 0) - (it.character_count_change_from ?? 0);
    if (usados <= 0) continue;
    caracteres += usados;
    generaciones += 1;

    const dia = new Date(t * 1000 - offsetMin * 60_000).toISOString().slice(0, 10);
    dias.set(dia, (dias.get(dia) ?? 0) + usados);
  }

  return {
    caracteres,
    generaciones,
    porDia: [...dias.entries()]
      .map(([dia, c]) => ({ dia, caracteres: c }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    desdeUnix,
    hastaUnix,
    masAntiguoUnix: masAntiguo,
  };
}
