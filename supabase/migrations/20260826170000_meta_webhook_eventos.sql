-- Cada aviso de Meta, guardado tal cual llega.
--
-- Hoy se perdieron horas mirando logs en vivo para saber dos cosas: si Meta
-- avisó o no de un mensaje, y con qué forma manda una respuesta a historia
-- de Facebook. Los logs en vivo se cortan solos y no guardan lo de antes.
--
-- Con esto queda el crudo en la base: se puede mirar después, comparar con
-- lo que entró a la bandeja, y ver la forma exacta de cualquier cosa nueva.
--
-- Una sola tabla en public: el aviso llega antes de saber de qué cliente es.
-- Borrar lo de más de 30 días de vez en cuando; no hace falta guardarlo más.

create table if not exists public.meta_webhook_eventos (
  id       bigint generated always as identity primary key,
  recibido timestamptz not null default now(),
  objeto   text,
  cuerpo   jsonb not null
);

create index if not exists meta_webhook_eventos_recibido_idx
  on public.meta_webhook_eventos (recibido desc);

alter table public.meta_webhook_eventos enable row level security;

drop policy if exists "anon escribe y lee eventos" on public.meta_webhook_eventos;
create policy "anon escribe y lee eventos"
  on public.meta_webhook_eventos for all to anon
  using (true) with check (true);
