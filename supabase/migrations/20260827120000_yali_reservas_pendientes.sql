-- Reservas que Sofía deja apartadas y que una persona confirma.
--
-- El flujo que pidió Yali: Sofía junta fechas, personas, habitación, nombre y
-- correo, aparta la habitación una hora y pide el comprobante. Cuando llega el
-- comprobante (una imagen), el chat pasa a Verónica, que verifica el pago y
-- confirma la reserva desde el panel. Recién ahí entra al sistema del hotel.
--
-- clave = la conversación: "facebook:pagina:persona", "instagram:pagina:persona"
-- o "wa:telefono". Una conversación tiene a lo sumo un apartado vivo.

create table if not exists yali.reservas_pendientes (
  id                 text primary key,
  tenant             text not null,
  clave              text not null,
  sede_id            text not null,
  sede_nombre        text not null,
  habitacion_id      text not null,
  habitacion_nombre  text not null,
  huesped            text not null,
  correo             text,
  telefono           text,
  desde              date not null,
  hasta              date not null,
  adultos            int  not null default 1,
  ninos              int  not null default 0,
  noches             int  not null,
  total              numeric(10,2) not null,
  moneda             text not null default 'USD',
  notas              text,
  -- pendiente_pago → comprobante_recibido → confirmada | rechazada
  estado             text not null default 'pendiente_pago',
  comprobante_url    text,
  comprobante_mid    text,
  comprobante_ts     timestamptz,
  vence              timestamptz,
  confirmada_por     text,
  confirmada_ts      timestamptz,
  motivo_rechazo     text,
  reserva_cloudbeds  text,
  creada             timestamptz not null default now(),
  actualizada        timestamptz not null default now()
);

create index if not exists reservas_pendientes_tenant_estado_idx on yali.reservas_pendientes (tenant, estado, creada desc);
create index if not exists reservas_pendientes_clave_idx on yali.reservas_pendientes (clave, creada desc);
