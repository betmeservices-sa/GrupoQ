// Llamadas EN CURSO. Consulta ligera y separada del historial: el dashboard la
// pide cada pocos segundos, asi que no toca la base ni resuelve catalogos
// pesados. Solo importa saber si hay alguien en linea ahora mismo.
// SOLO servidor: la key nunca llega al browser.
import type { CallDirection } from "./data/types";

const VAPI_BASE = "https://api.vapi.ai";

// Estados que Vapi reporta mientras la llamada sigue viva. "ended" queda fuera
// a proposito: una llamada terminada no es una llamada en curso.
const ESTADOS_VIVOS = new Set(["queued", "ringing", "in-progress", "forwarding"]);

export interface LlamadaEnCurso {
  id: string;
  direccion: CallDirection;
  numeroCliente?: string;
  numeroPropio?: string;
  nombreNumero?: string;
  // El id del agente viaja para poder recortar por tenant en el route handler.
  assistantId?: string;
  nombreAssistant?: string;
  estado: string;
  // Momento en que se origino. La UI calcula el cronometro con esto para que
  // siga corriendo entre consultas, sin esperar al proximo refresco.
  desde?: string;
  // true cuando ya contestaron; false si todavia esta timbrando o en cola.
  hablando: boolean;
}

// Conteo por linea. Sirve para ver de un vistazo cual numero esta cargado,
// no solo cuantas llamadas hay en total.
export interface ResumenPorNumero {
  phoneNumberId?: string;
  numero: string;
  nombre: string;
  activas: number;
  // De las activas, cuantas ya estan en conversacion (el resto timbra o espera).
  hablando: number;
}

export interface EstadoEnVivo {
  activas: LlamadaEnCurso[];
  total: number;
  // Total que YA esta en conversacion. Separado del total porque una llamada
  // timbrando todavia no consume agente.
  hablando: number;
  porNumero: ResumenPorNumero[];
  consultadoEn: string;
  fuente: "vapi" | "demo";
  error?: string;
}

interface VapiCallLive {
  id: string;
  type?: string;
  status?: string;
  customer?: { number?: string };
  phoneNumberId?: string;
  assistantId?: string;
  createdAt?: string;
  startedAt?: string;
}

function direccionDe(type: unknown): CallDirection {
  if (type === "inboundPhoneCall") return "inbound";
  if (type === "outboundPhoneCall") return "outbound";
  return "web";
}

async function pedir<T>(ruta: string, key: string, ms = 8000): Promise<T> {
  // Timeout corto: esto se consulta en bucle. Si Vapi tarda, preferimos fallar
  // rapido y reintentar en el proximo ciclo antes que encolar peticiones.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(`${VAPI_BASE}${ruta}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`Vapi respondio ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Cache corto de los catalogos: los nombres de numeros y agentes casi no
// cambian, y sin esto cada refresco haria tres llamadas a Vapi en vez de una.
let catalogo: { numeros: Map<string, { numero: string; nombre: string }>; agentes: Map<string, string>; vence: number } | null = null;

async function cargarCatalogo(key: string) {
  const ahora = Date.now();
  if (catalogo && catalogo.vence > ahora) return catalogo;
  try {
    const [numeros, agentes] = await Promise.all([
      pedir<Array<{ id: string; number?: string; name?: string }>>("/phone-number", key),
      pedir<Array<{ id: string; name?: string }>>("/assistant", key),
    ]);
    catalogo = {
      numeros: new Map(
        (Array.isArray(numeros) ? numeros : []).map((n) => [n.id, { numero: n.number ?? "", nombre: n.name ?? "" }]),
      ),
      agentes: new Map((Array.isArray(agentes) ? agentes : []).map((a) => [a.id, a.name ?? ""])),
      vence: ahora + 5 * 60 * 1000,
    };
  } catch {
    // Sin catalogo igual sirve: se muestran los numeros crudos.
    catalogo = { numeros: new Map(), agentes: new Map(), vence: ahora + 30 * 1000 };
  }
  return catalogo;
}

export function hayLlaveVapi(): boolean {
  return Boolean(process.env.VAPI_PRIVATE_KEY);
}

export async function fetchLlamadasEnCurso(): Promise<EstadoEnVivo> {
  const key = process.env.VAPI_PRIVATE_KEY;
  const consultadoEn = new Date().toISOString();

  if (!key) {
    return { activas: [], total: 0, hablando: 0, porNumero: [], consultadoEn, fuente: "demo" };
  }

  try {
    // Se piden pocas y recientes: una llamada viva siempre esta arriba del
    // listado, asi que traer 200 seria desperdicio en un bucle de segundos.
    const data = await pedir<unknown>("/call?limit=25", key);
    const arr = Array.isArray(data) ? (data as VapiCallLive[]) : [];
    const vivas = arr.filter((c) => ESTADOS_VIVOS.has(String(c.status ?? "")));

    // Siempre se carga: el desglose por linea debe mostrar tambien los numeros
    // en cero. Va cacheado 5 min, asi que no pega a Vapi en cada refresco.
    const cat = await cargarCatalogo(key);

    const activas: LlamadaEnCurso[] = vivas.map((c) => {
      const num = c.phoneNumberId ? cat?.numeros.get(c.phoneNumberId) : undefined;
      return {
        id: c.id,
        direccion: direccionDe(c.type),
        numeroCliente: c.customer?.number,
        numeroPropio: num?.numero,
        nombreNumero: num?.nombre,
        assistantId: c.assistantId,
        nombreAssistant: c.assistantId ? cat?.agentes.get(c.assistantId) : undefined,
        estado: String(c.status ?? ""),
        desde: c.startedAt ?? c.createdAt,
        hablando: c.status === "in-progress",
      };
    });

    // Agrupado por linea. Se listan TODOS los numeros de la cuenta, no solo los
    // que tienen trafico: ver un numero en cero tambien es informacion.
    const porNumero: ResumenPorNumero[] = [];
    if (cat) {
      for (const [id, info] of cat.numeros) {
        const suyas = activas.filter((a) => a.numeroPropio === info.numero);
        porNumero.push({
          phoneNumberId: id,
          numero: info.numero,
          nombre: info.nombre,
          activas: suyas.length,
          hablando: suyas.filter((a) => a.hablando).length,
        });
      }
      // Los que tienen llamadas primero; entre iguales, por nombre.
      porNumero.sort((a, b) => b.activas - a.activas || a.nombre.localeCompare(b.nombre));
    }

    return {
      activas,
      total: activas.length,
      hablando: activas.filter((a) => a.hablando).length,
      porNumero,
      consultadoEn,
      fuente: "vapi",
    };
  } catch (err) {
    // Un fallo de red no debe romper la vista: se reporta y la UI muestra el
    // ultimo estado conocido con un aviso.
    return {
      activas: [],
      total: 0,
      hablando: 0,
      porNumero: [],
      consultadoEn,
      fuente: "vapi",
      error: err instanceof Error ? err.message : "Error consultando Vapi",
    };
  }
}
