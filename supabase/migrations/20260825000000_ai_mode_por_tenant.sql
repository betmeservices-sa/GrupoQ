-- El Modo IA pasa a ser de cada cliente, no de todos a la vez.
--
-- Hasta hoy ai_config tenía una sola fila (id = 1, con un check que lo obligaba)
-- para todo el sistema. En un panel multi cliente eso significa que si Yali
-- apaga la IA para atender a mano, la apaga también para el hospital y para
-- Grupo Q, y nadie se entera hasta que un paciente escribe y nadie contesta.
--
-- No se toca la tabla vieja a propósito: se deja como el valor por defecto de
-- quien todavía no eligió. Así ningún cliente cambia de comportamiento por
-- correr esta migración.

create table if not exists public.ai_config_tenant (
  tenant text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.ai_config_tenant enable row level security;

-- La app entra con la publishable key, o sea el rol anon. Si estas políticas
-- dijeran service_role, el panel escribiría al vacío: las escrituras se
-- rechazan y el select devuelve cero filas SIN error, que es la peor forma de
-- fallar porque parece que funciona.
drop policy if exists "ai_config_tenant anon all" on public.ai_config_tenant;
create policy "ai_config_tenant anon all" on public.ai_config_tenant
  for all to anon using (true) with check (true);
