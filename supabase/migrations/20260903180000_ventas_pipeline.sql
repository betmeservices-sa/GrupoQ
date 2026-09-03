-- El embudo de ventas con expediente: una fila por prospecto y su historia.
--
-- ventas_solicitudes: el estado de cada caso (expediente, vendedor, plazos).
-- La etapa NO se guarda: se calcula del expediente y de las marcas de tiempo,
-- así el tablero no puede quedar diciendo una cosa mientras el expediente dice
-- otra. Lo que sí se guarda son los instantes, que es lo que el gerente mide.
--
-- ventas_eventos: quién hizo qué y cuándo. Es lo que permite reportar tiempos
-- reales (cuánto tardó en entregar, cuánto tardó el vendedor en tomarlo) sin
-- tener que deducirlos de la conversación.

create table if not exists public.ventas_solicitudes (
  tenant        text not null,
  wa_from       text not null,
  nombre        text,
  vehiculo      text,
  -- { "dui": { "estado": "aprobado", "ts": "...", "por": "s2" }, ... }
  expediente    jsonb not null default '{}'::jsonb,
  vendedor      text,
  creado        timestamptz not null default now(),
  contactado    timestamptz,
  pedidos       timestamptz,
  completado    timestamptz,
  asignado      timestamptz,
  tomado        timestamptz,
  cerrado       timestamptz,
  resultado     text check (resultado in ('venta', 'perdido')),
  motivo_cierre text,
  avisado       timestamptz,
  escalado      timestamptz,
  actualizado   timestamptz not null default now(),
  primary key (tenant, wa_from)
);
create index if not exists ventas_solicitudes_tenant_idx on public.ventas_solicitudes (tenant, actualizado desc);
create index if not exists ventas_solicitudes_vendedor_idx on public.ventas_solicitudes (tenant, vendedor);

create table if not exists public.ventas_eventos (
  id       bigint generated always as identity primary key,
  ts       timestamptz not null default now(),
  tenant   text not null,
  wa_from  text not null,
  -- contactado | documentos_pedidos | doc_recibido | doc_aprobado | doc_rechazado
  -- | completado | asignado | tomado | cerrado | reasignado | aviso_gerente | vencido
  tipo     text not null,
  -- staffId, "sofia" o "sistema" (los plazos los dispara el cron).
  actor    text,
  detalle  text
);
create index if not exists ventas_eventos_caso_idx on public.ventas_eventos (tenant, wa_from, ts desc);
create index if not exists ventas_eventos_tenant_ts_idx on public.ventas_eventos (tenant, ts desc);

alter table public.ventas_solicitudes enable row level security;
alter table public.ventas_eventos enable row level security;
drop policy if exists "ventas_solicitudes anon all" on public.ventas_solicitudes;
create policy "ventas_solicitudes anon all" on public.ventas_solicitudes for all using (true) with check (true);
drop policy if exists "ventas_eventos anon all" on public.ventas_eventos;
create policy "ventas_eventos anon all" on public.ventas_eventos for all using (true) with check (true);
