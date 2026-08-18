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
  apellido text,
  correo text,
  notas text,
  tags text[] not null default '{}',
  tenant text,
  updated_at timestamptz not null default now()
);
create index if not exists wa_contacts_tenant_idx on public.wa_contacts (tenant);
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

-- ---------- ai_uso_tokens: consumo de la IA (tokens y dinero) ----------
-- Un registro por respuesta del agente. Se guardan los CUATRO campos de `usage`
-- porque se cobran distinto, el MODELO con el que se generó (cambiar AI_MODEL
-- mañana invalidaría el recálculo del histórico) y el costo ya calculado
-- (snapshot con la tarifa del día). El reparto texto/imagen sale de
-- count_tokens, no de una estimación por caracteres.
create table if not exists public.ai_uso_tokens (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  tenant text not null default 'hospital',
  wa_from text not null,
  wa_id text,
  modelo text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  tokens_texto integer not null default 0,
  tokens_imagen integer not null default 0,
  imagenes integer not null default 0,
  llamadas integer not null default 1,
  costo_entrada numeric(14,8) not null default 0,
  costo_salida numeric(14,8) not null default 0,
  costo_cache_escritura numeric(14,8) not null default 0,
  costo_cache_lectura numeric(14,8) not null default 0,
  costo_texto numeric(14,8) not null default 0,
  costo_imagen numeric(14,8) not null default 0,
  costo_total numeric(14,8) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_uso_tokens_tenant_idx on public.ai_uso_tokens (tenant, ts desc);
create index if not exists ai_uso_tokens_from_idx on public.ai_uso_tokens (wa_from, ts desc);
alter table public.ai_uso_tokens enable row level security;
drop policy if exists "ai_uso_tokens_insert_anon" on public.ai_uso_tokens;
create policy "ai_uso_tokens_insert_anon" on public.ai_uso_tokens
  for insert to anon with check (true);
drop policy if exists "ai_uso_tokens_select_anon" on public.ai_uso_tokens;
create policy "ai_uso_tokens_select_anon" on public.ai_uso_tokens
  for select to anon using (true);
drop policy if exists "ai_uso_tokens_delete_anon" on public.ai_uso_tokens;
create policy "ai_uso_tokens_delete_anon" on public.ai_uso_tokens
  for delete to anon using (true);

-- ---------- wa_sucursal: a qué sede escribe cada número ----------
-- Hotel Yaly (y cualquier cliente con varias sedes) pregunta la sucursal como
-- PRIMER mensaje, obligatorio. Sin esta tabla, cada invocación del webhook
-- (función serverless nueva) volvería a preguntar lo mismo.
create table if not exists public.wa_sucursal (
  wa_from text primary key,
  tenant text,
  sucursal_id text,
  sucursal_nombre text,
  intentos integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.wa_sucursal enable row level security;
drop policy if exists "wa_sucursal_anon_all" on public.wa_sucursal;
create policy "wa_sucursal_anon_all" on public.wa_sucursal
  for all to anon using (true) with check (true);
