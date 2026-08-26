-- El último mensaje de cada conversación, para armar la bandeja sin releer todo.
--
-- Hasta ahora la lista de conversaciones se armaba en el navegador releyendo
-- los 16 mil mensajes cada vez que alguien entraba. Con esto el servidor da
-- una fila por conversación (la del último mensaje), la lista aparece de una,
-- y el hilo trae sus mensajes solo cuando se abre.
--
-- `distinct on` se queda con la primera fila de cada grupo según el orden, y
-- el orden es "id más alto primero": o sea, el mensaje más reciente.
--
-- Corre en los dos esquemas de una sola vez.

-- ── WhatsApp ────────────────────────────────────────────────────────────────

create or replace view yali.wa_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, wa_from) *
from yali.wa_messages
order by tenant, wa_from, id desc;

create or replace view public.wa_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, wa_from) *
from public.wa_messages
order by tenant, wa_from, id desc;

-- ── Messenger e Instagram ───────────────────────────────────────────────────

create or replace view yali.meta_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) *
from yali.meta_messages
order by tenant, canal, page_id, sender_id, id desc;

create or replace view public.meta_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) *
from public.meta_messages
order by tenant, canal, page_id, sender_id, id desc;

-- security_invoker: la vista se lee con los permisos de quien pregunta, así
-- las políticas de las tablas de abajo siguen mandando.
grant select on yali.wa_ultimo_por_conversacion, yali.meta_ultimo_por_conversacion to anon, authenticated;
grant select on public.wa_ultimo_por_conversacion, public.meta_ultimo_por_conversacion to anon, authenticated;

-- Índices para "los 50 anteriores de esta conversación", que es la consulta
-- que se hace cada vez que se abre un hilo.
create index if not exists wa_messages_conv_ts_idx on yali.wa_messages (tenant, wa_from, ts desc);
create index if not exists wa_messages_conv_ts_idx on public.wa_messages (tenant, wa_from, ts desc);
create index if not exists meta_messages_conv_ts_idx on yali.meta_messages (tenant, canal, page_id, sender_id, ts desc);
create index if not exists meta_messages_conv_ts_idx on public.meta_messages (tenant, canal, page_id, sender_id, ts desc);
