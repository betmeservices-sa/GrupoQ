-- El nombre de cada conversación de Messenger e Instagram.
--
-- El último mensaje de una conversación muchas veces es nuestro (una
-- respuesta automática, un eco desde la app de Facebook) y no trae el nombre
-- de la persona; la bandeja quedaba con "IG 381463" hasta que alguien abría
-- el chat. Esta vista da, por conversación, el último nombre que sí llegó.

create or replace view yali.meta_nombre_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) tenant, canal, page_id, sender_id, sender_name
from yali.meta_messages
where sender_name is not null and sender_name <> ''
order by tenant, canal, page_id, sender_id, ts desc, id desc;

create or replace view public.meta_nombre_por_conversacion
with (security_invoker = true) as
select distinct on (tenant, canal, page_id, sender_id) tenant, canal, page_id, sender_id, sender_name
from public.meta_messages
where sender_name is not null and sender_name <> ''
order by tenant, canal, page_id, sender_id, ts desc, id desc;

grant select on yali.meta_nombre_por_conversacion to anon, authenticated;
grant select on public.meta_nombre_por_conversacion to anon, authenticated;
