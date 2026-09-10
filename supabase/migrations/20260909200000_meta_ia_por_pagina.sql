-- El interruptor de IA deja de ser uno solo para todo y pasa a ser por página.
--
-- POR QUÉ. El 9 de septiembre de 2026 se conectaron por error las páginas de
-- Yali al cliente de la agencia. El interruptor de IA vive en `ai_config` con
-- una sola fila (id=1) para TODO el panel, así que esas páginas heredaron el
-- switch encendido del demo y el agente de la agencia le escribió a una
-- persona real de Sunzal Beach Club.
--
-- Traerse las conversaciones no hace daño. Contestarlas sí. Por eso una página
-- recién conectada nace CALLADA y alguien tiene que encenderla a mano.
--
-- LAS QUE YA ESTABAN SE QUEDAN ENCENDIDAS: esta migración no puede apagarle la
-- IA a un cliente que hoy la tiene funcionando. El default apagado es para las
-- que vengan.
alter table public.meta_connections add column if not exists ia_activa boolean not null default false;
update public.meta_connections set ia_activa = true where connected_at < now();

alter table yali.meta_connections add column if not exists ia_activa boolean not null default false;
update yali.meta_connections set ia_activa = true where connected_at < now();
