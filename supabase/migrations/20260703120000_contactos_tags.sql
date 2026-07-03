-- Contactos con etiquetas (tags) por interés/estado + tenant.
-- La IA clasifica el interés al escribir el cliente; la pestaña Contactos
-- lista/crea/filtra por tag. Los tags son propios de cada cliente.

alter table public.wa_contacts add column if not exists apellido text;
alter table public.wa_contacts add column if not exists tags text[] not null default '{}';
alter table public.wa_contacts add column if not exists tenant text;

create index if not exists wa_contacts_tenant_idx on public.wa_contacts (tenant);

-- Contactos demo para que la pestaña arranque poblada. Números ficticios que no
-- colisionan con reales. ON CONFLICT: no pisa datos reales ya guardados.

-- Grupo Q (autos)
insert into public.wa_contacts (wa_from, nombre, apellido, correo, tags, tenant) values
  ('50370010001', 'Wendy',      'Alvarado',  'wendy.alvarado@correo.com',   array['Interés SUV'],        'grupoq'),
  ('50370010002', 'Stephanie',  'Gómez',     'stephanie.gomez@correo.com',  array['Interés Sedán'],      'grupoq'),
  ('50370010003', 'Jacqueline', 'Moreno',    'jacqueline.m@correo.com',     array['Interés Pickup'],     'grupoq'),
  ('50370010004', 'Andrea',     'Sosa',      'andrea.sosa@correo.com',      array['Servicio al cliente'],'grupoq'),
  ('50370010005', 'Claudia',    'Reyes',     'claudia.reyes@correo.com',    array['Cliente cerrado'],    'grupoq'),
  ('50370010006', 'Rosa',       'Campos',    'rosa.campos@correo.com',      array['Interés Microbuses'], 'grupoq')
on conflict (wa_from) do nothing;

-- Hospital (servicios)
insert into public.wa_contacts (wa_from, nombre, apellido, correo, tags, tenant) values
  ('50370020001', 'María',    'González', 'maria.gonzalez@correo.com', array['Interés Ginecología'],  'hospital'),
  ('50370020002', 'Ana',      'Martínez', 'ana.martinez@correo.com',   array['Interés Obstetricia'],  'hospital'),
  ('50370020003', 'Sofía',    'Ramírez',  'sofia.ramirez@correo.com',  array['Interés Pediatría'],    'hospital'),
  ('50370020004', 'Lucía',    'Torres',   'lucia.torres@correo.com',   array['Consulta general'],     'hospital'),
  ('50370020005', 'Carmen',   'Díaz',     'carmen.diaz@correo.com',    array['Paciente agendada'],    'hospital'),
  ('50370020006', 'Gabriela', 'Cruz',     'gabriela.cruz@correo.com',  array['Interés Reproducción'], 'hospital')
on conflict (wa_from) do nothing;
