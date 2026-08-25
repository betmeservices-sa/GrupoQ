-- Contraseñas que cada persona se cambió.
--
-- Las cuentas nacen con una clave que damos nosotros por la variable USUARIOS.
-- Sirve para entregar el acceso, no para dejarlo así: esa clave la sabemos
-- nosotros, viajó por chat, y hoy Verónica y Olga tienen la misma.
--
-- La contraseña no se guarda: se guarda su huella bcrypt.
--
-- ── POR QUÉ FUNCIONES Y NO UNA TABLA ABIERTA ──
-- La app entra con la publishable key, o sea el rol anon. Si esta tabla tuviera
-- la política de siempre ("anon puede todo"), esa llave leería las huellas de
-- todas las contraseñas, y una huella robada se rompe sin apuro y sin dejar
-- rastro.
--
-- Entonces la tabla queda cerrada y se exponen dos funciones que corren con los
-- permisos del dueño. La comparación pasa dentro de Postgres y la huella no
-- sale nunca. El servidor pregunta "¿esta clave es correcta?" y recibe sí o no.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.usuarios_clave (
  usuario text primary key,
  hash text not null,
  cambiada_en timestamptz not null default now()
);

alter table public.usuarios_clave enable row level security;
-- Sin políticas: el rol anon no llega a esta tabla ni para leer ni para
-- escribir. Es la única del proyecto cerrada así, y es a propósito.

-- ¿La clave es correcta? Devuelve null si esa persona nunca se la cambió, para
-- que el servidor sepa que tiene que mirar la clave inicial.
create or replace function public.verificar_clave(p_usuario text, p_clave text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
begin
  select hash into h from public.usuarios_clave where usuario = lower(p_usuario);
  if h is null then
    return null;
  end if;
  return h = crypt(p_clave, h);
end;
$$;

-- Cambia la clave. Exige la actual, así una sesión abierta y sin dueño no
-- alcanza para dejar a la persona afuera de su propia cuenta.
--
-- p_inicial es la clave que le dimos nosotros, que el servidor pasa solo cuando
-- la persona todavía no se la cambió. Sin eso, la primera vez no habría contra
-- qué comparar la actual.
create or replace function public.cambiar_clave(
  p_usuario text,
  p_actual text,
  p_nueva text,
  p_inicial text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h text;
  ok boolean;
begin
  if length(coalesce(p_nueva, '')) < 8 then
    return false;
  end if;

  select hash into h from public.usuarios_clave where usuario = lower(p_usuario);
  if h is null then
    ok := (p_actual = p_inicial and p_inicial is not null);
  else
    ok := (h = crypt(p_actual, h));
  end if;

  if not ok then
    return false;
  end if;

  insert into public.usuarios_clave (usuario, hash, cambiada_en)
  values (lower(p_usuario), crypt(p_nueva, gen_salt('bf', 10)), now())
  on conflict (usuario) do update
    set hash = excluded.hash, cambiada_en = now();

  return true;
end;
$$;

-- ¿Ya se la cambió? Lo usa el panel para ofrecerlo la primera vez.
create or replace function public.clave_cambiada(p_usuario text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.usuarios_clave where usuario = lower(p_usuario));
$$;

revoke all on function public.verificar_clave(text, text) from public;
revoke all on function public.cambiar_clave(text, text, text, text) from public;
revoke all on function public.clave_cambiada(text) from public;

grant execute on function public.verificar_clave(text, text) to anon, authenticated;
grant execute on function public.cambiar_clave(text, text, text, text) to anon, authenticated;
grant execute on function public.clave_cambiada(text) to anon, authenticated;
