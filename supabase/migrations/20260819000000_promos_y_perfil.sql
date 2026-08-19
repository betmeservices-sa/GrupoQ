-- Promociones del hotel y solicitudes de cambio al perfil del agente.
-- Idempotente: se puede correr varias veces.

-- ---------- promos: lo que el agente puede ofrecer ----------
-- El panel del cliente enciende y apaga filas de esta tabla, y el guion del
-- agente se arma con las que están activas en el momento de responder. Por eso
-- tiene que vivir en base y no en memoria: el panel y el webhook de WhatsApp
-- corren en funciones serverless distintas y no comparten memoria.
create table if not exists public.promos (
  id text primary key,
  tenant text not null,
  nombre text not null,
  descripcion text not null default '',
  precio text not null default '',
  restricciones text not null default '',
  desde date,
  hasta date,
  activa boolean not null default true,
  actualizada timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists promos_tenant_idx on public.promos (tenant, actualizada desc);

alter table public.promos enable row level security;
drop policy if exists "promos_anon_all" on public.promos;
create policy "promos_anon_all" on public.promos
  for all to anon using (true) with check (true);

-- ---------- perfil_solicitudes: cambios que pide el cliente ----------
-- Editar el perfil del agente NO reescribe el guion en vivo (tiene barandas de
-- seguridad que un cambio suelto rompería). Queda registrado aquí con un número
-- de gestión y el equipo lo aplica.
create table if not exists public.perfil_solicitudes (
  numero text primary key,
  tenant text not null,
  campo text not null,
  texto text not null,
  estado text not null default 'recibida',
  creada timestamptz not null default now()
);
create index if not exists perfil_solicitudes_tenant_idx
  on public.perfil_solicitudes (tenant, creada desc);

alter table public.perfil_solicitudes enable row level security;
drop policy if exists "perfil_solicitudes_anon_all" on public.perfil_solicitudes;
create policy "perfil_solicitudes_anon_all" on public.perfil_solicitudes
  for all to anon using (true) with check (true);
