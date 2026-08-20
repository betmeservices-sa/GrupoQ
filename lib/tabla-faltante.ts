// ¿El error de Supabase es "esa tabla todavía no existe"?
//
// Las tablas nuevas llegan con su migración en supabase/migrations, pero hasta
// que alguien la corre, la app se encuentra con una tabla que no está. Sin este
// chequeo, la pantalla mostraría un error críptico y el demo quedaría muerto.
// Con él, se cae al store en memoria y se avisa que falta correr la migración.
//
// OJO: solo este caso. Cualquier otro error (permisos, red, RLS) se propaga,
// porque tragárselo sería mostrar "no hay promociones" cuando sí las hay.

interface ErrorSupabase {
  code?: string;
  message?: string;
}

/**
 * Recuerda que una tabla no existía, PERO SE OLVIDA sola al rato.
 *
 * La primera versión de esto era un booleano que se encendía para siempre. El
 * problema apareció en producción: se corrió la migración y la app siguió
 * guardando en memoria, porque cada instancia que ya había visto el error no
 * volvía a intentar nunca. Había que redesplegar para algo que ya estaba
 * arreglado en la base.
 *
 * Con la espera, correr la migración alcanza: a los pocos minutos cada instancia
 * reintenta sola y se engancha a la tabla nueva. Mientras tanto no castiga con
 * un error por consulta, que era lo que el booleano quería evitar.
 */
export function latchDeTabla(minutos = 3) {
  let esperarHasta = 0;
  return {
    activo: () => Date.now() < esperarHasta,
    marcar: () => {
      esperarHasta = Date.now() + minutos * 60_000;
    },
  };
}

/**
 * ¿El error es "esa COLUMNA todavía no existe"?
 *
 * Pasa cuando el código sale antes que la migración, que es lo normal: primero
 * se despliega y después alguien corre el SQL. Sin este chequeo, agregar una
 * columna al SELECT deja el panel entero en cero hasta que se corra la
 * migración, y encima en silencio. Ya pasó una vez con `tipo`.
 */
export function columnaFaltante(error: unknown): boolean {
  const e = error as ErrorSupabase | null;
  if (!e) return false;
  // 42703 = undefined_column de Postgres. PGRST204 = PostgREST no la encuentra.
  if (e.code === "42703" || e.code === "PGRST204") return true;
  const m = (e.message ?? "").toLowerCase();
  return m.includes("column") && (m.includes("does not exist") || m.includes("not find"));
}

export function tablaFaltante(error: unknown): boolean {
  const e = error as ErrorSupabase | null;
  if (!e) return false;
  // 42P01 = undefined_table de Postgres. PGRST205 = PostgREST no la encuentra
  // en su caché de esquema (es el que sale por la API REST).
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  const m = (e.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache");
}
