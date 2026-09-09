-- De dónde salió el lead, marcado a mano por el vendedor.
--
-- El sistema sabe por dónde ENTRÓ el mensaje, pero no de dónde venía la
-- persona: un WhatsApp puede nacer de un anuncio de Instagram y eso solo lo
-- sabe quien habló con ella. Se queda NULO mientras nadie lo marque; en las
-- barras eso sale como "sin marcar" y no se reparte a ojo.
alter table public.ventas_solicitudes add column if not exists canal text;
