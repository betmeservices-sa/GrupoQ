-- El "último mensaje por conversación" se elige por FECHA, no por id.
--
-- Los sondeos de Messenger e Instagram bajan historial: mensajes viejos que
-- se insertan hoy, con id más alto que los de hoy. Con `id desc` la bandeja
-- mostraba como último un mensaje de ayer y la conversación no subía cuando
-- llegaba uno nuevo. Con `ts desc` gana el más reciente de verdad; el id
-- desempata.

create or replace view yali.meta_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) *
from yali.meta_messages
order by tenant, canal, page_id, sender_id, ts desc, id desc;

create or replace view public.meta_ultimo_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) *
from public.meta_messages
order by tenant, canal, page_id, sender_id, ts desc, id desc;

grant select on yali.meta_ultimo_por_conversacion to anon, authenticated;
grant select on public.meta_ultimo_por_conversacion to anon, authenticated;
