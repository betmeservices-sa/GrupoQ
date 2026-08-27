-- Portada y video de un reel o publicación que metieron en el chat.
--
-- Meta manda el adjunto con enlace, título e id del video, pero sin imagen.
-- Al llegar, se le pide el medio a Meta por el id (funciona cuando es una
-- publicación de la cuenta, que es lo normal) y se guardan la portada y el
-- mp4. Los enlaces vencen en unas horas; cuando vencen queda la tarjeta con
-- el título y "Abrir".

alter table yali.meta_messages   add column if not exists adjunto_miniatura text;
alter table yali.meta_messages   add column if not exists adjunto_video text;
alter table public.meta_messages add column if not exists adjunto_miniatura text;
alter table public.meta_messages add column if not exists adjunto_video text;
