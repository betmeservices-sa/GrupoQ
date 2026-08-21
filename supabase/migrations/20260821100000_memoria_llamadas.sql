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

-- La app entra con la service key y se salta RLS. La politica queda por si
-- algun dia se lee con la anon key: sin ella, RLS encendido devuelve cero filas
-- y el agente creeria que nunca nadie lo llamo, en vez de dar error.
drop policy if exists "service role" on public.memoria_llamadas;
create policy "service role" on public.memoria_llamadas
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- NOTA DE PRIVACIDAD: esto es dato personal. Guarda quien llamo, que buscaba y
-- como pensaba pagarlo. Conviene acordar con el cliente cuanto tiempo se
-- conserva y borrar lo viejo, por ejemplo:
--   delete from public.memoria_llamadas where ultima < now() - interval '12 months';
