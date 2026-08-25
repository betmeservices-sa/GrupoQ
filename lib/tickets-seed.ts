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
import { proximaApertura, type Horario } from "./tickets-sla";
import { horarioDeArea } from "./tickets-tenant";

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
  /** Quién lo toma, cuando no puede ser cualquiera (id del staff del tenant). */
  atiende?: string;
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


// Lo que de verdad le llega a Yali, sacado del kickoff del 24 de agosto de 2026.
//
// No son casos de adorno: cada uno es un escenario que el cliente nombró en voz
// alta como algo que Sofía NO cierra sola y que tiene que caerle a una persona.
// Por eso hay tres de pago y dos de membresía: son los que más se discutieron.
const MOLDES_YALI: Molde[] = [
  {
    titulo: "Socio del Sunsal Beach Club pide tarifa",
    detalle: "Se identificó como socio y pregunta por una habitación para el fin de semana. No se le dio precio: la atención de socios es de Olga.",
    tipo: "membresia",
    area: "membresias",
    origen: "chat",
    atiende: "s3",
  },
  {
    titulo: "Pregunta cómo hacerse socio",
    detalle: "Le interesó la membresía al oír que los socios no pagan Day Pass. Solo se le dijo que los planes arrancan en $55 mensuales.",
    tipo: "membresia",
    area: "membresias",
    origen: "chat",
    atiende: "s3",
  },
  {
    titulo: "El comprobante no cuadra con la reserva",
    detalle: "La habitación quedó en $125 y el voucher que mandó es por $100. No se confirmó la reserva.",
    tipo: "pago",
    area: "reservas",
    origen: "chat",
    prioridad: "alta",
    atiende: "s2",
  },
  {
    titulo: "Pagó una parte y dice que le mandan el resto",
    detalle: "Depositó $100 de $150 y avisó que en la tarde le llega una remesa por la diferencia. Quedó sin confirmar.",
    tipo: "pago",
    area: "reservas",
    origen: "chat",
    prioridad: "alta",
    atiende: "s2",
  },
  {
    titulo: "Se venció la hora y hay otro esperando la misma habitación",
    detalle: "Se le mandó el enlace de pago hace más de una hora y no pagó. Hay una segunda persona pidiendo esa misma habitación para hoy.",
    tipo: "reserva",
    area: "reservas",
    origen: "chat",
    prioridad: "urgente",
    atiende: "s2",
  },
  {
    titulo: "Quiere entrar a las nueve de la mañana",
    detalle: "Su vuelo aterriza a las siete en Comalapa y pregunta si puede entrar directo. Hay que ver si la habitación está libre desde la noche anterior.",
    tipo: "checkin_especial",
    area: "reservas",
    origen: "chat",
    atiende: "s2",
  },
  {
    titulo: "Pide quedarse hasta las cinco de la tarde",
    detalle: "Sale el domingo y quiere late check out. Corresponde el recargo del 50% de la noche, sujeto a que no entre nadie ese día.",
    tipo: "checkin_especial",
    area: "reservas",
    origen: "chat",
    atiende: "s2",
  },
  {
    titulo: "Reclama porque no le devuelven el pago",
    detalle: "Reservó por WhatsApp para el sábado y ya no puede venir. Se le explicó que por este canal la tarifa no es reembolsable y no quedó conforme.",
    tipo: "queja",
    area: "reservas",
    origen: "chat",
    prioridad: "alta",
    atiende: "s2",
  },
  {
    titulo: "Dejó una cámara en la habitación",
    detalle: "Se fue el domingo y olvidó una cámara GoPro en la mesa de noche del bungalow.",
    tipo: "objeto_perdido",
    area: "yali",
    origen: "chat",
  },
  {
    titulo: "El aire acondicionado no enfría",
    detalle: "Está hospedada y reporta que el aire de la Planta Alta no enfría desde anoche.",
    tipo: "mantenimiento",
    area: "surf",
    origen: "chat",
    prioridad: "alta",
  },
  {
    titulo: "Reclamo por ruido en la noche",
    detalle: "Dice que el grupo de al lado estuvo con música hasta tarde y no pudo dormir.",
    tipo: "queja",
    area: "yali",
    origen: "chat",
    prioridad: "alta",
  },
  {
    titulo: "Cobro de más en la salida",
    detalle: "Dice que le cargaron un consumo que no hizo y quiere que lo revisen.",
    tipo: "queja",
    area: "gerencia",
    origen: "chat",
    prioridad: "alta",
  },
  {
    titulo: "Cotización para grupo de doce personas",
    detalle: "Pregunta por varias habitaciones para un cumpleaños y si hay tarifa de grupo.",
    tipo: "cotizacion",
    area: "reservas",
    origen: "chat",
    atiende: "s2",
  },
  {
    titulo: "Olvidó un cargador y una toalla",
    detalle: "Pide que se los guarden, pasa a recogerlos el fin de semana.",
    tipo: "objeto_perdido",
    area: "linda",
    origen: "chat",
    prioridad: "baja",
  },
];

const NOMBRES_YALI = [
  "Andrea Melgar", "Diego Fuentes", "Camila Sandoval", "Luis Alberto Rivas",
  "Natalia Guzmán", "Jorge Interiano", "Valeria Cáceres", "Marcelo Peña",
  "Fátima Orellana", "Sebastián Duarte",
];

/** Quienes atienden lo de las sedes en Yali (ids del seed del tenant). */
const ATIENDEN_YALI = ["s2", "s6", "s5"];

/** Personal que atiende tickets en el hospital (ids del seed del tenant). */
const ATIENDEN = ["s6", "s8", "s7"];

const MINUTO = 60_000;

/**
 * Corre un instante hacia adelante hasta que esa área esté abierta.
 *
 * Sin esto, la semilla podría poner un ticket "tomado" a las 3 de la mañana y
 * el tiempo de atención daría cero minutos hábiles, que es un número que en la
 * vida real no puede pasar y le quitaría credibilidad al tablero.
 *
 * Va por área y no por negocio porque en Yali conviven relojes distintos: un
 * ticket de la sede sí puede nacer a las 3 de la mañana (el vigilante está),
 * pero uno de reservas no, porque a esa hora no hay nadie en esa línea.
 */
function enHorarioDe(ms: number, horario: Horario): number {
  const iso = proximaApertura(new Date(ms).toISOString(), horario);
  return iso ? Date.parse(iso) : ms;
}

export function ticketsSemilla(tenant: string, ahora = Date.now()): Ticket[] {
  // Solo el hospital, que sigue siendo un demo que se enseña.
  //
  // Yali quedó fuera a propósito aunque sus moldes existan mas abajo: es un
  // cliente en produccion y su tablero tiene que arrancar vacio. Un ticket
  // inventado ahi no es una demostracion, es una tarea falsa mezclada con las
  // de verdad, y alguien la va a trabajar.
  const moldes = tenant === "hospital" ? MOLDES : [];
  if (moldes.length === 0) return [];
  const nombres = tenant === "yaly" ? NOMBRES_YALI : NOMBRES;
  const atienden = tenant === "yaly" ? ATIENDEN_YALI : ATIENDEN;

  const r = azar(tenant);
  const out: Ticket[] = [];

  moldes.forEach((m, i) => {
    // Cada ticket vive en el reloj de su área.
    const reloj = horarioDeArea(tenant, m.area);
    const enH = (ms: number) => enHorarioDe(ms, reloj);

    // Repartidos sobre los últimos días, los más nuevos al final.
    const horasAtras = Math.round(4 + r() * 90 + i * 3);
    const creado = enH(ahora - horasAtras * 60 * MINUTO);

    // Un tercio sigue en cola, un tercio en curso, un tercio cerrado.
    const suerte = r();
    const enCola = suerte < 0.3;
    const cerrado = suerte > 0.62;

    // Los de membresías y pago tienen dueño fijo: no los puede tomar cualquiera.
    const asignadoA = enCola ? undefined : m.atiende ?? atienden[Math.floor(r() * atienden.length)];
    const asignado = enCola ? undefined : enH(creado + Math.round(8 + r() * 220) * MINUTO);
    const resuelto = cerrado && asignado ? enH(asignado + Math.round(15 + r() * 400) * MINUTO) : undefined;

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
      creadoPor: m.origen === "manual" ? "Recepción" : m.origen === "qr" ? "Código QR" : "Sofía",
      contactoNombre: nombres[i % nombres.length],
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
              autor: tenant === "yaly" ? "Recepción" : "Lic. Karla Cruz",
              texto: tenant === "yaly" ? "Se contactó al huésped y se resolvió." : "Se contactó a la paciente y se resolvió la solicitud.",
              ts: new Date(resuelto).toISOString(),
            },
          ]
        : [],
    });
  });

  return out;
}
