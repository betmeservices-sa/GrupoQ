-- Chat interno del equipo.
--
-- Hasta ahora esto no existía: los canales y los mensajes vivían en la memoria
-- del navegador. Se veía como un chat, pero si Verónica le escribía a Olga,
-- Olga no lo recibía nunca, porque cada una tenía su propia copia. Y al
-- recargar la página se borraba.
--
-- CORRER ESTE ARCHIVO DOS VECES, cambiando el esquema en la primera línea:
-- una vez para `public` (el hospital y los demos) y otra para `yali`.
-- Está escrito con el esquema al principio justamente para eso.

set local search_path = yali;  -- <<< cambiar a `public` para la otra corrida

create table if not exists interno_canales (
  id       text primary key,
  tenant   text not null,
  nombre   text not null,
  tipo     text not null default 'canal' check (tipo in ('canal', 'dm')),
  -- Ids del equipo. En jsonb y no en tabla aparte porque un canal tiene cinco
  -- personas, no cinco mil, y así se lee de una sola consulta.
  miembros jsonb not null default '[]'::jsonb,
  creado   timestamptz not null default now()
);

create index if not exists interno_canales_tenant_idx on interno_canales (tenant);

create table if not exists interno_mensajes (
  id       bigint generated always as identity primary key,
  tenant   text not null,
  canal_id text not null,
  -- Id de quien escribe dentro del equipo (s2, s3...), no su correo.
  autor    text not null,
  texto    text not null,
  ts       timestamptz not null default now()
);

-- El cursor del sondeo va por id, no por fecha: dos mensajes del mismo segundo
-- se pisarían y uno se perdería.
create index if not exists interno_mensajes_tenant_id_idx on interno_mensajes (tenant, id);

-- Hasta dónde leyó cada persona en cada canal. De acá sale el punto rojo.
create table if not exists interno_leido (
  tenant    text not null,
  canal_id  text not null,
  usuario   text not null,
  ultimo_id bigint not null default 0,
  primary key (tenant, canal_id, usuario)
);

alter table interno_canales  enable row level security;
alter table interno_mensajes enable row level security;
alter table interno_leido    enable row level security;

-- La app entra con la publishable key, o sea el rol anon. Con políticas para
-- service_role el panel escribiría al vacío: las escrituras se rechazan y el
-- select devuelve cero filas sin error.
drop policy if exists "interno_canales anon all" on interno_canales;
create policy "interno_canales anon all" on interno_canales
  for all to anon using (true) with check (true);

drop policy if exists "interno_mensajes anon all" on interno_mensajes;
create policy "interno_mensajes anon all" on interno_mensajes
  for all to anon using (true) with check (true);

drop policy if exists "interno_leido anon all" on interno_leido;
create policy "interno_leido anon all" on interno_leido
  for all to anon using (true) with check (true);
