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

export function tablaFaltante(error: unknown): boolean {
  const e = error as ErrorSupabase | null;
  if (!e) return false;
  // 42P01 = undefined_table de Postgres. PGRST205 = PostgREST no la encuentra
  // en su caché de esquema (es el que sale por la API REST).
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  const m = (e.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache");
}
