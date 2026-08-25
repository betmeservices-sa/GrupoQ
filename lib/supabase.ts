import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// El tipo de SupabaseClient lleva el esquema como parametro, y por defecto es
// "public". Como aca el esquema se decide en tiempo de ejecucion, se afloja ese
// parametro: si no, TypeScript rechaza al cliente de yali por no ser "public".
type Cliente = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Cliente de Supabase (server-side). Usa la publishable key. Si no hay env de
// Supabase, devuelve null y el resto del código cae al store en memoria.
//
// ── POR QUÉ RECIBE EL TENANT ──
// Yali tiene sus tablas en un esquema propio dentro del MISMO proyecto. No es
// aislamiento de verdad (la app entra con una sola llave para todos, así que
// esa llave alcanza los dos esquemas): es organización, y es el paso previo a
// mudarlo a su propio proyecto. Lo que se gana hoy es que las conversaciones de
// huéspedes reales dejan de vivir en la misma tabla que las de los demos, y que
// el día de la mudanza se lleva un esquema entero en vez de filtrar fila por
// fila.
//
// Si el esquema no está en "Exposed schemas" de Supabase, PostgREST no lo ve y
// devuelve CERO FILAS SIN ERROR. Por eso los stores tienen su latch de "estoy
// cayendo a memoria": es la única señal de que pasó.

/** Qué clientes leen de un esquema propio. El resto sigue en public. */
const ESQUEMA_POR_TENANT: Record<string, string> = {
  yaly: "yali",
};

const cache = new Map<string, Cliente | null>();

export function esquemaDeTenant(tenant?: string): string {
  return (tenant && ESQUEMA_POR_TENANT[tenant]) || "public";
}

export function getSupabase(tenant?: string): Cliente | null {
  const esquema = esquemaDeTenant(tenant);
  const guardado = cache.get(esquema);
  if (guardado !== undefined) return guardado;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const cliente =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false },
          db: { schema: esquema },
        })
      : null;
  cache.set(esquema, cliente);
  return cliente;
}

/**
 * Un cliente por cada esquema que exista, empezando por public.
 *
 * Lo necesita el webhook de Meta: cuando entra un mensaje sabemos el id de la
 * pagina, no de que cliente es. Averiguarlo es justamente el motivo de la
 * consulta, asi que hay que buscar en todos lados. Es la excepcion, no la
 * regla: el resto del codigo ya sabe con quien esta hablando.
 */
export function todosLosClientes(): Cliente[] {
  const esquemas = ["public", ...new Set(Object.values(ESQUEMA_POR_TENANT))];
  const out: Cliente[] = [];
  for (const e of esquemas) {
    const c = getSupabase(inversa(e));
    if (c) out.push(c);
  }
  return out;
}

/** El tenant de un esquema, para poder pedir su cliente. */
function inversa(esquema: string): string | undefined {
  if (esquema === "public") return undefined;
  return Object.keys(ESQUEMA_POR_TENANT).find((t) => ESQUEMA_POR_TENANT[t] === esquema);
}
