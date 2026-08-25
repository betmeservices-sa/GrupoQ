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

  // Messenger e Instagram no devuelven lo mismo, y ahi estuvo el error: para un
  // PSID de Messenger el campo "name" viene vacio. Los que si trae son
  // first_name y last_name. Instagram en cambio si da name, y ademas username.
  //
  // Se piden los dos juegos y se arma con lo que llegue, porque pedir un campo
  // que ese canal no soporta hace fallar la consulta ENTERA y volvemos a
  // quedarnos sin nombre.
  const campos =
    canal === "instagram" ? "name,username" : "first_name,last_name,name";
  let nombre: string | null = null;
  try {
    const url = `${GRAPH}/${encodeURIComponent(senderId)}?fields=${campos}&access_token=${encodeURIComponent(pageToken)}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json()) as {
      name?: string;
      first_name?: string;
      last_name?: string;
      username?: string;
      error?: { message?: string };
    };
    if (j.error) {
      console.error("[meta-perfil]", canal, senderId.slice(-6), j.error.message);
    } else {
      const completo = [j.first_name, j.last_name].filter(Boolean).join(" ").trim();
      const arroba = j.username ? `@${j.username}` : null;
      nombre = completo || (j.name ?? "").trim() || arroba;
    }
  } catch (e) {
    // Sin nombre se sigue igual: perder el nombre no puede perder el mensaje.
    console.error("[meta-perfil] no se pudo consultar:", e);
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
