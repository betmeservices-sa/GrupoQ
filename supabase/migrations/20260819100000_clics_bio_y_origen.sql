-- Medición de los links de las bios: clics con sus UTMs, y de qué link salió
-- cada conversación. Idempotente: se puede correr varias veces.

-- ---------- clics_bio: cada toque en un link rastreable ----------
-- Un `wa.me` pelado no deja rastro: WhatsApp solo reenvía el texto y ningún UTM
-- llega al negocio. Por eso el link de la bio pasa primero por /ir/<codigo>,
-- que escribe una fila acá y recién después redirige a WhatsApp.
create table if not exists public.clics_bio (
  id bigint generated always as identity primary key,
  tenant text not null,
  codigo text not null,              -- el link que se tocó (ver lib/enlaces.ts)
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referer text,
  ts timestamptz not null default now()
);
create index if not exists clics_bio_tenant_idx on public.clics_bio (tenant, ts desc);
create index if not exists clics_bio_codigo_idx on public.clics_bio (codigo, ts desc);

alter table public.clics_bio enable row level security;
drop policy if exists "clics_bio_anon_all" on public.clics_bio;
create policy "clics_bio_anon_all" on public.clics_bio
  for all to anon using (true) with check (true);

-- ---------- wa_sucursal.origen: por qué link entró ese número ----------
-- La otra mitad de la medición. El clic dice cuánta gente tocó; esto dice
-- cuánta terminó escribiendo, y por cuál perfil.
alter table public.wa_sucursal add column if not exists origen text;
create index if not exists wa_sucursal_origen_idx on public.wa_sucursal (tenant, origen);
