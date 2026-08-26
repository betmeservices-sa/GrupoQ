-- Instagram con inicio de sesión de Instagram (sin pasar por la página de FB).
--
-- Sin App Review, los DMs de Instagram de gente sin rol en la app no llegan
-- por el camino de Facebook. Con la "API de Instagram con inicio de sesión de
-- Instagram", el acceso estándar cubre las cuentas profesionales que se
-- agregan a la app en el panel de Meta (las del cliente, como testers), y ahí
-- sí avisan de cualquier persona.
--
-- Esa conexión da un token PROPIO de la cuenta de Instagram (dura 60 días y se
-- refresca solo). Se guarda en la misma fila de la conexión de la página, al
-- lado del token de página. Si la cuenta no tiene página conectada, la fila
-- lleva el id de Instagram como page_id y el token de página vacío.

alter table yali.meta_connections   add column if not exists ig_token text;
alter table yali.meta_connections   add column if not exists ig_token_vence timestamptz;
alter table yali.meta_connections   add column if not exists ig_username text;

alter table public.meta_connections add column if not exists ig_token text;
alter table public.meta_connections add column if not exists ig_token_vence timestamptz;
alter table public.meta_connections add column if not exists ig_username text;
