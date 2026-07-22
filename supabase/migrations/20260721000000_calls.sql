-- Historial de llamadas de Vapi. Se llena por upsert desde el dashboard, asi
-- que sobrevive a lo que la API de Vapi deje de devolver con el tiempo.

create table if not exists public.calls (
  id                text        primary key,
  direccion         text,
  numero_cliente    text,
  phone_number_id   text,
  numero_propio     text,
  nombre_numero     text,
  assistant_id      text,
  nombre_assistant  text,
  creada_en         timestamptz,
  contestada_en     timestamptz,
  terminada_en      timestamptz,
  duracion_seg      integer     not null default 0,
  estado            text,
  motivo_fin        text,
  costo             numeric     not null default 0,
  costo_desglose    jsonb,
  transcript        text,
  grabacion_url     text,
  sincronizada_en   timestamptz not null default now()
);

create index if not exists calls_creada_en_idx on public.calls (creada_en desc);
create index if not exists calls_motivo_fin_idx on public.calls (motivo_fin);

alter table public.calls enable row level security;

-- Demo: el rol anon (publishable key) puede leer y escribir.
drop policy if exists "calls anon all" on public.calls;
create policy "calls anon all" on public.calls
  for all to anon using (true) with check (true);
