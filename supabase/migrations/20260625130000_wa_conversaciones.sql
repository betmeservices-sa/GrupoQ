-- Estado de la conversacion por contacto (asignacion, estado, departamento).
-- Persiste lo que antes vivia solo en el estado del cliente (React).

create table if not exists public.wa_conversaciones (
  wa_from      text        primary key,
  asignado_a   text,
  estado       text,
  departamento text,
  updated_at   timestamptz not null default now()
);

alter table public.wa_conversaciones enable row level security;

-- Demo: el rol anon (publishable key) puede leer y escribir.
drop policy if exists "wa_conversaciones anon all" on public.wa_conversaciones;
create policy "wa_conversaciones anon all" on public.wa_conversaciones
  for all to anon using (true) with check (true);
