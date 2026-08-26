-- Imágenes en el chat interno.
--
-- Se guarda la imagen misma, no un enlace a un archivo aparte. Para el chat de
-- un equipo de cinco personas eso alcanza y evita montar almacenamiento con sus
-- permisos y su limpieza.
--
-- Lo que hace que alcance es que el navegador la achica ANTES de mandarla
-- (máximo 1280 px, en JPEG): una foto de 3 MB sacada del teléfono llega
-- pesando unos 200 KB. Sin ese paso esto sería una mala idea.
--
-- Este archivo sí toca los dos esquemas de una sola corrida.

alter table yali.interno_mensajes   add column if not exists imagen text;
alter table public.interno_mensajes add column if not exists imagen text;
