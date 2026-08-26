-- Quién escribió cada comentario de Facebook, tomado del aviso de Meta.
--
-- Sin App Review, pedir el comentario por la API devuelve `from` vacío para
-- cualquiera sin rol en la app ("Sin identificar"). El aviso de feed que llega
-- por webhook sí trae from.id y from.name. Se guarda al llegar y se usa al
-- listar, sin volver a pedirlo.
--
-- Una sola tabla en public: el aviso llega antes de saber de qué cliente es, y
-- el id de comentario es único en todo Facebook. from_id es un id con alcance
-- de página (sirve para agrupar y contestar en privado, no para abrir el perfil).

create table if not exists public.meta_comentario_autores (
  comment_id text primary key,
  page_id    text not null,
  post_id    text,
  from_id    text,
  nombre     text not null,
  texto      text,
  recibido   timestamptz not null default now()
);

create index if not exists meta_comentario_autores_page_idx
  on public.meta_comentario_autores (page_id, recibido desc);

alter table public.meta_comentario_autores enable row level security;

drop policy if exists "anon escribe y lee autores" on public.meta_comentario_autores;
create policy "anon escribe y lee autores"
  on public.meta_comentario_autores for all to anon
  using (true) with check (true);
