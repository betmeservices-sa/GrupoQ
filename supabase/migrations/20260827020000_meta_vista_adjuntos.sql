-- La vista de "último mensaje por conversación" con las columnas nuevas.
--
-- La vista se creó con `select *`, pero Postgres congela la lista de columnas
-- al crearla: las que se agregaron después a meta_messages (adjunto_miniatura,
-- adjunto_video) no aparecen. Pedirlas hacía fallar la consulta de la bandeja
-- entera, y el panel caía al camino lento sin la portada de nada. Volver a
-- crearla las incorpora.
--
-- OJO para la próxima columna: correr esto de nuevo después de agregarla.

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

grant select on yali.meta_ultimo_por_conversacion to anon, authenticated;
grant select on public.meta_ultimo_por_conversacion to anon, authenticated;
