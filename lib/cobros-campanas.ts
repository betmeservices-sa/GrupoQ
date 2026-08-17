// El motor de las campañas de llamadas (batch calling).
//
// La idea que pidió el cliente: "suben una base de 10,000 y quiero llamarlos a
// todos, pero de 10 en 10". Eso NO es mandar 10,000 llamadas y rezar: es una
// cola con un tope de llamadas vivas. Cada vez que una termina, entra la
// siguiente. Este archivo es esa cola, y es puro a propósito: recibe la campaña
// y la hora, devuelve a quién hay que marcar AHORA. Quien marca de verdad es la
// ruta de API; quien decide es esto, y por eso se puede probar sin gastar
// llamadas.
//
// Tres frenos, todos acá:
//   1. concurrencia: nunca más de N llamadas vivas al mismo tiempo.
//   2. ventana: fuera del horario permitido no se marca, aunque esté corriendo.
//   3. reintentos: quien no contesta vuelve a la cola con espera, hasta el tope.

import {
  RESULTADOS_CONTACTO,
  type Campana,
  type ItemCampana,
  type ProgresoCampana,
  type ResultadoLlamada,
  type VentanaLlamado,
} from "./cobros-tipos";

// Horario de cobranza por defecto: de lunes a sábado, de 8 de la mañana a 6 de
// la tarde. Ni domingos ni de noche.
export const VENTANA_POR_DEFECTO: VentanaLlamado = {
  horaInicio: 8,
  horaFin: 18,
  dias: [1, 2, 3, 4, 5, 6],
};

export const CONCURRENCIA_MAX = 50;
export const MAX_ITEMS_CAMPANA = 20000;

// Estados que ocupan un cupo de la concurrencia.
const VIVOS: ItemCampana["estado"][] = ["marcando", "en_curso"];

export function esVivo(item: ItemCampana): boolean {
  return VIVOS.includes(item.estado);
}

/** Hora y día de la semana en El Salvador (UTC-6, sin horario de verano). */
export function relojSv(ahora: Date): { hora: number; dia: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/El_Salvador",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(ahora);
  const hora = Number(partes.find((p) => p.type === "hour")?.value ?? "0");
  const nombre = partes.find((p) => p.type === "weekday")?.value ?? "Sun";
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { hora: hora === 24 ? 0 : hora, dia: Math.max(0, dias.indexOf(nombre)) };
}

export function enVentana(v: VentanaLlamado, ahora: Date): boolean {
  const { hora, dia } = relojSv(ahora);
  if (!v.dias.includes(dia)) return false;
  return hora >= v.horaInicio && hora < v.horaFin;
}

export interface Tanda {
  marcar: ItemCampana[];
  cupos: number;
  vivas: number;
  // Por qué no se marcó nada, cuando aplica. La pantalla lo muestra tal cual:
  // una campaña detenida sin explicación parece rota.
  motivo?: string;
}

/**
 * Qué se marca en este momento. Devuelve como mucho `concurrencia - vivas`
 * items, en orden de la cola, saltando los que todavía están en espera de
 * reintento.
 */
export function planificarTanda(c: Campana, ahora: Date): Tanda {
  const vivas = c.items.filter(esVivo).length;
  const cupos = Math.max(0, c.concurrencia - vivas);

  if (c.estado !== "corriendo") {
    return { marcar: [], cupos, vivas, motivo: `La campaña está ${c.estado}.` };
  }
  if (!enVentana(c.ventana, ahora)) {
    return {
      marcar: [],
      cupos,
      vivas,
      motivo: `Fuera del horario de llamadas (${c.ventana.horaInicio}:00 a ${c.ventana.horaFin}:00).`,
    };
  }
  if (cupos === 0) {
    return { marcar: [], cupos, vivas, motivo: `Las ${c.concurrencia} líneas están ocupadas.` };
  }

  const t = ahora.getTime();
  const listos = c.items.filter(
    (i) =>
      (i.estado === "pendiente" || i.estado === "reprogramada") &&
      i.intentos < c.maxIntentos &&
      (!i.reintentarDespues || Date.parse(i.reintentarDespues) <= t),
  );

  if (listos.length === 0) {
    const esperando = c.items.some(
      (i) => i.estado === "reprogramada" || i.estado === "pendiente",
    );
    return {
      marcar: [],
      cupos,
      vivas,
      motivo: esperando ? "Los que faltan están esperando su reintento." : undefined,
    };
  }

  return { marcar: listos.slice(0, cupos), cupos, vivas };
}

/** true si la campaña ya no tiene nada que hacer y se puede dar por terminada. */
export function campanaAgotada(c: Campana): boolean {
  return !c.items.some(
    (i) =>
      esVivo(i) ||
      ((i.estado === "pendiente" || i.estado === "reprogramada") && i.intentos < c.maxIntentos),
  );
}

// Resultados que NO justifican volver a marcar: o ya se resolvió, o el cliente
// pidió que no lo llamen, o el número no sirve. Insistir con estos es
// exactamente lo que convierte una cobranza en acoso.
const NO_REINTENTAR: ResultadoLlamada[] = [
  "promesa_pago",
  "ya_pago",
  "pago_parcial",
  "quiere_negociar",
  "disputa",
  "solicita_no_llamar",
  "numero_equivocado",
  "no_puede_pagar",
];

export function debeReintentar(
  resultado: ResultadoLlamada | undefined,
  intentos: number,
  maxIntentos: number,
): boolean {
  if (intentos >= maxIntentos) return false;
  if (!resultado) return true; // falla técnica: el número no tuvo la culpa
  return !NO_REINTENTAR.includes(resultado);
}

/**
 * Cierra un item con lo que devolvió la llamada y decide si vuelve a la cola.
 * Devuelve un item nuevo (no muta) para que la actualización del almacén sea
 * un reemplazo y no una edición a medias.
 */
export function cerrarItem(
  item: ItemCampana,
  datos: {
    resultado?: ResultadoLlamada;
    duracionSeg?: number;
    costo?: number;
    error?: string;
    // Cuando el cliente pidió que lo llamen a una hora, mandamos ese ISO.
    reintentarDespues?: string;
  },
  campana: Pick<Campana, "maxIntentos" | "minutosEntreIntentos">,
  ahora: Date,
): ItemCampana {
  const reintenta = debeReintentar(datos.resultado, item.intentos, campana.maxIntentos);
  const espera =
    datos.reintentarDespues ??
    new Date(ahora.getTime() + campana.minutosEntreIntentos * 60_000).toISOString();

  return {
    ...item,
    estado: reintenta ? "reprogramada" : datos.error && !datos.resultado ? "fallida" : "terminada",
    resultado: datos.resultado ?? item.resultado,
    duracionSeg: datos.duracionSeg ?? item.duracionSeg,
    costo: datos.costo ?? item.costo,
    error: datos.error,
    reintentarDespues: reintenta ? espera : undefined,
    actualizado: ahora.toISOString(),
  };
}

export function progresoDe(c: Campana, promesas?: { cuenta: number; monto: number }): ProgresoCampana {
  let pendientes = 0;
  let enCurso = 0;
  let terminadas = 0;
  let fallidas = 0;
  let omitidas = 0;
  let contactos = 0;
  let segundos = 0;
  let costo = 0;

  for (const i of c.items) {
    if (i.estado === "pendiente" || i.estado === "reprogramada") pendientes += 1;
    else if (esVivo(i)) enCurso += 1;
    else if (i.estado === "terminada") terminadas += 1;
    else if (i.estado === "fallida") fallidas += 1;
    else if (i.estado === "omitida") omitidas += 1;

    if (i.resultado && RESULTADOS_CONTACTO.includes(i.resultado)) contactos += 1;
    segundos += i.duracionSeg ?? 0;
    costo += i.costo ?? 0;
  }

  const total = c.items.length;
  const cerradas = terminadas + fallidas + omitidas;
  const conResultado = c.items.filter((i) => i.resultado).length;

  return {
    total,
    pendientes,
    enCurso,
    terminadas,
    fallidas,
    omitidas,
    contactos,
    promesas: promesas?.cuenta ?? 0,
    montoPrometido: Math.round((promesas?.monto ?? 0) * 100) / 100,
    minutos: Math.round(segundos / 60),
    costo: Math.round(costo * 10000) / 10000,
    completadoPct: total > 0 ? Math.round((cerradas / total) * 100) : 0,
    tasaContactoPct: conResultado > 0 ? Math.round((contactos / conResultado) * 100) : 0,
  };
}

/**
 * Cuánto va a tardar, en minutos, a este ritmo. Sirve para que nadie arranque
 * 10,000 llamadas de 10 en 10 creyendo que termina en la tarde.
 */
export function estimarMinutos(
  pendientes: number,
  concurrencia: number,
  duracionPromedioSeg = 95,
): number {
  if (concurrencia <= 0 || pendientes <= 0) return 0;
  return Math.ceil((pendientes / concurrencia) * (duracionPromedioSeg / 60));
}

/** "3 h 20 min" a partir de minutos. */
export function duracionHumana(minutos: number): string {
  if (minutos < 1) return "menos de un minuto";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
