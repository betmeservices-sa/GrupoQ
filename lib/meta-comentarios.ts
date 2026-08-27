// Comentarios de las publicaciones, en Facebook e Instagram.
//
// Es donde se pierden más reservas: alguien pregunta el precio debajo de una
// foto, nadie contesta en dos días, y se fue. Los mensajes privados ya se
// atienden (ver meta-messages-store); esto es la otra mitad.
//
// Los permisos ya venían pedidos en el OAuth: pages_read_user_content y
// pages_manage_engagement para Facebook, instagram_manage_comments para
// Instagram. No hay que volver a autorizar nada.

import type { MetaConnection } from "./meta-store";
import { esComentarioInstagram, ocultarComentarioIg, responderComentarioIg } from "./meta-ig-login";
import { autoresDeComentarios } from "./meta-feed-autores";

const GRAPH = "https://graph.facebook.com/v21.0";

export type RedComentario = "facebook" | "instagram";

export interface Comentario {
  id: string;
  red: RedComentario;
  /** Publicación sobre la que se comentó. */
  postId: string;
  /** Texto o miniatura del post, para saber de qué hablan sin salir de la lista. */
  postResumen?: string;
  postImagen?: string;
  /** Enlace a la publicacion en Facebook o Instagram, para abrirla y verla. */
  postEnlace?: string;
  autor: string;
  texto: string;
  ts: string;
  /** Cuántas respuestas tiene ya (las nuestras y las de otros). */
  respuestas: number;
  /** true si es respuesta a otro comentario, no un comentario de primer nivel. */
  esRespuesta: boolean;
  /**
   * La cuenta YA le contestó. Es lo que decide "sin responder": que otra
   * persona le haya respondido no cuenta, y antes contaba. Un reclamo con una
   * respuesta de otro cliente quedaba como atendido.
   */
  respondido: boolean;
  /** Si es respuesta: a quién le respondió (para leer el hilo). */
  respuestaA?: string;
  /**
   * Si es respuesta: el comentario de arriba. Responder va contra ese: ni
   * Facebook ni Instagram dejan colgar una respuesta de otra respuesta.
   */
  padreId?: string;
  oculto: boolean;
  meGusta: number;
  /** Página o cuenta a la que pertenece, para responder con el token correcto. */
  pageId: string;
  /**
   * Enlace al comentario mismo en Facebook. Existe porque sin App Review Meta
   * no dice quién comentó ("Sin identificar"); abriéndolo se ve la persona.
   */
  enlace?: string;
  /** Meta deja mandarle un Messenger privado a quien comentó. */
  privadoPosible?: boolean;
  /**
   * Id de quien comentó, con alcance de página (no es su id global). Sirve
   * para agrupar comentarios de la misma persona; no para abrir su perfil.
   */
  autorId?: string;
}

interface RespuestaGraph<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string; code?: number; type?: string };
}

async function pedir<T>(url: string): Promise<RespuestaGraph<T>> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return (await r.json()) as RespuestaGraph<T>;
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "fallo la red" } };
  }
}

// Cuánto se trae.
//
// Antes eran 15 publicaciones y 25 comentarios por publicación, sin seguir las
// páginas siguientes. Con eso el panel decía "no hay comentarios sin responder"
// mientras en Facebook sí los había, que es la peor forma de fallar: no se ve
// el hueco.
const LIMITE_POSTS = 25;
const LIMITE_COMENTARIOS = 100;
// Tope de páginas a seguir. 6 x 25 = 150 publicaciones, más de un año para
// quien publica tres veces por semana.
const MAX_PAGINAS = 6;

/**
 * Como `pedir`, pero siguiendo las páginas siguientes de Meta.
 *
 * Si una página falla se devuelve lo que ya se juntó en vez de tirar todo: es
 * mejor mostrar las publicaciones que sí llegaron que una pantalla en blanco.
 */
async function pedirTodo<T>(primera: string): Promise<T[]> {
  const todo: T[] = [];
  let url: string | undefined = primera;
  for (let i = 0; url && i < MAX_PAGINAS; i++) {
    const r: RespuestaGraph<T> = await pedir<T>(url);
    if (r.error) {
      if (i === 0) throw new Error(r.error.message ?? "Meta no devolvió los comentarios.");
      console.error("[comentarios] se corta la paginación:", r.error.message);
      break;
    }
    const lote = r.data ?? [];
    if (lote.length === 0) break;
    todo.push(...lote);
    url = r.paging?.next;
  }
  return todo;
}

/** Recorta el texto de un post para usarlo de referencia en la lista. */
function resumir(t?: string): string | undefined {
  if (!t) return undefined;
  const limpio = t.replace(/\s+/g, " ").trim();
  return limpio.length > 70 ? limpio.slice(0, 70) + "..." : limpio;
}

// ── Facebook ─────────────────────────────────────────────────────────────────

interface PostFb {
  id: string;
  permalink_url?: string;
  message?: string;
  full_picture?: string;
  comments?: {
    data?: {
      id: string;
      message?: string;
      created_time?: string;
      from?: { name?: string };
      like_count?: number;
      is_hidden?: boolean;
      comment_count?: number;
      parent?: { id?: string };
      permalink_url?: string;
      can_reply_privately?: boolean;
      comments?: {
        data?: {
          id: string;
          message?: string;
          created_time?: string;
          from?: { id?: string; name?: string };
          is_hidden?: boolean;
          like_count?: number;
        }[];
      };
    }[];
  };
}

/**
 * Comentarios de las últimas publicaciones de una página.
 *
 * Se piden anidados dentro de los posts en una sola llamada en vez de un pedido
 * por post: con veinte publicaciones eso serían veintiún viajes, y la pantalla
 * tardaría más que lo que la gente está dispuesta a esperar.
 *
 * OJO CON EL ORDEN. Facebook entrega los comentarios del MÁS VIEJO al más
 * nuevo. Con un tope de 25 eso significaba quedarse con los 25 primeros y
 * perder los últimos, que son justo los que hay que contestar: en una
 * publicación con cuarenta comentarios, los de esta semana no aparecían.
 * `reverse_chronological` invierte eso y trae los nuevos primero.
 */
export async function comentariosFacebook(
  c: MetaConnection,
  limitePosts = LIMITE_POSTS,
): Promise<Comentario[]> {
  // `from{id,name}` desarmado en vez de `from` a secas, y `permalink_url` para
  // poder abrir la publicacion desde el panel.
  const campos =
    `id,message,full_picture,permalink_url,created_time,comments.limit(${LIMITE_COMENTARIOS}).order(reverse_chronological){id,message,created_time,from{id,name},like_count,is_hidden,comment_count,parent,permalink_url,can_reply_privately,comments.limit(25){id,message,created_time,from{id,name},is_hidden,like_count}}`;
  const url = `${GRAPH}/${c.pageId}/posts?fields=${encodeURIComponent(campos)}&limit=${limitePosts}&access_token=${c.pageToken}`;
  const posts = await pedirTodo<PostFb>(url);

  const out: Comentario[] = [];
  for (const post of posts) {
    for (const co of post.comments?.data ?? []) {
      out.push({
        id: co.id,
        red: "facebook",
        postId: post.id,
        postResumen: resumir(post.message),
        postImagen: post.full_picture,
        postEnlace: post.permalink_url,
        // Meta no siempre dice quien comento. Con Acceso Estandar solo da el
        // nombre de quien tiene un rol en la pagina; para el resto hace falta
        // Acceso Avanzado a pages_read_user_content, que se pide en la revision
        // de la app. Cuando falta se dice que no se sabe, no se inventa.
        autor: co.from?.name ?? "Sin identificar",
        texto: co.message ?? "",
        ts: co.created_time ?? new Date().toISOString(),
        respuestas: co.comment_count ?? 0,
        esRespuesta: Boolean(co.parent?.id),
        oculto: co.is_hidden === true,
        meGusta: co.like_count ?? 0,
        pageId: c.pageId,
        enlace: co.permalink_url,
        privadoPosible: co.can_reply_privately === true,
        respondido: (co.comments?.data ?? []).some((r) => r.from?.id === c.pageId),
      });
      // Las respuestas de otras personas también son comentarios que hay que
      // ver: un reclamo suele venir como respuesta a otro. Las nuestras no se
      // listan, ya están contadas en "respondido".
      for (const r of co.comments?.data ?? []) {
        if (r.from?.id === c.pageId) continue;
        out.push({
          id: r.id,
          red: "facebook",
          postId: post.id,
          postResumen: resumir(post.message),
          postImagen: post.full_picture,
          postEnlace: post.permalink_url,
          autor: r.from?.name ?? "Sin identificar",
          texto: r.message ?? "",
          ts: r.created_time ?? co.created_time ?? new Date().toISOString(),
          respuestas: 0,
          esRespuesta: true,
          respuestaA: co.from?.name ?? "Sin identificar",
          padreId: co.id,
          oculto: r.is_hidden === true,
          meGusta: r.like_count ?? 0,
          pageId: c.pageId,
          respondido: false,
        });
      }
    }
  }

  // Lo que la API no dice, el aviso de Meta sí lo dijo cuando llegó: el
  // nombre de quien comentó se guardó en ese momento. Se rellena desde ahí.
  const sinNombre = out.filter((x) => x.autor === "Sin identificar").map((x) => x.id);
  if (sinNombre.length) {
    const autores = await autoresDeComentarios(sinNombre);
    for (const x of out) {
      const a = autores.get(x.id);
      if (a) {
        x.autor = a.nombre;
        x.autorId = a.fromId ?? undefined;
      }
    }
  }
  return out;
}

// ── Instagram ────────────────────────────────────────────────────────────────

interface MediaIg {
  id: string;
  permalink?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  comments?: {
    data?: {
      id: string;
      text?: string;
      timestamp?: string;
      username?: string;
      like_count?: number;
      hidden?: boolean;
      replies?: {
        data?: {
          id: string;
          text?: string;
          timestamp?: string;
          username?: string;
          hidden?: boolean;
          like_count?: number;
        }[];
      };
    }[];
  };
}

export async function comentariosInstagram(
  c: MetaConnection,
  limitePosts = LIMITE_POSTS,
): Promise<Comentario[]> {
  if (!c.igId) return [];
  // Una respuesta es "nuestra" si la firma el usuario de la cuenta. Sin ese
  // usuario guardado (cuentas sin login propio) no se puede saber, y se queda
  // como sin responder, que es el lado seguro.
  const cuenta = (c.igUsername ?? "").toLowerCase();
  const esNuestra = (username: string | undefined) =>
    Boolean(cuenta) && (username ?? "").toLowerCase() === cuenta;
  const campos =
    `id,caption,media_url,thumbnail_url,permalink,comments.limit(${LIMITE_COMENTARIOS}){id,text,timestamp,username,like_count,hidden,replies{id,text,timestamp,username,hidden,like_count}}`;
  const url = `${GRAPH}/${c.igId}/media?fields=${encodeURIComponent(campos)}&limit=${limitePosts}&access_token=${c.pageToken}`;
  const medias = await pedirTodo<MediaIg>(url);

  const out: Comentario[] = [];
  for (const m of medias) {
    for (const co of m.comments?.data ?? []) {
      out.push({
        id: co.id,
        red: "instagram",
        postId: m.id,
        postResumen: resumir(m.caption),
        // Los videos no traen media_url usable como miniatura; para eso está thumbnail_url.
        postImagen: m.thumbnail_url ?? m.media_url,
        postEnlace: m.permalink,
        autor: co.username ? `@${co.username}` : "Sin identificar",
        texto: co.text ?? "",
        ts: co.timestamp ?? new Date().toISOString(),
        respuestas: co.replies?.data?.length ?? 0,
        esRespuesta: false,
        oculto: co.hidden === true,
        meGusta: co.like_count ?? 0,
        pageId: c.pageId,
        respondido: (co.replies?.data ?? []).some((r) => esNuestra(r.username)),
      });
      for (const r of co.replies?.data ?? []) {
        if (esNuestra(r.username)) continue;
        out.push({
          id: r.id,
          red: "instagram",
          postId: m.id,
          postResumen: resumir(m.caption),
          postImagen: m.thumbnail_url ?? m.media_url,
          postEnlace: m.permalink,
          autor: r.username ? `@${r.username}` : "Sin identificar",
          texto: r.text ?? "",
          ts: r.timestamp ?? co.timestamp ?? new Date().toISOString(),
          respuestas: 0,
          esRespuesta: true,
          respuestaA: co.username ? `@${co.username}` : "Sin identificar",
          padreId: co.id,
          oculto: r.hidden === true,
          meGusta: r.like_count ?? 0,
          pageId: c.pageId,
          respondido: false,
        });
      }
    }
  }
  return out;
}

/** Todo junto, lo más nuevo primero. */
export async function comentariosDe(conexiones: MetaConnection[]): Promise<Comentario[]> {
  const tandas = await Promise.all(
    conexiones.flatMap((c) => [
      comentariosFacebook(c).catch((e) => {
        // Una página caída no puede dejar la pantalla en blanco: se anota y se
        // sigue con las demás.
        console.error("[comentarios fb]", c.pageName, e);
        return [] as Comentario[];
      }),
      comentariosInstagram(c).catch((e) => {
        console.error("[comentarios ig]", c.pageName, e);
        return [] as Comentario[];
      }),
    ]),
  );
  return tandas.flat().sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

// ── Acciones ─────────────────────────────────────────────────────────────────

async function accion(url: string, metodo: "POST" | "DELETE", cuerpo?: URLSearchParams) {
  const r = await fetch(url, { method: metodo, body: cuerpo });
  const j = (await r.json()) as { error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "Meta rechazó la acción.");
  return j;
}

/**
 * Responder un comentario.
 *
 * Sirve para Facebook y para Instagram: las dos usan /replies con `message`.
 * En las dos se publica contra el id del comentario, no del post: así la
 * respuesta queda colgando del comentario y la persona recibe el aviso. Si se
 * publicara contra el post, aparecería suelta abajo y el que preguntó no se
 * entera.
 */
export async function responderComentario(c: MetaConnection, comentarioId: string, texto: string) {
  const t = texto.trim();
  if (!t) throw new Error("La respuesta viene vacía.");
  // Con login propio de Instagram, la respuesta sale por la cuenta de IG.
  if (c.igToken && esComentarioInstagram(comentarioId)) {
    return responderComentarioIg(c, comentarioId, t);
  }
  const cuerpo = new URLSearchParams({ message: t, access_token: c.pageToken });
  return accion(`${GRAPH}/${comentarioId}/replies`, "POST", cuerpo);
}

/**
 * Contestar un comentario por mensaje privado (Messenger o Instagram Direct).
 *
 * Existe por dos cosas. La obvia: "te mando el precio por privado". La otra:
 * sin App Review, Facebook no dice quién comentó; al contestarle en privado se
 * abre una conversación de Messenger, y ahí sí aparece con su nombre en la
 * bandeja. Meta lo permite una sola vez por comentario y dentro de 7 días.
 *
 * Devuelve el id de la persona en Messenger (PSID / IGSID) y el del mensaje,
 * para dejar la conversación en la bandeja desde ya.
 */
export async function responderEnPrivado(
  c: MetaConnection,
  comentarioId: string,
  texto: string,
): Promise<{ recipientId: string; mid: string }> {
  const t = texto.trim();
  if (!t) throw new Error("La respuesta viene vacía.");
  const r = await fetch(`${GRAPH}/${c.pageId}/messages?access_token=${encodeURIComponent(c.pageToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { comment_id: comentarioId }, message: { text: t } }),
  });
  const j = (await r.json().catch(() => ({}))) as {
    recipient_id?: string;
    message_id?: string;
    error?: { message?: string };
  };
  if (!r.ok || j.error) throw new Error(j.error?.message ?? `Meta no aceptó el mensaje (HTTP ${r.status}).`);
  return {
    recipientId: j.recipient_id ?? "",
    mid: j.message_id ?? `out-privado-${comentarioId}-${Date.now()}`,
  };
}

/**
 * Ocultar o mostrar. NO borrar.
 *
 * Ocultar deja el comentario visible para quien lo escribió y para sus amigos,
 * así que no se dan cuenta y no arma pleito. Borrar sí se nota, y el que se
 * siente censurado vuelve más enojado. Por eso acá no hay borrar.
 */
export async function ocultarComentario(c: MetaConnection, comentarioId: string, oculto: boolean) {
  if (c.igToken && esComentarioInstagram(comentarioId)) {
    return ocultarComentarioIg(c, comentarioId, oculto);
  }
  const cuerpo = new URLSearchParams({ is_hidden: String(oculto), access_token: c.pageToken });
  return accion(`${GRAPH}/${comentarioId}`, "POST", cuerpo);
}
