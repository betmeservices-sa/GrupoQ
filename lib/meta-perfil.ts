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
// Perfil por la cuenta de Instagram misma (API con inicio de sesión de
// Instagram). Es la única que da el nombre de un desconocido sin App Review:
// el token de la página, con acceso estándar, no lo ve.
const IG_GRAPH = "https://graph.instagram.com/v23.0";

// Cache en memoria: la misma persona manda varios mensajes seguidos y no tiene
// sentido preguntarle a Meta por cada uno. Vive en globalThis porque en dev
// cada ruta compila su propia instancia del módulo.
const g = globalThis as unknown as {
  __metaPerfiles?: Map<string, { nombre: string | null; hasta: number }>;
  __metaParticipantes?: Map<string, { nombres: Map<string, string>; hasta: number }>;
};
const cache = (g.__metaPerfiles ??= new Map());
// Nombres sacados de la lista de conversaciones de la página, por page_id.
const participantes = (g.__metaParticipantes ??= new Map());

// Se guarda poco tiempo a propósito: quien escribe por primera vez todavía no
// está en la última lista que trajimos, y con seis horas de cache se quedaría
// sin nombre durante seis horas.
const MINUTOS = 10 * 60 * 1000;
const CONVERSACIONES = 200;

/**
 * Los nombres de quienes le escribieron a una página, por su id.
 *
 * Existe porque preguntar por una persona suelta está prohibido para esta app:
 * Meta responde "(#3) Application does not have the capability to make this API
 * call" hasta que pase el App Review. La lista de conversaciones de la página,
 * en cambio, SÍ trae el nombre de cada participante, y es la misma información.
 *
 * Por eso la bandeja mostraba "FB 515838" en vez de "Ruth Ibarra": no es que el
 * nombre no se pudiera saber, es que se estaba preguntando por donde no era.
 */
async function nombresDeLaPagina(
  pageId: string,
  pageToken: string,
  ahora: number,
): Promise<Map<string, string>> {
  const guardado = participantes.get(pageId);
  if (guardado && guardado.hasta > ahora) return guardado.nombres;

  const nombres = new Map<string, string>();
  try {
    const url = `${GRAPH}/${encodeURIComponent(pageId)}/conversations?fields=participants&limit=${CONVERSACIONES}&access_token=${encodeURIComponent(pageToken)}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json()) as {
      data?: { participants?: { data?: { id?: string; name?: string }[] } }[];
      error?: { message?: string };
    };
    if (j.error) {
      console.error("[meta-perfil] conversaciones de", pageId, j.error.message);
    }
    for (const conv of j.data ?? []) {
      for (const p of conv.participants?.data ?? []) {
        // La página también figura como participante de su propia
        // conversación; se guarda igual y no molesta, porque nadie la busca.
        if (p?.id && p?.name) nombres.set(p.id, p.name);
      }
    }
  } catch (e) {
    console.error("[meta-perfil] no se pudo listar conversaciones:", e);
  }

  participantes.set(pageId, { nombres, hasta: ahora + MINUTOS });
  return nombres;
}

const HORAS = 6 * 60 * 60 * 1000;
const MAX = 500;

async function nombrePorCuentaIg(senderId: string, igToken: string): Promise<string | null> {
  try {
    const url = `${IG_GRAPH}/${encodeURIComponent(senderId)}?fields=name,username&access_token=${encodeURIComponent(igToken)}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json()) as { name?: string; username?: string; error?: { message?: string } };
    if (j.error) {
      console.error("[meta-perfil] cuenta ig", senderId.slice(-6), j.error.message);
      return null;
    }
    return (j.name ?? "").trim() || (j.username ? `@${j.username}` : null);
  } catch (e) {
    console.error("[meta-perfil] no se pudo consultar por la cuenta:", e);
    return null;
  }
}

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
  pageId?: string,
  igToken?: string | null,
): Promise<string | null> {
  if (!senderId || (!pageToken && !igToken)) return null;

  const guardado = cache.get(senderId);
  if (guardado && guardado.hasta > ahora) return guardado.nombre;

  // Primera puerta en Instagram: la cuenta misma. Con acceso estándar, el
  // token de la página no ve el perfil de un desconocido y la bandeja mostraba
  // "IG 381463"; el token de la cuenta sí lo ve (nombre y usuario).
  if (canal === "instagram" && igToken) {
    const porCuenta = await nombrePorCuentaIg(senderId, igToken);
    if (porCuenta) {
      if (cache.size >= MAX) cache.clear();
      cache.set(senderId, { nombre: porCuenta, hasta: ahora + HORAS });
      return porCuenta;
    }
  }
  if (!pageToken) return null;

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

  // Segunda puerta: la lista de conversaciones de la página. Se intenta solo si
  // la primera no dio nombre, que hoy es siempre en Messenger y nunca en
  // Instagram.
  if (!nombre && pageId) {
    const nombres = await nombresDeLaPagina(pageId, pageToken, ahora);
    nombre = nombres.get(senderId) ?? null;
  }

  if (cache.size >= MAX) cache.clear();
  // Un nombre encontrado se guarda por horas; no haberlo encontrado, por
  // minutos: si la persona acaba de escribir por primera vez, en la próxima
  // vuelta ya va a estar en la lista.
  cache.set(senderId, { nombre, hasta: ahora + (nombre ? HORAS : MINUTOS) });
  return nombre;
}

/** Para las pruebas y para cuando se reconecta una página con otro token. */
export function olvidarPerfiles(): void {
  cache.clear();
}
