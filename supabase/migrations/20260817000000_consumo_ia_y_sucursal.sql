-- Consumo de la IA (tokens y dinero) + sucursal elegida por el contacto.
-- Idempotente: se puede correr varias veces.

-- ---------- ai_uso_tokens: un registro por respuesta de la IA ----------
-- Se guardan los CUATRO campos de `usage` porque se cobran distinto, el MODELO
-- con el que se generó (cambiar AI_MODEL mañana invalidaría el recálculo del
-- histórico) y el costo ya calculado (snapshot con la tarifa del día).
create table if not exists public.ai_uso_tokens (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  tenant text not null default 'hospital',
  wa_from text not null,
  wa_id text,
  modelo text not null,
  -- usage crudo de la API
  input_tokens integer not null default 0,           -- entrada NO cacheada
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0, -- 1.25x (5m) o 2x (1h)
  cache_read_input_tokens integer not null default 0,     -- 0.1x
  -- reparto texto / imagen (el de imagen sale de count_tokens, no de una estimación)
  tokens_texto integer not null default 0,
  tokens_imagen integer not null default 0,
  imagenes integer not null default 0,
  llamadas integer not null default 1,
  -- dinero (USD), snapshot con la tarifa vigente al momento de la respuesta
  costo_entrada numeric(14,8) not null default 0,
  costo_salida numeric(14,8) not null default 0,
  costo_cache_escritura numeric(14,8) not null default 0,
  costo_cache_lectura numeric(14,8) not null default 0,
  costo_texto numeric(14,8) not null default 0,
  costo_imagen numeric(14,8) not null default 0,
  costo_total numeric(14,8) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ai_uso_tokens_tenant_idx on public.ai_uso_tokens (tenant, ts desc);
create index if not exists ai_uso_tokens_from_idx on public.ai_uso_tokens (wa_from, ts desc);

alter table public.ai_uso_tokens enable row level security;
drop policy if exists "ai_uso_tokens_insert_anon" on public.ai_uso_tokens;
create policy "ai_uso_tokens_insert_anon" on public.ai_uso_tokens
  for insert to anon with check (true);
drop policy if exists "ai_uso_tokens_select_anon" on public.ai_uso_tokens;
create policy "ai_uso_tokens_select_anon" on public.ai_uso_tokens
  for select to anon using (true);
drop policy if exists "ai_uso_tokens_delete_anon" on public.ai_uso_tokens;
create policy "ai_uso_tokens_delete_anon" on public.ai_uso_tokens
  for delete to anon using (true);

-- ---------- wa_sucursal: a qué sede escribe cada número ----------
-- El agente pregunta la sucursal como PRIMER mensaje, obligatorio. Sin esta
-- tabla, cada invocación del webhook (función serverless nueva) volvería a
-- preguntar lo mismo.
create table if not exists public.wa_sucursal (
  wa_from text primary key,
  tenant text,
  sucursal_id text,
  sucursal_nombre text,
  intentos integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.wa_sucursal enable row level security;
drop policy if exists "wa_sucursal_anon_all" on public.wa_sucursal;
create policy "wa_sucursal_anon_all" on public.wa_sucursal
  for all to anon using (true) with check (true);
