-- Estado del Modo IA (always-on). Lo lee el webhook server-side, por eso vive
-- en la base (no en memoria del navegador).

-- Interruptor global on/off (una sola fila).
create table if not exists public.ai_config (
  id int primary key default 1,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint ai_config_singleton check (id = 1)
);
insert into public.ai_config (id, enabled) values (1, false)
  on conflict (id) do nothing;

-- Conversaciones donde la IA quedó apagada porque un humano la tomó.
create table if not exists public.ai_paused (
  wa_from text primary key,
  created_at timestamptz not null default now()
);

alter table public.ai_config enable row level security;
alter table public.ai_paused enable row level security;

-- Demo: el rol anon (publishable key) puede leer y escribir.
drop policy if exists "ai_config anon all" on public.ai_config;
create policy "ai_config anon all" on public.ai_config
  for all to anon using (true) with check (true);

drop policy if exists "ai_paused anon all" on public.ai_paused;
create policy "ai_paused anon all" on public.ai_paused
  for all to anon using (true) with check (true);
