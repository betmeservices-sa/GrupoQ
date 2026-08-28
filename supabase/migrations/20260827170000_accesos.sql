-- Quién entra al panel y quién está adentro ahora.
--
-- accesos_log: un renglón por inicio de sesión (usuario, cliente, desde dónde).
-- usuarios_actividad: la última vez que cada usuario tocó el panel; con eso
-- el tablero de la agencia dice "activo ahora" o "hace 2 horas".

create table if not exists public.accesos_log (
  id       bigint generated always as identity primary key,
  ts       timestamptz not null default now(),
  tenant   text not null,
  usuario  text not null,
  nombre   text,
  rol      text,
  todos    boolean not null default false,
  host     text,
  ip       text,
  agente   text
);
create index if not exists accesos_log_tenant_ts_idx on public.accesos_log (tenant, ts desc);
create index if not exists accesos_log_usuario_ts_idx on public.accesos_log (usuario, ts desc);

create table if not exists public.usuarios_actividad (
  usuario       text primary key,
  tenant        text not null,
  nombre        text,
  rol           text,
  ultimo_visto  timestamptz not null default now(),
  ultimo_host   text
);

alter table public.accesos_log enable row level security;
alter table public.usuarios_actividad enable row level security;
drop policy if exists "accesos_log anon all" on public.accesos_log;
create policy "accesos_log anon all" on public.accesos_log for all using (true) with check (true);
drop policy if exists "usuarios_actividad anon all" on public.usuarios_actividad;
create policy "usuarios_actividad anon all" on public.usuarios_actividad for all using (true) with check (true);
