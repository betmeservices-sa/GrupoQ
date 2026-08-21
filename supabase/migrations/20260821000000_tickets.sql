-- Tickets: el rastro de lo que el agente no resuelve solo.
--
-- Pedido en la reunion del 20 de agosto de 2026 con el hospital. Hoy, cuando
-- Sofia transfiere una llamada, no queda registro de si alguien atendio, cuanto
-- tardo ni si el caso se cerro. Esta tabla es ese registro.

create table if not exists public.tickets (
  id                text primary key,
  tenant            text not null,
  -- Consecutivo por cliente: es el numero que la gente dice en voz alta.
  numero            integer not null,
  titulo            text not null,
  detalle           text not null default '',
  tipo              text not null default 'otro',
  estado            text not null default 'abierto',
  prioridad         text not null default 'normal',
  origen            text not null default 'manual',
  creado_por        text not null default '',
  contacto_nombre   text not null default '',
  contacto_telefono text,
  area              text not null default '',
  asignado_a        text,
  conversacion_id   text,
  creado            timestamptz not null default now(),
  -- Sella cuando alguien se hizo cargo. Corta el reloj de cola y NO se vuelve
  -- a tocar si el ticket se reasigna: si se reseteara, pasarse un ticket entre
  -- companeros haria que el tiempo de espera se vea siempre bajo.
  asignado          timestamptz,
  resuelto          timestamptz,
  notas             jsonb not null default '[]'::jsonb
);

-- El numero no se puede repetir dentro de un mismo cliente.
create unique index if not exists tickets_tenant_numero_idx on public.tickets (tenant, numero);

-- La consulta de siempre es "los de este cliente, mas nuevos primero".
create index if not exists tickets_tenant_creado_idx on public.tickets (tenant, creado desc);

-- La cola de trabajo: lo que sigue abierto, por area.
create index if not exists tickets_abiertos_idx on public.tickets (tenant, estado, area)
  where estado <> 'resuelto';

-- "Mis tickets" de cada persona.
create index if not exists tickets_asignado_idx on public.tickets (tenant, asignado_a)
  where asignado_a is not null;

alter table public.tickets enable row level security;

-- La app entra con la service key y se salta RLS. La politica queda por si algun
-- dia se lee con la anon key: sin ella, RLS encendido devuelve cero filas y el
-- tablero se veria vacio en vez de dar error, que es peor.
drop policy if exists "service role" on public.tickets;
create policy "service role" on public.tickets
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
