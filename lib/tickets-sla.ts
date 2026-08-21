// El reloj de los tickets: cuánto se tardó, contando SOLO horas hábiles.
//
// Es el punto donde la reunión del 20 de agosto se trabó más, y con razón.
// Helen lo planteó así: si un ticket entra a las 2 de la mañana y alguien lo
// resuelve a las 8:15, el reloj de pared dice 6 horas y 15 minutos. Ese número
// no mide a nadie: mide que el hospital estaba cerrado. Medido en horas
// hábiles, son 15 minutos, que es lo que de verdad tardó la persona.
//
// Roberto agregó la otra mitad: son DOS relojes, no uno.
//   - Tiempo de atención  = desde que el ticket existe hasta que alguien lo toma.
//     Mide la cola, no a la persona.
//   - Tiempo de resolución = desde que lo toman hasta que se cierra.
//     Mide a la persona, no la cola.
// Sumarlos en un solo número esconde cuál de los dos está mal.

/** Ventana de un día, en minutos desde la medianoche. null = cerrado. */
export interface VentanaDia {
  abre: number;
  cierra: number;
}

export interface Horario {
  /** Índice 0 = domingo, 6 = sábado. */
  dias: (VentanaDia | null)[];
  /** Minutos de diferencia con UTC. El Salvador: -360, sin horario de verano. */
  offsetMin: number;
}

const h = (hora: number, min = 0) => hora * 60 + min;

/**
 * Horario del hospital, tomado de lo que Sofía ya le dice a los pacientes:
 * lunes a viernes de 7:00 a 19:00, sábados de 8:00 a 13:00, domingos cerrado.
 * Si el guion cambia, esto tiene que cambiar con él o los dos se contradicen.
 */
export const HORARIO_HOSPITAL: Horario = {
  dias: [
    null, // domingo
    { abre: h(7), cierra: h(19) },
    { abre: h(7), cierra: h(19) },
    { abre: h(7), cierra: h(19) },
    { abre: h(7), cierra: h(19) },
    { abre: h(7), cierra: h(19) },
    { abre: h(8), cierra: h(13) }, // sábado
  ],
  offsetMin: -360,
};

/** Horario corrido, para tenants que atienden a toda hora. */
export const HORARIO_CONTINUO: Horario = {
  dias: Array.from({ length: 7 }, () => ({ abre: 0, cierra: 24 * 60 })),
  offsetMin: -360,
};

const DIA_MS = 86_400_000;

/**
 * Un instante visto desde la zona del tenant.
 *
 * Se corre el tiempo por el offset y después se leen los campos en UTC. Suena
 * al revés, pero es lo que evita que el resultado dependa de dónde corre el
 * servidor: en Vercel es UTC y en la laptop no, y el mismo ticket no puede
 * medir distinto según quién abra la página.
 */
function local(iso: string, offsetMin: number) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const corrido = ms + offsetMin * 60_000;
  return {
    dia: Math.floor(corrido / DIA_MS),
    minutoDelDia: Math.floor((corrido - Math.floor(corrido / DIA_MS) * DIA_MS) / 60_000),
  };
}

/** Día de la semana (0 = domingo) del día absoluto. El 1970-01-01 fue jueves. */
function diaSemana(diaAbsoluto: number): number {
  return (((diaAbsoluto + 4) % 7) + 7) % 7;
}

/**
 * Minutos hábiles entre dos instantes. Si `hasta` es anterior a `desde`, da 0.
 *
 * Recorre día por día en vez de hacer una fórmula cerrada: son pocos días en la
 * práctica y una fórmula con feriados y sábados cortos se vuelve ilegible. El
 * tope de 400 días es un freno por si llega una fecha corrupta.
 */
export function minutosHabiles(desdeIso: string, hastaIso: string, horario: Horario): number {
  const a = local(desdeIso, horario.offsetMin);
  const b = local(hastaIso, horario.offsetMin);
  if (!a || !b) return 0;
  if (b.dia < a.dia || (b.dia === a.dia && b.minutoDelDia <= a.minutoDelDia)) return 0;

  let total = 0;
  const ultimo = Math.min(b.dia, a.dia + 400);
  for (let d = a.dia; d <= ultimo; d++) {
    const ventana = horario.dias[diaSemana(d)];
    if (!ventana) continue;
    // Recorte del día contra el tramo pedido.
    const desde = d === a.dia ? Math.max(ventana.abre, a.minutoDelDia) : ventana.abre;
    const hasta = d === b.dia ? Math.min(ventana.cierra, b.minutoDelDia) : ventana.cierra;
    if (hasta > desde) total += hasta - desde;
  }
  return total;
}

/**
 * Cuándo vuelve a correr el reloj después de un instante dado.
 *
 * Es lo que le permite a Sofía decirle al paciente que llama a las 2 de la
 * mañana "le devolvemos la llamada a partir de las 7", en vez de dejarlo
 * esperando una respuesta que no va a llegar hasta que abran.
 */
export function proximaApertura(desdeIso: string, horario: Horario): string | null {
  const a = local(desdeIso, horario.offsetMin);
  if (!a) return null;
  for (let d = a.dia; d <= a.dia + 14; d++) {
    const ventana = horario.dias[diaSemana(d)];
    if (!ventana) continue;
    const arranca = d === a.dia ? Math.max(ventana.abre, a.minutoDelDia) : ventana.abre;
    if (arranca < ventana.cierra) {
      const ms = d * DIA_MS + arranca * 60_000 - horario.offsetMin * 60_000;
      return new Date(ms).toISOString();
    }
  }
  return null;
}

/** ¿El hospital está abierto en este instante? */
export function estaAbiertoAhora(iso: string, horario: Horario): boolean {
  const a = local(iso, horario.offsetMin);
  if (!a) return false;
  const ventana = horario.dias[diaSemana(a.dia)];
  return !!ventana && a.minutoDelDia >= ventana.abre && a.minutoDelDia < ventana.cierra;
}

/** "2 h 15 min", "45 min", "3 d 1 h". Pensado para leerse de un vistazo. */
export function formatearMinutos(min: number): string {
  if (min <= 0) return "0 min";
  if (min < 60) return `${Math.round(min)} min`;
  const horas = Math.floor(min / 60);
  const resto = Math.round(min % 60);
  if (horas < 12) return resto ? `${horas} h ${resto} min` : `${horas} h`;
  // Más de 12 horas hábiles ya es más de un día de trabajo: se cuenta en días
  // de 12 h (la jornada del hospital), no en días de 24, que serían mentira.
  const dias = Math.floor(horas / 12);
  const hs = horas % 12;
  return hs ? `${dias} d ${hs} h` : `${dias} d`;
}
