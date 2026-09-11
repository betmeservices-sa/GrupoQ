-- Módulo consultorio (tenant "consultorio", Centro Médico San Benito).
--
-- Tres tablas: los pacientes que se registran escaneando el QR del doctor, los
-- documentos que el doctor les deja escritos (receta y orden de exámenes, que
-- comparten tabla porque siempre se preguntan juntos) y la fila del día del
-- laboratorio.
--
-- Los doctores y las sucursales NO están acá: viven en el código
-- (lib/consultorio/almacen.ts), porque son la escenografía del demo y nadie las
-- edita.
--
-- Sin estas tablas la app no se cae: cae a memoria del proceso y avisa una vez
-- en el log. En Vercel esa caída rompe justo lo que el demo enseña (el paciente
-- escanea en su teléfono y aparece en la pantalla del doctor), así que esto hay
-- que correrlo antes de publicar.

create table if not exists public.consultorio_pacientes (
  id          text primary key,
  doctor_id   text not null,
  nombre      text not null,
  telefono    text not null default '',
  correo      text not null default '',
  nacimiento  date,
  sexo        text,
  motivo      text not null default '',
  alergias    text not null default '',
  creado      timestamptz not null default now()
);

-- De quién es cada paciente se pregunta en cada carga del panel, y el teléfono
-- se busca para no duplicar a quien vuelve a escanear el QR.
create index if not exists consultorio_pacientes_doctor_idx
  on public.consultorio_pacientes (doctor_id, creado desc);
create unique index if not exists consultorio_pacientes_doctor_telefono_idx
  on public.consultorio_pacientes (doctor_id, telefono);

create table if not exists public.consultorio_documentos (
  id          text primary key,
  tipo        text not null check (tipo in ('receta', 'orden')),
  paciente_id text not null,
  doctor_id   text not null,
  fecha       timestamptz not null default now(),
  -- Lo que cambia entre una receta y una orden: medicamentos e indicaciones, o
  -- la lista de exámenes y el diagnóstico.
  datos       jsonb not null default '{}'::jsonb,
  -- El envío por correo, cuando exista proveedor. Hoy queda en null.
  enviado     jsonb
);

create index if not exists consultorio_documentos_paciente_idx
  on public.consultorio_documentos (paciente_id, fecha desc);
create index if not exists consultorio_documentos_doctor_idx
  on public.consultorio_documentos (doctor_id, fecha desc);

create table if not exists public.consultorio_turnos (
  id          text primary key,
  sucursal_id text not null,
  -- Corre por día y por sucursal: la fila empieza en 1 cada mañana.
  numero      integer not null,
  nombre      text not null,
  telefono    text not null default '',
  correo      text not null default '',
  -- Ids del catálogo (lib/consultorio/examenes.ts): lo que pidió y lo que se le
  -- hizo. Lo que falta es la resta.
  examenes    jsonb not null default '[]'::jsonb,
  hechos      jsonb not null default '[]'::jsonb,
  -- El código de la receta de laboratorio.
  codigo      text not null default 'ABCDE-123456',
  estado      text not null default 'esperando'
              check (estado in ('esperando', 'atendiendo', 'pendiente', 'atendido')),
  creado      timestamptz not null default now(),
  -- Desde cuándo corre el cronómetro (null si está parado) y lo ya acumulado.
  -- Se guarda el instante y no los segundos para que el tiempo siga contando
  -- aunque la recepcionista recargue la pantalla.
  abierto     timestamptz,
  segundos    integer not null default 0,
  cerrado     timestamptz
);

create index if not exists consultorio_turnos_sucursal_idx
  on public.consultorio_turnos (sucursal_id, creado desc);

-- RLS: la app entra con la llave publishable y una sola sesión para todos los
-- demos, así que la frontera real es el login de la app, no la base. Se deja
-- RLS encendido con una política abierta para que quede explícito que acá no
-- hay separación por usuario, en vez de dejar la tabla sin RLS y que parezca un
-- olvido.
alter table public.consultorio_pacientes  enable row level security;
alter table public.consultorio_documentos enable row level security;
alter table public.consultorio_turnos     enable row level security;

drop policy if exists consultorio_pacientes_demo  on public.consultorio_pacientes;
drop policy if exists consultorio_documentos_demo on public.consultorio_documentos;
drop policy if exists consultorio_turnos_demo     on public.consultorio_turnos;

create policy consultorio_pacientes_demo  on public.consultorio_pacientes  for all using (true) with check (true);
create policy consultorio_documentos_demo on public.consultorio_documentos for all using (true) with check (true);
create policy consultorio_turnos_demo     on public.consultorio_turnos     for all using (true) with check (true);

-- ── Facturación en el mostrador (2026-09-10) ────────────────────────────────
--
-- El paciente paga en el laboratorio, al terminar: por eso el monto lo pone
-- recepción sobre los exámenes que SÍ se hicieron, y sin monto no se puede
-- cerrar la visita. El número de factura se genera al finalizar y corre por día
-- y por sucursal, que es como se cuadra después con caja.
alter table public.consultorio_turnos
  add column if not exists monto numeric(10, 2),
  add column if not exists factura text;

create index if not exists consultorio_turnos_factura_idx
  on public.consultorio_turnos (sucursal_id, factura);
