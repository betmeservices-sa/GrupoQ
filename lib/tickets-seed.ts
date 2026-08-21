// Tablero de ejemplo, para que el demo no abra vacío.
//
// Un tablero de tickets sin tickets no se puede enseñar: no se ve la cola, ni
// los promedios, ni cuál lleva más tiempo esperando, que es justo lo que se
// quiere mostrar. Los casos salen de lo que el propio hospital nombró en la
// reunión: cotizaciones, resultados, facturación mal cobrada, quejas.
//
// Es determinista a propósito. Con Math.random, cada recarga movería los
// promedios y en una demo eso parece un error del sistema.

import type { Ticket, TipoTicket } from "./tickets";
import { HORARIO_HOSPITAL, proximaApertura } from "./tickets-sla";

/** Generador con semilla: mismo tenant, mismo tablero, siempre. */
function azar(semilla: string) {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) {
    h ^= semilla.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

interface Molde {
  titulo: string;
  detalle: string;
  tipo: TipoTicket;
  area: string;
  origen: Ticket["origen"];
  prioridad?: Ticket["prioridad"];
}

const MOLDES: Molde[] = [
  {
    titulo: "Cotización de plan prenatal",
    detalle: "Preguntó por el paquete completo de control prenatal y qué incluye. Pidió que se lo enviaran por WhatsApp.",
    tipo: "cotizacion",
    area: "ventas",
    origen: "llamada",
  },
  {
    titulo: "Cotización de exámenes de laboratorio",
    detalle: "Quiere precio de hemograma completo y perfil lipídico, y si necesita cita previa.",
    tipo: "cotizacion",
    area: "laboratorio",
    origen: "chat",
  },
  {
    titulo: "Resultados de ultrasonido no llegaron",
    detalle: "Se hizo el estudio hace tres días y no ha recibido el correo con el resultado.",
    tipo: "resultados",
    area: "imagenes",
    origen: "llamada",
    prioridad: "alta",
  },
  {
    titulo: "Cobro duplicado en la factura",
    detalle: "Le aparecen dos cargos por la misma consulta. Pide revisión y devolución.",
    tipo: "facturacion",
    area: "caja",
    origen: "llamada",
    prioridad: "alta",
  },
  {
    titulo: "Queja por tiempo de espera",
    detalle: "Esperó una hora y media para una consulta agendada. Quiere hablar con alguien de atención al cliente.",
    tipo: "queja",
    area: "atencion",
    origen: "qr",
    prioridad: "alta",
  },
  {
    titulo: "Reagendar cita de control",
    detalle: "No puede asistir el jueves y pregunta por espacio la semana siguiente con la misma doctora.",
    tipo: "cita",
    area: "recepcion",
    origen: "chat",
  },
  {
    titulo: "Consulta por cobertura de seguro",
    detalle: "Pregunta si el hospital atiende con su póliza y qué necesita llevar el día de la cita.",
    tipo: "informacion",
    area: "caja",
    origen: "chat",
  },
  {
    titulo: "Solicita hablar con la doctora que la atendió",
    detalle: "Tiene dudas sobre la indicación que le dieron. Pidió que le devuelvan la llamada.",
    tipo: "informacion",
    area: "ginecologia",
    origen: "llamada",
  },
  {
    titulo: "Queja por trato en recepción",
    detalle: "Reporta que la atendieron de mala manera al preguntar por su turno.",
    tipo: "queja",
    area: "atencion",
    origen: "qr",
    prioridad: "alta",
  },
  {
    titulo: "Cotización de paquete de parto",
    detalle: "Consulta por el paquete de parto natural y cesárea, y si hay plan de pagos.",
    tipo: "cotizacion",
    area: "ventas",
    origen: "llamada",
  },
  {
    titulo: "Dejó un objeto olvidado",
    detalle: "Olvidó un suéter en la sala de espera el viernes por la tarde.",
    tipo: "otro",
    area: "atencion",
    origen: "manual",
    prioridad: "baja",
  },
  {
    titulo: "Pregunta por horario de laboratorio el sábado",
    detalle: "Quiere saber hasta qué hora puede llegar a dejar la muestra.",
    tipo: "informacion",
    area: "laboratorio",
    origen: "chat",
    prioridad: "baja",
  },
];

const NOMBRES = [
  "María Elena Portillo",
  "Ana Cecilia Ramos",
  "Gabriela Menjívar",
  "Karla Vanessa Díaz",
  "Sonia del Carmen Rivas",
  "Claudia Beatriz Flores",
  "Rosa María Argueta",
  "Jessica Alvarenga",
  "Patricia Hernández",
  "Mónica Escobar",
  "Silvia Lorena Cruz",
  "Wendy Carolina Mejía",
];

/** Personal que atiende tickets en el hospital (ids del seed del tenant). */
const ATIENDEN = ["s6", "s8", "s7"];

const MINUTO = 60_000;

/**
 * Corre un instante hacia adelante hasta que el hospital esté abierto.
 *
 * Sin esto, la semilla podría poner un ticket "tomado" a las 3 de la mañana y
 * el tiempo de atención daría cero minutos hábiles, que es un número que en la
 * vida real no puede pasar y le quitaría credibilidad al tablero.
 */
function enHorario(ms: number): number {
  const iso = proximaApertura(new Date(ms).toISOString(), HORARIO_HOSPITAL);
  return iso ? Date.parse(iso) : ms;
}

export function ticketsSemilla(tenant: string, ahora = Date.now()): Ticket[] {
  // Solo el hospital tiene tablero sembrado: los demás tenants abren limpios,
  // como el resto de sus módulos.
  if (tenant !== "hospital") return [];

  const r = azar(tenant);
  const out: Ticket[] = [];

  MOLDES.forEach((m, i) => {
    // Repartidos sobre los últimos días, los más nuevos al final.
    const horasAtras = Math.round(4 + r() * 90 + i * 3);
    const creado = enHorario(ahora - horasAtras * 60 * MINUTO);

    // Un tercio sigue en cola, un tercio en curso, un tercio cerrado.
    const suerte = r();
    const enCola = suerte < 0.3;
    const cerrado = suerte > 0.62;

    const asignadoA = enCola ? undefined : ATIENDEN[Math.floor(r() * ATIENDEN.length)];
    const asignado = enCola ? undefined : enHorario(creado + Math.round(8 + r() * 220) * MINUTO);
    const resuelto = cerrado && asignado ? enHorario(asignado + Math.round(15 + r() * 400) * MINUTO) : undefined;

    out.push({
      id: `tkt-seed-${i + 1}`,
      tenant,
      numero: i + 1,
      titulo: m.titulo,
      detalle: m.detalle,
      tipo: m.tipo,
      estado: enCola ? "abierto" : cerrado ? "resuelto" : r() < 0.5 ? "asignado" : "en_proceso",
      prioridad: m.prioridad ?? "normal",
      origen: m.origen,
      creadoPor: m.origen === "manual" ? "Lic. José Ramírez" : m.origen === "qr" ? "Código QR" : "Sofía",
      contactoNombre: NOMBRES[i % NOMBRES.length],
      contactoTelefono: `+503 7${String(1000000 + Math.floor(r() * 8999999)).slice(0, 7)}`,
      area: m.area,
      asignadoA,
      creado: new Date(creado).toISOString(),
      asignado: asignado ? new Date(asignado).toISOString() : undefined,
      resuelto: resuelto ? new Date(resuelto).toISOString() : undefined,
      notas: resuelto
        ? [
            {
              id: `nota-seed-${i}`,
              autor: "Lic. Karla Cruz",
              texto: "Se contactó a la paciente y se resolvió la solicitud.",
              ts: new Date(resuelto).toISOString(),
            },
          ]
        : [],
    });
  });

  return out;
}
