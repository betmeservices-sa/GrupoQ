// El nombre de quien escribe por Messenger o Instagram.
//
// Meta NO lo manda en el webhook: en cada evento viene solo un id opaco (el
// PSID de Messenger o el IGSID de Instagram), distinto para cada página, que no
// sirve para nada más que responderle. Por eso la bandeja mostraba "FB 087261"
// en vez del nombre: no es que se perdiera, es que nunca vino.
//
// El nombre hay que ir a pedirlo con el token de la página. Solo funciona con
// gente que YA le escribió a esa página, que es justamente nuestro caso.

const GRAPH = "https://graph.facebook.com/v21.0";

// Cache en memoria: la misma persona manda varios mensajes seguidos y no tiene
// sentido preguntarle a Meta por cada uno. Vive en globalThis porque en dev
// cada ruta compila su propia instancia del módulo.
const g = globalThis as unknown as {
  __metaPerfiles?: Map<string, { nombre: string | null; hasta: number }>;
};
const cache = (g.__metaPerfiles ??= new Map());

const HORAS = 6 * 60 * 60 * 1000;
const MAX = 500;

/**
 * El nombre de un remitente, o null si Meta no lo da.
 *
 * Devolver null no es un error: pasa cuando la persona tiene el perfil
 * restringido, cuando el token de la página perdió permiso, o cuando Meta
 * simplemente no lo expone. Quien llama decide qué mostrar en ese caso, y hoy
 * muestra el canal con el final del id, que es mejor que un campo vacío.
 */
export async function nombreDelRemitente(
  senderId: string,
  canal: "facebook" | "instagram",
  pageToken: string,
  ahora = Date.now(),
): Promise<string | null> {
  if (!senderId || !pageToken) return null;

  const guardado = cache.get(senderId);
  if (guardado && guardado.hasta > ahora) return guardado.nombre;

  // En Instagram el nombre puede venir vacío y el arroba no: se pide el username
  // como respaldo, porque "@yali_hotel" identifica igual de bien que un nombre.
  const campos = canal === "instagram" ? "name,username" : "name";
  let nombre: string | null = null;
  try {
    const url = `${GRAPH}/${encodeURIComponent(senderId)}?fields=${campos}&access_token=${encodeURIComponent(pageToken)}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json()) as { name?: string; username?: string; error?: unknown };
    if (!j.error) {
      const arroba = j.username ? `@${j.username}` : null;
      nombre = (j.name ?? "").trim() || arroba;
    }
  } catch {
    // Sin nombre se sigue igual: perder el nombre no puede perder el mensaje.
    nombre = null;
  }

  if (cache.size >= MAX) cache.clear();
  cache.set(senderId, { nombre, hasta: ahora + HORAS });
  return nombre;
}

/** Para las pruebas y para cuando se reconecta una página con otro token. */
export function olvidarPerfiles(): void {
  cache.clear();
}
