-- La IA por conversacion pasa a ser un override de 3 estados sobre el global:
--   fila con activa = true  -> IA forzada ON para ese chat (aunque el global este off)
--   fila con activa = false -> IA forzada OFF para ese chat (un humano lo lleva)
--   sin fila                -> sigue el interruptor global (ai_config)
alter table public.ai_paused
  add column if not exists activa boolean not null default false;
