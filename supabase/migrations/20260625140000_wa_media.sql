-- Referencia al archivo recibido en cada mensaje, para poder reproducirlo o
-- verlo en el hilo (audio, video, imagen, documento, sticker).
alter table public.wa_messages
  add column if not exists media_id text,
  add column if not exists media_tipo text,
  add column if not exists media_mime text,
  add column if not exists media_filename text;
