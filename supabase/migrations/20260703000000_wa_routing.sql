-- Enrutamiento del número de WhatsApp en vivo a un cliente (tenant).
-- Hoy hay UN solo número: un switch global decide a qué cliente entran los
-- mensajes. Cada mensaje se etiqueta con su tenant y cada dashboard filtra.

-- Etiqueta de cliente en cada mensaje.
alter table public.wa_messages
  add column if not exists tenant text not null default 'hospital';
create index if not exists wa_messages_tenant_idx on public.wa_messages (tenant, id);

-- Config del enrutamiento (una sola fila).
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

-- Permite borrar historial con la publishable key (botón "Borrar historial").
drop policy if exists "wa_messages_delete_anon" on public.wa_messages;
create policy "wa_messages_delete_anon" on public.wa_messages
  for delete to anon using (true);
