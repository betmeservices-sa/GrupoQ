-- Ficha del contacto (cliente). La IA y el staff la van llenando.
create table if not exists public.wa_contacts (
  wa_from text primary key,
  nombre text,
  correo text,
  notas text,
  updated_at timestamptz not null default now()
);

-- Archivos recibidos (imagen, documento/PDF, audio, sticker, video) guardados en
-- la ficha del contacto. El archivo en sí se descarga aparte por su media_id.
create table if not exists public.wa_adjuntos (
  id bigint generated always as identity primary key,
  wa_from text not null,
  tipo text not null,            -- image | document | audio | sticker | video
  media_id text,                 -- id del archivo en Meta (para descargarlo)
  mime text,
  filename text,
  caption text,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists wa_adjuntos_wa_from_idx on public.wa_adjuntos (wa_from);

alter table public.wa_contacts enable row level security;
alter table public.wa_adjuntos enable row level security;

drop policy if exists "wa_contacts anon all" on public.wa_contacts;
create policy "wa_contacts anon all" on public.wa_contacts
  for all to anon using (true) with check (true);

drop policy if exists "wa_adjuntos anon all" on public.wa_adjuntos;
create policy "wa_adjuntos anon all" on public.wa_adjuntos
  for all to anon using (true) with check (true);
