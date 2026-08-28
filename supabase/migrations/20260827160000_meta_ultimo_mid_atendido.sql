-- Sofía sin turnos: qué fue lo último de la persona que ya se contestó.
--
-- Antes, si la persona escribía mientras Sofía redactaba, ese mensaje quedaba
-- sin respuesta: el turno veía que el último mensaje del hilo era nuestro y
-- se retiraba. Ahora cada conversación guarda el mid del último mensaje
-- entrante que Sofía ya leyó al responder; cualquier mensaje entrante después
-- de ese se contesta, sin importar quién habló último.

alter table if exists yali.meta_conversaciones   add column if not exists ultimo_mid_atendido text;
alter table if exists public.meta_conversaciones add column if not exists ultimo_mid_atendido text;
