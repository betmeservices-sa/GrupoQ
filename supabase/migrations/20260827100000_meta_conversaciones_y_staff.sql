-- Messenger e Instagram al mismo nivel que WhatsApp: quién respondió, de qué
-- tema es cada mensaje, y el estado de cada conversación (asignación, sede,
-- interruptor de la IA).
--
-- Antes todo esto existía solo para WhatsApp (wa_conversaciones, wa_sucursal).
-- Yali no tiene WhatsApp conectado: su operación entera es Messenger e
-- Instagram, y ahí las respuestas salían sin dueño, la asignación vivía solo
-- en el navegador y la IA no corría.

-- ── Quién respondió y de qué tema es ────────────────────────────────────────
-- staff_id: la ficha del equipo (s2, s3...) o "ia". staff_nombre: el nombre
-- para pintar cuando no hay ficha (cuenta de la agencia, respuesta desde la
-- app de Facebook). tema: clasificación del mensaje entrante (day_pass,
-- horarios, reserva, membresia, ubicacion, precio, reclamo, otro).
alter table yali.meta_messages   add column if not exists staff_id text;
alter table yali.meta_messages   add column if not exists staff_nombre text;
alter table yali.meta_messages   add column if not exists tema text;
alter table public.meta_messages add column if not exists staff_id text;
alter table public.meta_messages add column if not exists staff_nombre text;
alter table public.meta_messages add column if not exists tema text;

create index if not exists meta_messages_tenant_ts_idx on yali.meta_messages (tenant, ts desc);
create index if not exists meta_messages_tenant_ts_idx on public.meta_messages (tenant, ts desc);

-- ── Estado de cada conversación ─────────────────────────────────────────────
-- clave = canal:page_id:sender_id. Es lo que identifica una conversación en
-- la bandeja (metac-<canal>-<pageId>-<senderId>).
create table if not exists yali.meta_conversaciones (
  clave             text primary key,
  tenant            text not null,
  canal             text not null,
  page_id           text not null,
  sender_id         text not null,
  asignado_a        text,
  estado            text,
  departamento      text,
  sucursal_id       text,
  sucursal_nombre   text,
  intentos_sucursal int not null default 0,
  updated_at        timestamptz not null default now()
);
create table if not exists public.meta_conversaciones (like yali.meta_conversaciones including all);

alter table yali.meta_conversaciones   enable row level security;
alter table public.meta_conversaciones enable row level security;
drop policy if exists "anon all meta_conversaciones" on yali.meta_conversaciones;
create policy "anon all meta_conversaciones" on yali.meta_conversaciones
  for all to anon using (true) with check (true);
drop policy if exists "anon all meta_conversaciones" on public.meta_conversaciones;
create policy "anon all meta_conversaciones" on public.meta_conversaciones
  for all to anon using (true) with check (true);

-- ── La vista de último por conversación, con las columnas nuevas ────────────
-- (Postgres congela las columnas de una vista con select *: hay que recrearla.)
create or replace view yali.meta_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) *
from yali.meta_messages
order by tenant, canal, page_id, sender_id, id desc;

create or replace view public.meta_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) *
from public.meta_messages
order by tenant, canal, page_id, sender_id, id desc;

grant select on yali.meta_ultimo_por_conversacion to anon, authenticated;
grant select on public.meta_ultimo_por_conversacion to anon, authenticated;
