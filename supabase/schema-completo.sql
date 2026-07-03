-- ============================================================
-- Centro de Comunicación (Hospital) — esquema completo
-- Pegar TODO en Supabase → SQL Editor → Run. Es idempotente (se puede correr
-- varias veces sin romper nada).
-- ============================================================

-- ---------- wa_messages: mensajes de WhatsApp (in/out) ----------
create table if not exists public.wa_messages (
  id bigint generated always as identity primary key,
  wa_id text not null unique,
  wa_from text not null,
  nombre text,
  texto text not null,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.wa_messages
  add column if not exists direccion text not null default 'in';
alter table public.wa_messages
  add column if not exists media_id text,
  add column if not exists media_tipo text,
  add column if not exists media_mime text,
  add column if not exists media_filename text;
-- Cliente (tenant) al que entró el número en vivo: hospital | grupoq.
alter table public.wa_messages
  add column if not exists tenant text not null default 'hospital';
create index if not exists wa_messages_tenant_idx on public.wa_messages (tenant, id);
drop policy if exists "wa_messages_delete_anon" on public.wa_messages;
create policy "wa_messages_delete_anon" on public.wa_messages
  for delete to anon using (true);

alter table public.wa_messages enable row level security;
drop policy if exists "wa_messages_insert_anon" on public.wa_messages;
create policy "wa_messages_insert_anon" on public.wa_messages
  for insert to anon with check (true);
drop policy if exists "wa_messages_select_anon" on public.wa_messages;
create policy "wa_messages_select_anon" on public.wa_messages
  for select to anon using (true);

-- ---------- ai_config / ai_paused: Modo IA (server-side) ----------
create table if not exists public.ai_config (
  id int primary key default 1,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint ai_config_singleton check (id = 1)
);
insert into public.ai_config (id, enabled) values (1, false)
  on conflict (id) do nothing;

create table if not exists public.ai_paused (
  wa_from text primary key,
  created_at timestamptz not null default now()
);
alter table public.ai_paused
  add column if not exists activa boolean not null default false;

alter table public.ai_config enable row level security;
alter table public.ai_paused enable row level security;
drop policy if exists "ai_config anon all" on public.ai_config;
create policy "ai_config anon all" on public.ai_config
  for all to anon using (true) with check (true);
drop policy if exists "ai_paused anon all" on public.ai_paused;
create policy "ai_paused anon all" on public.ai_paused
  for all to anon using (true) with check (true);

-- ---------- wa_contacts / wa_adjuntos: ficha y archivos ----------
create table if not exists public.wa_contacts (
  wa_from text primary key,
  nombre text,
  correo text,
  notas text,
  updated_at timestamptz not null default now()
);
create table if not exists public.wa_adjuntos (
  id bigint generated always as identity primary key,
  wa_from text not null,
  tipo text not null,
  media_id text,
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

-- ---------- wa_routing: a qué cliente entra el número en vivo ----------
create table if not exists public.wa_routing (
  id int primary key default 1,
  tenant text not null default 'hospital',
  updated_at timestamptz not null default now(),
  constraint wa_routing_singleton check (id = 1)
);
insert into public.wa_routing (id, tenant) values (1, 'hospital')
  on conflict (id) do nothing;
alter table public.wa_routing enable row level security;
drop policy if exists "wa_routing anon all" on public.wa_routing;
create policy "wa_routing anon all" on public.wa_routing
  for all to anon using (true) with check (true);

-- ---------- wa_conversaciones: estado por contacto ----------
create table if not exists public.wa_conversaciones (
  wa_from      text        primary key,
  asignado_a   text,
  estado       text,
  departamento text,
  updated_at   timestamptz not null default now()
);
alter table public.wa_conversaciones enable row level security;
drop policy if exists "wa_conversaciones anon all" on public.wa_conversaciones;
create policy "wa_conversaciones anon all" on public.wa_conversaciones
  for all to anon using (true) with check (true);
