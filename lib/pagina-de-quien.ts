// De quién es una página de Facebook, cuando dos clientes se la disputan.
//
// POR QUÉ EXISTE. El 9 de septiembre de 2026 alguien abrió "Conectar Facebook e
// Instagram" con la sesión puesta en MiAgentIA y en el diálogo de Meta marcó
// las páginas de Yali. Meta no pregunta a qué cliente van: el tenant lo decide
// la cookie del panel desde donde se apretó el botón, y eso no se ve en ningún
// lado durante el flujo.
//
// Las cuatro páginas de Yali quedaron colgadas de DOS clientes a la vez. Como
// la baranda que impide que el demo conteste lo de Yali mira el tenant
// (`if (tenant === "yaly") return`), y esas páginas ahora también eran de
// "miagentia", la baranda no aplicó: el agente del demo le escribió a una
// persona real de Sunzal Beach Club ofreciéndole agentes de IA.
//
// De ahí salen las dos reglas de este archivo:
//
//   1. AL CONECTAR: una página que ya es de otro cliente NO se conecta. Es la
//      que hace imposible el incidente, y no depende de que nadie se fije.
//   2. AL ENRUTAR: si igual quedaran dos, gana el PRIMERO que la conectó. Antes
//      ganaba el primero que devolviera la base, que no es un orden: el mismo
//      mensaje podía caer en un cliente o en otro según el día.

export interface DuenoPosible {
  tenant: string;
  /** Cuándo se conectó (ISO). Sin esto no hay forma de saber quién llegó antes. */
  connectedAt?: string | null;
}

/**
 * Cuál de las conexiones manda cuando hay más de una para la misma página.
 *
 * Gana la más vieja: el cliente que la conectó primero es su dueño, y el
 * segundo es el error. Empatadas o sin fecha, gana el primero de la lista, que
 * al menos es estable dentro de una misma consulta.
 */
export function dueno<T extends DuenoPosible>(conexiones: readonly T[]): T | null {
  if (conexiones.length === 0) return null;
  if (conexiones.length === 1) return conexiones[0];
  return conexiones.reduce((mejor, c) => (esAnterior(c, mejor) ? c : mejor));
}

function esAnterior(a: DuenoPosible, b: DuenoPosible): boolean {
  const ta = Date.parse(a.connectedAt ?? "");
  const tb = Date.parse(b.connectedAt ?? "");
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta < tb;
}

/**
 * ¿Esta página está colgada de más de un cliente?
 *
 * Que aparezca dos veces NO alcanza para gritar: una misma página puede estar
 * guardada en dos esquemas para el MISMO cliente, y eso es normal. Lo que no
 * puede pasar es que dos clientes distintos se la disputen.
 */
export function enDisputa(conexiones: readonly DuenoPosible[]): boolean {
  return new Set(conexiones.map((c) => c.tenant)).size > 1;
}

export interface PaginaAConectar {
  id: string;
  name: string;
}

export interface RepartoConexion<T extends PaginaAConectar> {
  /** Las que sí se conectan: libres, o ya de este mismo cliente. */
  propias: T[];
  /** Las de otro cliente. No se tocan ni se suscriben a los webhooks. */
  ajenas: Array<{ pagina: T; de: string }>;
}

/**
 * Separa lo que se puede conectar de lo que es de otro.
 *
 * `duenoDe` responde de quién es cada página hoy, o null si está libre.
 *
 * Se rechaza en silencio y se reporta, en vez de fallar todo el flujo: quien
 * marcó de más en el diálogo de Meta suele haber marcado también las suyas, y
 * hacerlo empezar de cero por eso es castigarlo por un error que la pantalla
 * nunca le avisó que estaba cometiendo.
 */
export function repartirPaginas<T extends PaginaAConectar>(
  paginas: readonly T[],
  tenant: string,
  duenoDe: (pageId: string) => string | null,
): RepartoConexion<T> {
  const propias: T[] = [];
  const ajenas: Array<{ pagina: T; de: string }> = [];
  for (const p of paginas) {
    const de = duenoDe(p.id);
    if (!de || de === tenant) propias.push(p);
    else ajenas.push({ pagina: p, de });
  }
  return { propias, ajenas };
}
