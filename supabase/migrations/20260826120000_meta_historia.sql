-- La historia que alguien contestó.
--
-- Cuando responden una historia, Meta manda el texto normal y aparte la
-- historia a la que contestan. Sin guardarla, en la bandeja quedaba
-- "cuánto vale?" suelto y quien atiende no tenía forma de saber de qué le
-- hablaban.
--
-- Se guarda el enlace a la imagen, no la imagen. OJO: ese enlace lo sirve Meta
-- y vence en unas horas. Alcanza igual, porque una historia se contesta
-- mientras está publicada; pasado ese rato queda el rótulo sin la miniatura,
-- que es justo lo que se quiere (menos es mentir sobre qué se puede mostrar).

alter table yali.meta_messages   add column if not exists historia_url text;
alter table public.meta_messages add column if not exists historia_url text;
