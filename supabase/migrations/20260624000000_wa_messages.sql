-- Mensajes entrantes de WhatsApp para el Centro de Comunicación.
create table if not exists public.wa_messages (
  id bigint generated always as identity primary key,
  wa_id text not null unique,         -- id del mensaje en WhatsApp (dedup)
  wa_from text not null,              -- número del cliente (wa_id)
  nombre text,                        -- nombre de perfil de WhatsApp
  texto text not null,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.wa_messages enable row level security;

-- Demo: permitir insertar/leer con la publishable key (rol anon).
drop policy if exists "wa_messages_insert_anon" on public.wa_messages;
create policy "wa_messages_insert_anon" on public.wa_messages
  for insert to anon with check (true);

drop policy if exists "wa_messages_select_anon" on public.wa_messages;
create policy "wa_messages_select_anon" on public.wa_messages
  for select to anon using (true);
