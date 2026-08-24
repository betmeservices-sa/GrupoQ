-- Respuestas de los formularios de onboarding.
--
-- El sitio de miagentia.com no tiene backend: es una landing sin API ni base.
-- Por eso el formulario escribe acá, que es donde ya vive todo lo del cliente.
--
-- Se guarda el envio ENTERO en jsonb y no en columnas: cada cliente tiene su
-- formulario con sus preguntas, y una tabla con columna por pregunta habria que
-- migrarla cada vez que se suma un cliente.

create table if not exists public.onboarding (
  id         text primary key,
  -- Que formulario es: yali, hospital, etc. Se valida contra una lista.
  cliente    text not null,
  respuestas jsonb not null default '{}'::jsonb,
  -- Cuantas de las preguntas quedaron sin contestar, para saber de un vistazo
  -- si el envio esta completo o es un avance.
  pendientes integer not null default 0,
  origen     text,
  creado     timestamptz not null default now()
);

create index if not exists onboarding_cliente_idx on public.onboarding (cliente, creado desc);

alter table public.onboarding enable row level security;

-- La app se conecta con la publishable key, o sea el rol anon (ver
-- lib/supabase.ts), igual que el resto de las tablas de este demo.
drop policy if exists "onboarding anon all" on public.onboarding;
create policy "onboarding anon all" on public.onboarding
  for all to anon using (true) with check (true);
