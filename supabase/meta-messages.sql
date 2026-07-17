-- Mensajes de Messenger e Instagram (entrantes y salientes) por tenant.
-- Correr UNA vez en el SQL Editor del proyecto de Supabase del demo
-- (el mismo que usan wa_messages/meta_connections). Idempotente.

create table if not exists public.meta_messages (
  id bigint generated always as identity primary key,
  tenant text not null,
  canal text not null check (canal in ('facebook', 'instagram')),
  page_id text not null,
  sender_id text not null,
  sender_name text,
  texto text not null,
  ts timestamptz not null default now(),
  direction text not null default 'in' check (direction in ('in', 'out')),
  -- id del mensaje en Meta: dedup de los reintentos del webhook.
  mid text unique
);

create index if not exists meta_messages_tenant_id on public.meta_messages (tenant, id);

alter table public.meta_messages enable row level security;

-- Mismo modelo que el resto de tablas del demo: acceso con la publishable key.
drop policy if exists "anon all meta_messages" on public.meta_messages;
create policy "anon all meta_messages" on public.meta_messages
  for all to anon using (true) with check (true);
