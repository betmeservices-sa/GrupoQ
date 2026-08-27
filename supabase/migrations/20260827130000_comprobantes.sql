-- Los comprobantes de pago se guardan acá, no en el enlace de Meta.
--
-- El enlace que manda Meta con la foto caduca y además la sirve para
-- descargar, no para ver. Quien verifica el pago tiene que poder abrirla en
-- el panel hoy y dentro de un mes, y la foto tiene que quedar pegada a la
-- ficha del contacto. Se guarda el archivo (base64) y se sirve por
-- /api/comprobantes/<id>.

create table if not exists public.comprobantes (
  id           text primary key,
  tenant       text not null,
  apartado_id  text,
  clave        text,
  mime         text not null,
  nombre       text not null,
  datos_b64    text not null,
  creada       timestamptz not null default now()
);
create index if not exists comprobantes_tenant_idx on public.comprobantes (tenant, creada desc);

alter table public.comprobantes enable row level security;
drop policy if exists "comprobantes anon all" on public.comprobantes;
create policy "comprobantes anon all" on public.comprobantes for all using (true) with check (true);

-- Un adjunto de contacto puede venir de nosotros (url propia) y no solo de
-- WhatsApp (media_id de Meta).
alter table public.wa_adjuntos add column if not exists url text;
alter table yali.wa_adjuntos   add column if not exists url text;
