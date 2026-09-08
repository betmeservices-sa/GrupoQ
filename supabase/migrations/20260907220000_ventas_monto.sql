-- Cuánto quiere financiar cada lead.
--
-- Es la segunda pregunta que Sofía hace por teléfono ("de cuánto la anda
-- pensando"), así que puede no llegar nunca: se guarda NULO, no cero. En el
-- embudo, un lead sin monto suma cero y no se le inventa un promedio.
alter table public.ventas_solicitudes add column if not exists monto numeric;
