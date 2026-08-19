-- Distinguir qué se pagó en cada fila de consumo: la respuesta del agente o
-- pasar una nota de voz a texto. Idempotente.
--
-- Por qué en la misma tabla: la pregunta que importa es cuánto costó ATENDER un
-- mensaje, y eso incluye transcribirlo. Cada fila ya guarda su modelo y su
-- costo, así que Claude y Gemini conviven sin mezclarse. Lo que sí hay que
-- separar es el CONTEO: una transcripción no es una respuesta, y contarla como
-- tal inflaría el número que mira el dueño.
alter table public.ai_uso_tokens
  add column if not exists tipo text not null default 'respuesta';

create index if not exists ai_uso_tokens_tipo_idx on public.ai_uso_tokens (tenant, tipo, ts desc);
