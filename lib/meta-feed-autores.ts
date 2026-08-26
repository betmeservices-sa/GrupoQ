// Quién escribió cada comentario de Facebook, tomado del aviso de Meta.
//
// POR QUÉ EXISTE
// Sin App Review, pedir un comentario por la API devuelve `from` vacío para
// cualquiera sin rol en la app, y la pantalla mostraba "Sin identificar". Pero
// el aviso de `feed` que Meta manda cuando alguien comenta SÍ trae
// `from.id` y `from.name` (se comprobó el 2026-08-26 con las reacciones:
// Geovanni Reyes, Aminta Amaya, Josue Rodriguez... todas con nombre).
//
// Así que el nombre se guarda en el momento en que llega y no se vuelve a
// pedir. Solo cubre lo que comenten desde ahora: lo de antes no tiene aviso.
//
// El `from.id` es un id con alcance de página, no el id global de la persona:
// sirve para agrupar comentarios de la misma persona y para contestarle en
// privado, no para abrir su perfil.
//
// Tabla global en public: el aviso llega antes de saber de qué cliente es, y
// los ids de comentario son únicos en todo Facebook.

import { getSupabase } from "./supabase";

export interface AutorFeed {
  commentId: string;
  pageId: string;
  postId: string | null;
  fromId: string | null;
  nombre: string;
  texto: string | null;
}

interface CambioFeed {
  field?: string;
  value?: {
    item?: string;
    verb?: string;
    comment_id?: string;
    post_id?: string;
    message?: string;
    from?: { id?: string; name?: string };
  };
}

/** El autor de un cambio de feed, si es un comentario nuevo o editado con nombre. */
export function autorDeCambioFeed(pageId: string, cambio: CambioFeed): AutorFeed | null {
  if (cambio.field !== "feed") return null;
  const v = cambio.value;
  if (!v || v.item !== "comment") return null;
  if (v.verb !== "add" && v.verb !== "edited") return null;
  const nombre = (v.from?.name ?? "").trim();
  if (!v.comment_id || !nombre) return null;
  return {
    commentId: v.comment_id,
    pageId,
    postId: v.post_id ?? null,
    fromId: v.from?.id ?? null,
    nombre,
    texto: v.message ?? null,
  };
}

// Cuando la tabla no existe, no se insiste en cada aviso.
const g = globalThis as unknown as { __metaAutoresSinTabla?: boolean };

export async function guardarAutorFeed(a: AutorFeed): Promise<void> {
  if (g.__metaAutoresSinTabla) return;
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb.from("meta_comentario_autores").upsert(
      {
        comment_id: a.commentId,
        page_id: a.pageId,
        post_id: a.postId,
        from_id: a.fromId,
        nombre: a.nombre,
        texto: a.texto,
        recibido: new Date().toISOString(),
      },
      { onConflict: "comment_id" },
    );
    if (error) {
      if (/meta_comentario_autores/.test(error.message)) g.__metaAutoresSinTabla = true;
      console.error("[meta-feed] no se pudo guardar el autor:", error.message);
    }
  } catch (e) {
    console.error("[meta-feed] no se pudo guardar el autor:", e);
  }
}

/** Nombres guardados para estos comentarios. Los que no están, no vienen. */
export async function autoresDeComentarios(
  commentIds: string[],
): Promise<Map<string, { nombre: string; fromId: string | null }>> {
  const out = new Map<string, { nombre: string; fromId: string | null }>();
  if (g.__metaAutoresSinTabla || commentIds.length === 0) return out;
  const sb = getSupabase();
  if (!sb) return out;
  // De a tandas: una sola consulta con cientos de ids se pasa del largo de URL.
  for (let i = 0; i < commentIds.length; i += 100) {
    const tanda = commentIds.slice(i, i + 100);
    const { data, error } = await sb
      .from("meta_comentario_autores")
      .select("comment_id, nombre, from_id")
      .in("comment_id", tanda);
    if (error) {
      if (/meta_comentario_autores/.test(error.message)) g.__metaAutoresSinTabla = true;
      console.error("[meta-feed] no se pudieron leer autores:", error.message);
      return out;
    }
    for (const r of (data ?? []) as { comment_id: string; nombre: string; from_id: string | null }[]) {
      out.set(r.comment_id, { nombre: r.nombre, fromId: r.from_id });
    }
  }
  return out;
}
