-- El número de WhatsApp de cada cliente.
--
-- Hasta ahora había UN solo número, el de la demo, y un interruptor global que
-- decidía a qué cliente entraban sus mensajes. Eso servía para enseñar el
-- panel; no sirve para un cliente real, que tiene su propio número y no puede
-- compartirlo con nadie.
--
-- Cada fila es un número conectado por el cliente desde su panel (el flujo de
-- Meta para WhatsApp, "Embedded Signup"). El webhook usa phone_number_id para
-- saber de quién es cada mensaje que llega, igual que con las páginas de
-- Facebook usa page_id.
--
-- El token es del negocio del cliente, no nuestro: por eso vive en su esquema.
-- El PIN es el de registro del número en la Cloud API; hace falta para volver
-- a registrarlo si Meta lo pide.
--
-- Corre en los dos esquemas.

create table if not exists yali.wa_connections (
  phone_number_id text primary key,
  tenant          text not null,
  waba_id         text not null,
  display_phone   text,
  verified_name   text,
  access_token    text not null,
  pin             text,
  connected_at    timestamptz not null default now()
);
create index if not exists wa_connections_tenant_idx on yali.wa_connections (tenant);
alter table yali.wa_connections enable row level security;
drop policy if exists "anon todo" on yali.wa_connections;
create policy "anon todo" on yali.wa_connections for all to anon using (true) with check (true);

create table if not exists public.wa_connections (
  phone_number_id text primary key,
  tenant          text not null,
  waba_id         text not null,
  display_phone   text,
  verified_name   text,
  access_token    text not null,
  pin             text,
  connected_at    timestamptz not null default now()
);
create index if not exists wa_connections_tenant_idx on public.wa_connections (tenant);
alter table public.wa_connections enable row level security;
drop policy if exists "anon todo" on public.wa_connections;
create policy "anon todo" on public.wa_connections for all to anon using (true) with check (true);
