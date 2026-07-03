-- ============================================================
-- Switch de cliente para el número de WhatsApp + limpieza del historial.
-- Pegar TODO en Supabase -> SQL Editor -> Run. Idempotente.
-- ============================================================

-- 1) Etiqueta de cliente (tenant) en cada mensaje.
alter table public.wa_messages
  add column if not exists tenant text not null default 'hospital';
create index if not exists wa_messages_tenant_idx on public.wa_messages (tenant, id);

-- 2) Config del enrutamiento (una fila): a qué cliente entra el número en vivo.
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

-- 3) Permite borrar historial con la publishable key.
drop policy if exists "wa_messages_delete_anon" on public.wa_messages;
create policy "wa_messages_delete_anon" on public.wa_messages
  for delete to anon using (true);

-- 4) Borra el historial actual (deja la bandeja limpia).
delete from public.wa_messages;
delete from public.wa_adjuntos;
delete from public.wa_conversaciones;
delete from public.wa_contacts;
