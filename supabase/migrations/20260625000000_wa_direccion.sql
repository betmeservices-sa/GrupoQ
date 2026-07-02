-- Dirección del mensaje: 'in' = recibido del cliente, 'out' = enviado por la empresa.
alter table public.wa_messages
  add column if not exists direccion text not null default 'in';
