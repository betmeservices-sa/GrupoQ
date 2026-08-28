// Registro de accesos y actividad de los usuarios del panel.
//
// Dos cosas distintas: el LOG (cada vez que alguien inicia sesión queda un
// renglón: quién, de qué cliente, cuándo, desde dónde) y la ACTIVIDAD (la
// última vez que cada usuario tocó el panel, para decir "activo ahora"). La
// actividad se toca desde las rutas que el navegador llama seguido (la
// bandeja sondea cada pocos segundos), pero se escribe a lo sumo una vez por
// minuto por usuario para no llenar la base de escrituras iguales.

import { getSupabase } from "./supabase";

export interface Acceso {
  ts: string;
  tenant: string;
  usuario: string;
  nombre: string | null;
  rol: string | null;
  todos: boolean;
  host: string | null;
  ip: string | null;
  agente: string | null;
}

export interface Actividad {
  usuario: string;
  tenant: string;
  nombre: string | null;
  rol: string | null;
  ultimoVisto: string;
  ultimoHost: string | null;
}

/** Con menos de esto desde el último toque, la persona está "activa ahora". */
export const ACTIVO_MS = 3 * 60_000;
const TOQUE_CADA_MS = 60_000;

const memAccesos: Acceso[] = [];
const memActividad = new Map<string, Actividad>();
const ultimoToque = new Map<string, number>();

/** Desde dónde entró: la IP que manda el proxy, o nada. */
export function ipDe(req: Request): string | null {
  const xf = req.headers.get("x-forwarded-for");
  return (xf ? xf.split(",")[0].trim() : req.headers.get("x-real-ip")) || null;
}

/** Un inicio de sesión. Nunca lanza: un log que tumba el login no sirve. */
export async function registrarAcceso(a: Omit<Acceso, "ts">): Promise<void> {
  const fila: Acceso = { ...a, ts: new Date().toISOString() };
  try {
    const sb = getSupabase();
    if (!sb) memAccesos.unshift(fila);
    const { error } = !sb
      ? { error: null }
      : await sb.from("accesos_log").insert({
      ts: fila.ts,
      tenant: fila.tenant,
      usuario: fila.usuario,
      nombre: fila.nombre,
      rol: fila.rol,
      todos: fila.todos,
      host: fila.host,
      ip: fila.ip,
      agente: fila.agente ? fila.agente.slice(0, 300) : null,
        });
    if (error) console.error("[accesos] log:", error.message);
  } catch (e) {
    console.error("[accesos] log:", e instanceof Error ? e.message : e);
  }
  await tocarActividad({ usuario: a.usuario, tenant: a.tenant, nombre: a.nombre, rol: a.rol, host: a.host }, true);
}

/** La persona sigue adentro. A lo sumo una escritura por minuto por usuario. */
export async function tocarActividad(
  a: { usuario: string; tenant: string; nombre?: string | null; rol?: string | null; host?: string | null },
  forzar = false,
): Promise<void> {
  const ahora = Date.now();
  const antes = ultimoToque.get(a.usuario) ?? 0;
  if (!forzar && ahora - antes < TOQUE_CADA_MS) return;
  ultimoToque.set(a.usuario, ahora);
  const fila: Actividad = {
    usuario: a.usuario,
    tenant: a.tenant,
    nombre: a.nombre ?? null,
    rol: a.rol ?? null,
    ultimoVisto: new Date(ahora).toISOString(),
    ultimoHost: a.host ?? null,
  };
  try {
    const sb = getSupabase();
    if (!sb) {
      memActividad.set(a.usuario, fila);
      return;
    }
    const { error } = await sb.from("usuarios_actividad").upsert(
      {
        usuario: fila.usuario,
        tenant: fila.tenant,
        nombre: fila.nombre,
        rol: fila.rol,
        ultimo_visto: fila.ultimoVisto,
        ultimo_host: fila.ultimoHost,
      },
      { onConflict: "usuario" },
    );
    if (error) console.error("[accesos] actividad:", error.message);
  } catch (e) {
    console.error("[accesos] actividad:", e instanceof Error ? e.message : e);
  }
}

/** Los últimos inicios de sesión (todos los clientes o uno), lo más nuevo primero. */
export async function listarAccesos(opciones: { tenant?: string; dias?: number; tope?: number } = {}): Promise<Acceso[]> {
  const desde = new Date(Date.now() - (opciones.dias ?? 30) * 86_400_000).toISOString();
  const sb = getSupabase();
  if (!sb) {
    return memAccesos.filter((a) => a.ts >= desde && (!opciones.tenant || a.tenant === opciones.tenant)).slice(0, opciones.tope ?? 200);
  }
  let q = sb.from("accesos_log").select("ts, tenant, usuario, nombre, rol, todos, host, ip, agente").gte("ts", desde).order("ts", { ascending: false }).limit(opciones.tope ?? 200);
  if (opciones.tenant) q = q.eq("tenant", opciones.tenant);
  const { data, error } = await q;
  if (error) {
    console.error("[accesos] listar:", error.message);
    return [];
  }
  return (data ?? []) as Acceso[];
}

export async function actividadDeUsuarios(): Promise<Actividad[]> {
  const sb = getSupabase();
  if (!sb) return [...memActividad.values()];
  const { data, error } = await sb.from("usuarios_actividad").select("usuario, tenant, nombre, rol, ultimo_visto, ultimo_host").limit(500);
  if (error) {
    console.error("[accesos] actividad listar:", error.message);
    return [];
  }
  return ((data ?? []) as { usuario: string; tenant: string; nombre: string | null; rol: string | null; ultimo_visto: string; ultimo_host: string | null }[]).map((r) => ({
    usuario: r.usuario,
    tenant: r.tenant,
    nombre: r.nombre,
    rol: r.rol,
    ultimoVisto: r.ultimo_visto,
    ultimoHost: r.ultimo_host,
  }));
}

/** true si tocó el panel hace menos de ACTIVO_MS. */
export function estaActivo(ultimoVisto: string | null | undefined, ahora = Date.now()): boolean {
  if (!ultimoVisto) return false;
  const t = Date.parse(ultimoVisto);
  return Number.isFinite(t) && ahora - t < ACTIVO_MS;
}

/** Solo para pruebas. */
export function _vaciarAccesos(): void {
  memAccesos.length = 0;
  memActividad.clear();
  ultimoToque.clear();
}
