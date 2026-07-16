-- Conexiones OAuth de Meta por tenant: página de Facebook + cuenta de IG +
-- tokens (page token no expira; user token dura ~60 días).
-- Correr UNA vez en el SQL Editor del proyecto de Supabase del demo
-- (el mismo que usan wa_messages/wa_contacts). Idempotente.

create table if not exists public.meta_connections (
  tenant text not null,
  page_id text not null,
  page_name text,
  page_token text not null,
  ig_id text,
  user_token text,
  connected_at timestamptz not null default now(),
  primary key (tenant, page_id)
);

alter table public.meta_connections enable row level security;

-- Mismo modelo que el resto de tablas del demo: acceso con la publishable key.
-- OJO: los page tokens son sensibles. Antes de subir clientes externos,
-- migrar el server a la secret key y quitar esta policy de anon.
drop policy if exists "anon all meta_connections" on public.meta_connections;
create policy "anon all meta_connections" on public.meta_connections
  for all to anon using (true) with check (true);
