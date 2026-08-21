-- Memoria del agente de voz entre llamadas.
--
-- Hoy cada llamada arranca en cero: el agente atiende al que llamo ayer como si
-- no lo conociera. Esta tabla guarda lo que quedo de cada llamada, con el
-- telefono como llave, y el webhook se lo devuelve cuando esa persona vuelve.
--
-- El telefono se guarda NORMALIZADO a los ultimos 8 digitos (el numero completo
-- salvadoreno sin codigo de pais), porque la misma persona puede llegar marcada
-- como +50375391721, 50375391721 o 7539-1721 segun por donde entre.

create table if not exists public.memoria_llamadas (
  tenant         text not null,
  telefono       text not null,
  nombre         text,
  -- Modelos por los que pregunto, del mas reciente al mas viejo.
  modelos        jsonb not null default '[]'::jsonb,
  uso            text,
  pago           text,
  agendo         boolean not null default false,
  resumen        text not null default '',
  llamadas       integer not null default 0,
  ultima         timestamptz not null default now(),
  ultimo_call_id text,
  primary key (tenant, telefono)
);

-- Para el barrido de limpieza por antiguedad.
create index if not exists memoria_llamadas_ultima_idx on public.memoria_llamadas (tenant, ultima desc);

alter table public.memoria_llamadas enable row level security;

-- La app se conecta con la publishable key, o sea el rol anon (ver lib/supabase.ts),
-- igual que el resto de las tablas de este demo. Una politica solo para
-- service_role bloquea TODO en silencio: el guardado cae al store en memoria y
-- la lectura devuelve vacio, asi que el agente no se acuerda de nada y nadie ve
-- un error.
drop policy if exists "service role" on public.memoria_llamadas;
drop policy if exists "memoria_llamadas anon all" on public.memoria_llamadas;
create policy "memoria_llamadas anon all" on public.memoria_llamadas
  for all to anon using (true) with check (true);

-- NOTA DE PRIVACIDAD: esto es dato personal. Guarda quien llamo, que buscaba y
-- como pensaba pagarlo. Conviene acordar con el cliente cuanto tiempo se
-- conserva y borrar lo viejo, por ejemplo:
--   delete from public.memoria_llamadas where ultima < now() - interval '12 months';
