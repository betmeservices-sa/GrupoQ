// El embudo de ventas con expediente: en qué va cada prospecto, quién lo
// atiende y qué se le venció al equipo.
//
// Es puro (sin base y sin reloj propio) para poder probarlo: recibe las
// solicitudes y devuelve etapas, alertas y el reporte del gerente.
//
// LA ETAPA NO SE ESCRIBE A MANO. Sale del expediente y de las marcas de tiempo:
// si el expediente está completo, la persona ESTÁ en "documentación completa",
// aunque alguien haya tocado un selector. Así el tablero no puede mentir.

import { REQUISITOS, type Requisito } from "./crediq-requisitos";
import { HORA, DIA, type Rango } from "./periodos";

export type EtapaId =
  | "asignadas"
  | "contactadas"
  | "sin_respuesta"
  | "evaluacion"
  | "documentacion"
  | "aprobadas"
  | "rechazadas";

export interface Etapa {
  id: EtapaId;
  nombre: string;
  /** Qué significa estar acá, para quien abre el tablero por primera vez. */
  ayuda: string;
  /** El color del tramo en el embudo. Uno por etapa, para leerlo de un vistazo. */
  color: string;
}

export const ETAPAS: Etapa[] = [
  {
    id: "asignadas",
    nombre: "Leads asignadas",
    ayuda: "Entró el lead y tiene vendedor, pero todavía nadie le habla",
    color: "#38bdf8",
  },
  {
    id: "contactadas",
    nombre: "Leads contactadas",
    ayuda: "Ya se le habló y respondió",
    color: "#0ea5e9",
  },
  {
    id: "sin_respuesta",
    nombre: "Sin respuesta del lead",
    ayuda: "Se le habló, no mandó nada y lleva días sin moverse",
    color: "#f59e0b",
  },
  {
    id: "evaluacion",
    nombre: "Leads en evaluación",
    ayuda: "Expediente completo, esperando resolución",
    color: "#6366f1",
  },
  {
    id: "documentacion",
    nombre: "Leads pendientes de documentación",
    ayuda: "Se le pidieron los papeles y falta alguno o hay que corregirlo",
    color: "#0369a1",
  },
  { id: "aprobadas", nombre: "Leads aprobadas", ayuda: "Crédito aprobado", color: "#16a34a" },
  { id: "rechazadas", nombre: "Leads rechazadas", ayuda: "No procedió", color: "#dc2626" },
];

export const ETAPA: Record<EtapaId, Etapa> = Object.fromEntries(ETAPAS.map((e) => [e.id, e])) as Record<EtapaId, Etapa>;

// ---- Expediente -------------------------------------------------------------

export type EstadoDoc = "falta" | "recibido" | "aprobado" | "rechazado";

/** Por qué se devolvió un documento. Cerrado a propósito: es lo que se reporta. */
export const MOTIVOS_RECHAZO = [
  { id: "ilegible", nombre: "No se lee" },
  { id: "vencido", nombre: "Vencido" },
  { id: "nombre", nombre: "El nombre no coincide" },
  { id: "incompleto", nombre: "Incompleto (falta una página o un lado)" },
  { id: "titular", nombre: "No está a nombre de la persona" },
  { id: "monto", nombre: "No se ve el monto" },
  { id: "otro", nombre: "Otro" },
] as const;

export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number]["id"];

export function nombreDeMotivo(id: string | null | undefined): string {
  return MOTIVOS_RECHAZO.find((m) => m.id === id)?.nombre ?? "Sin motivo";
}

export interface DocEnExpediente {
  estado: EstadoDoc;
  /** Solo cuando está rechazado. */
  motivo?: MotivoRechazo | null;
  /** Nota del revisor, si escribió una. */
  nota?: string | null;
  /** Cuándo quedó en este estado (ISO). */
  ts?: string | null;
  /** Quién lo revisó (staffId) o "sofia" si lo recibió el agente. */
  por?: string | null;
}

export type Expediente = Record<string, DocEnExpediente>;

export function docDe(exp: Expediente | null | undefined, id: string): DocEnExpediente {
  return exp?.[id] ?? { estado: "falta" };
}

export interface DocConEstado extends Requisito, DocEnExpediente {}

/** El expediente completo, en el orden en que se piden los documentos. */
export function expedienteDe(exp: Expediente | null | undefined): DocConEstado[] {
  return REQUISITOS.map((r) => ({ ...r, ...docDe(exp, r.id) }));
}

export const TOTAL_DOCS = REQUISITOS.length;

export function aprobados(exp: Expediente | null | undefined): number {
  return expedienteDe(exp).filter((d) => d.estado === "aprobado").length;
}

export function expedienteCompleto(exp: Expediente | null | undefined): boolean {
  return aprobados(exp) === TOTAL_DOCS;
}

export type SubEstado = "sin_entregar" | "parcial" | "con_observacion" | "en_revision";

export interface DetalleDocumentacion {
  sub: SubEstado;
  /** Frase corta para la tarjeta: "faltan la constancia y el recibo". */
  resumen: string;
  faltan: DocConEstado[];
  rechazados: DocConEstado[];
  porRevisar: DocConEstado[];
  aprobados: number;
  total: number;
}

const lista = (nombres: string[]): string =>
  nombres.length <= 1 ? (nombres[0] ?? "") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;

/**
 * En qué punto de la documentación va, y qué hay que hacer.
 *
 * Un documento devuelto pesa MÁS que uno que falta: al que falta hay que
 * esperarlo, al devuelto hay que volver a pedirlo explicando qué salió mal.
 */
export function detalleDocumentacion(exp: Expediente | null | undefined): DetalleDocumentacion {
  const docs = expedienteDe(exp);
  const faltan = docs.filter((d) => d.estado === "falta");
  const rechazados = docs.filter((d) => d.estado === "rechazado");
  const porRevisar = docs.filter((d) => d.estado === "recibido");
  const ok = docs.filter((d) => d.estado === "aprobado").length;

  let sub: SubEstado;
  let resumen: string;
  if (rechazados.length > 0) {
    sub = "con_observacion";
    const detalle = rechazados.map((d) => `${d.nombre.toLowerCase()}: ${nombreDeMotivo(d.motivo).toLowerCase()}`);
    resumen = `hay que volver a pedir ${lista(detalle)}`;
  } else if (faltan.length === TOTAL_DOCS) {
    sub = "sin_entregar";
    resumen = "no ha mandado nada todavía";
  } else if (faltan.length === 0) {
    sub = "en_revision";
    resumen =
      porRevisar.length === 0
        ? "expediente completo, esperando resolución"
        : `entregó todo, falta revisar ${porRevisar.length} ${porRevisar.length === 1 ? "documento" : "documentos"}`;
  } else {
    sub = "parcial";
    resumen = `${faltan.length === 1 ? "falta" : "faltan"} ${lista(faltan.map((d) => d.nombre.toLowerCase()))}`;
  }
  return { sub, resumen, faltan, rechazados, porRevisar, aprobados: ok, total: TOTAL_DOCS };
}

// ---- La solicitud -----------------------------------------------------------

export type Resultado = "venta" | "perdido";

/**
 * De dónde salió el lead.
 *
 * Lo marca el vendedor a mano: el sistema sabe por dónde ENTRÓ el mensaje,
 * pero no de dónde venía la persona (un WhatsApp puede nacer de un anuncio de
 * Instagram, y quien lo sabe es quien habló con ella). "organico" es el que
 * llega solo: recomendado, de paso por la sala, o buscando la marca.
 */
export type CanalLead = "whatsapp" | "instagram" | "facebook" | "organico";

export const CANALES: { id: CanalLead; nombre: string; color: string }[] = [
  { id: "whatsapp", nombre: "WhatsApp", color: "#25D366" },
  { id: "instagram", nombre: "Instagram", color: "#E1306C" },
  { id: "facebook", nombre: "Facebook", color: "#1877F2" },
  { id: "organico", nombre: "Orgánico", color: "#64748b" },
];

export const CANAL: Record<CanalLead, { id: CanalLead; nombre: string; color: string }> =
  Object.fromEntries(CANALES.map((c) => [c.id, c])) as Record<
    CanalLead,
    { id: CanalLead; nombre: string; color: string }
  >;

export function esCanal(v: unknown): v is CanalLead {
  return typeof v === "string" && CANALES.some((c) => c.id === v);
}

/**
 * Los leads de un vendedor, partidos por canal.
 *
 * Puro y aparte de la pantalla para poder probarlo: una barra apilada que
 * cuenta mal es de las cosas que nadie nota hasta que alguien suma a mano.
 * Los que no tienen canal marcado NO se reparten ni se adivinan: van en su
 * propio grupo, que es la señal de que hay fichas sin llenar.
 */
export function porCanal(solicitudes: Solicitud[]): {
  canal: CanalLead | null;
  nombre: string;
  color: string;
  n: number;
  monto: number;
}[] {
  const grupos: { canal: CanalLead | null; nombre: string; color: string }[] = [
    ...CANALES.map((c) => ({ canal: c.id as CanalLead | null, nombre: c.nombre, color: c.color })),
    { canal: null, nombre: "Sin marcar", color: "#cbd5e1" },
  ];
  return grupos
    .map((g) => {
      const suyos = solicitudes.filter((s) => (s.canal ?? null) === g.canal);
      return { ...g, n: suyos.length, monto: suyos.reduce((m, s) => m + (s.monto ?? 0), 0) };
    })
    .filter((g) => g.n > 0);
}

export interface Solicitud {
  tenant: string;
  /** wa_from del contacto: la misma llave que la ficha y la conversación. */
  telefono: string;
  nombre: string;
  vehiculo?: string | null;
  expediente: Expediente;
  /** staffId del vendedor a cargo. */
  vendedor: string | null;
  creado: string;
  contactado: string | null;
  /** Cuándo se le pidió la documentación. */
  pedidos: string | null;
  /** Cuándo quedó el expediente aprobado completo. */
  completado: string | null;
  asignado: string | null;
  /** Cuándo el vendedor lo tomó (primer contacto suyo). */
  tomado: string | null;
  cerrado: string | null;
  resultado: Resultado | null;
  motivoCierre: string | null;
  /** Cuándo se le avisó al gerente que nadie lo tomaba. */
  avisado: string | null;
  /** Cuándo se marcó vencido (pasó el plazo largo). */
  escalado: string | null;
  /**
   * Cuánto quiere financiar, en dólares. Es lo que Sofía le pregunta por
   * teléfono, así que llega en palabras y puede no llegar nunca: sin monto el
   * lead vale cero en el embudo, no se inventa un promedio.
   */
  monto?: number | null;
  /** De dónde vino, marcado a mano por el vendedor. */
  canal?: CanalLead | null;
  /**
   * Cuántas veces se le ha buscado. No sale del expediente sino de las
   * llamadas y del chat, por eso es opcional: quien arma la lista decide si
   * paga esa consulta.
   */
  contactos?: { llamadas: number; mensajes: number; ultimo: string | null } | null;
  actualizado: string;
}

/**
 * La etapa sale del expediente y las marcas de tiempo, nunca de un campo suelto.
 *
 * El orden de las preguntas ES la definición: se resuelve de lo más avanzado a
 * lo menos, así un caso cerrado nunca se confunde con uno que además debe
 * papeles. "Sin respuesta" es el único que mira el reloj: no hay un campo que
 * diga que el lead dejó de contestar, se deduce de que se le habló, no mandó
 * nada y hace días que nadie mueve el caso.
 */
export function etapaDe(s: Solicitud, ahora: number = Date.now()): EtapaId {
  // Aprobada es SOLO lo que se marcó como venta. Un caso cerrado sin resultado
  // no se cuenta como aprobado: en un embudo de crédito eso sería inflar la
  // única cifra que nadie quiere ver inflada.
  if (s.cerrado) return s.resultado === "venta" ? "aprobadas" : "rechazadas";
  if (expedienteCompleto(s.expediente)) return "evaluacion";
  if (s.pedidos || Object.keys(s.expediente ?? {}).length > 0) return "documentacion";
  if (s.contactado) {
    const quieto = ahora - Date.parse(s.actualizado) >= DIAS_SIN_RESPUESTA * DIA;
    return quieto ? "sin_respuesta" : "contactadas";
  }
  return "asignadas";
}

/** Días de silencio tras el contacto para dar al lead por no respondido. */
export const DIAS_SIN_RESPUESTA = 3;

// ---- Plazos -----------------------------------------------------------------

/** Aviso al gerente si el vendedor no toma el caso. */
export const HORAS_AVISO = 48;
/** Vencido: pasó el plazo largo y hay que reasignar. */
export const HORAS_VENCIDO = 72;
/** Días sin movimiento para considerar estancado un expediente. */
export const DIAS_ESTANCADO = 3;

export type NivelAlerta = "aviso" | "vencido";

export interface Alerta {
  telefono: string;
  nombre: string;
  vendedor: string | null;
  nivel: NivelAlerta;
  /** Horas desde que se asignó. */
  horas: number;
  desde: string;
  avisado: string | null;
}

const horasEntre = (desde: string, ahora: number) => Math.max(0, (ahora - Date.parse(desde)) / HORA);

/**
 * Si el caso ya se pasó del plazo sin que el vendedor lo tome.
 * null = va en tiempo (o todavía no está asignado).
 */
export function nivelDeAlerta(s: Solicitud, ahora = Date.now()): NivelAlerta | null {
  if (!s.asignado || s.tomado || s.cerrado) return null;
  const h = horasEntre(s.asignado, ahora);
  if (h >= HORAS_VENCIDO) return "vencido";
  if (h >= HORAS_AVISO) return "aviso";
  return null;
}

export function alertasDe(solicitudes: Solicitud[], ahora = Date.now()): Alerta[] {
  return solicitudes
    .map((s) => {
      const nivel = nivelDeAlerta(s, ahora);
      if (!nivel || !s.asignado) return null;
      return {
        telefono: s.telefono,
        nombre: s.nombre,
        vendedor: s.vendedor,
        nivel,
        horas: Math.round(horasEntre(s.asignado, ahora)),
        desde: s.asignado,
        avisado: s.avisado,
      };
    })
    .filter((a): a is Alerta => a !== null)
    .sort((a, b) => b.horas - a.horas);
}

/** Los que llevan días sin moverse en una etapa: el equipo los dejó enfriar. */
export function estancados(
  solicitudes: Solicitud[],
  ahora = Date.now(),
  dias = DIAS_ESTANCADO,
  etapa: EtapaId = "documentacion",
): Solicitud[] {
  return solicitudes
    .filter((s) => etapaDe(s, ahora) === etapa && ahora - Date.parse(s.actualizado) >= dias * DIA)
    .sort((a, b) => a.actualizado.localeCompare(b.actualizado));
}

/**
 * Lo mismo, ya redactado para la pantalla.
 *
 * Los días sin contacto salen del último contacto REAL (llamada o mensaje)
 * cuando se conoce; si nadie lo consultó, del último movimiento del caso, que
 * es lo más cerca que estamos de eso.
 */
export function friosDe(solicitudes: Solicitud[], etapa: EtapaId, ahora = Date.now()): LeadFrio[] {
  return estancados(solicitudes, ahora, DIAS_ESTANCADO, etapa).map((s) => ({
    telefono: s.telefono,
    nombre: s.nombre,
    vendedor: s.vendedor,
    monto: s.monto ?? null,
    canal: s.canal ?? null,
    resumen: detalleDocumentacion(s.expediente).resumen,
    diasSinContacto: Math.floor((ahora - Date.parse(s.contactos?.ultimo ?? s.actualizado)) / DIA),
    diasDesdeInfo: Math.floor((ahora - Date.parse(s.creado)) / DIA),
    llamadas: s.contactos?.llamadas ?? 0,
    mensajes: s.contactos?.mensajes ?? 0,
  }));
}

// ---- Reparto ----------------------------------------------------------------

export interface Vendedor {
  id: string;
  nombre: string;
  iniciales: string;
}

/**
 * A quién le toca el siguiente caso: al que menos casos activos tiene; si
 * empatan, al que hace más rato no recibe uno. Reparte parejo sin que nadie
 * tenga que llevar la cuenta.
 */
export function siguienteVendedor(vendedores: Vendedor[], solicitudes: Solicitud[]): Vendedor | null {
  if (vendedores.length === 0) return null;
  const activos = new Map<string, number>();
  const ultimo = new Map<string, number>();
  for (const s of solicitudes) {
    if (!s.vendedor) continue;
    const etapa = etapaDe(s);
    if (etapa !== "aprobadas" && etapa !== "rechazadas") {
      activos.set(s.vendedor, (activos.get(s.vendedor) ?? 0) + 1);
    }
    if (s.asignado) {
      const t = Date.parse(s.asignado);
      if (t > (ultimo.get(s.vendedor) ?? 0)) ultimo.set(s.vendedor, t);
    }
  }
  return [...vendedores].sort((a, b) => {
    const d = (activos.get(a.id) ?? 0) - (activos.get(b.id) ?? 0);
    if (d !== 0) return d;
    return (ultimo.get(a.id) ?? 0) - (ultimo.get(b.id) ?? 0);
  })[0];
}

// ---- Reporte del gerente ----------------------------------------------------

export interface FilaVendedor {
  id: string;
  nombre: string;
  iniciales: string;
  /** Casos que tiene ahora mismo sin cerrar. */
  activos: number;
  sinTomar: number;
  vencidos: number;
  /** En el periodo. */
  asignados: number;
  tomados: number;
  cerrados: number;
  ventas: number;
  perdidos: number;
  /** Horas promedio entre que se le asignó y lo tomó. null si no tomó ninguno. */
  horasEnTomar: number | null;
  /** Ventas sobre casos cerrados, en porcentaje. */
  tasaCierre: number | null;
  /** Los leads que se le asignaron en el periodo, para abrir la barra. */
  leads: LeadEnEtapa[];
}

/** Un lead como se ve en el embudo y en la barra del vendedor. */
export interface LeadEnEtapa {
  telefono: string;
  nombre: string;
  vendedor: string | null;
  /** Cuánto quiere financiar. null si nunca lo dijo. */
  monto: number | null;
  canal: CanalLead | null;
}

/** Un lead que se está enfriando, con todo lo que hace falta para decidir. */
export interface LeadFrio extends LeadEnEtapa {
  /** Qué le falta, en una frase. */
  resumen: string;
  /** Días desde el último movimiento del caso. */
  diasSinContacto: number;
  /** Días desde que entró el lead. */
  diasDesdeInfo: number;
  llamadas: number;
  mensajes: number;
}

export interface ReporteVentas {
  periodo: Rango;
  /** Foto de ahora: cuántos hay en cada etapa, con su plata y su gente. */
  embudo: {
    etapa: EtapaId;
    nombre: string;
    ayuda: string;
    color: string;
    n: number;
    /** Suma de lo que quieren financiar los de esta etapa. */
    monto: number;
    leads: LeadEnEtapa[];
  }[];
  /** Lo que pasó DENTRO del periodo. */
  movimiento: {
    nuevos: number;
    contactados: number;
    completados: number;
    asignados: number;
    tomados: number;
    ventas: number;
    perdidos: number;
    tasaCierre: number | null;
  };
  anterior: { nuevos: number; completados: number; ventas: number };
  documentos: {
    /** Cuántas personas deben cada documento. */
    faltantes: { id: string; nombre: string; n: number }[];
    /** Por qué se están devolviendo. */
    rechazos: { motivo: string; nombre: string; n: number }[];
    porRevisar: number;
    subEstados: { sub: SubEstado; nombre: string; n: number }[];
  };
  vendedores: FilaVendedor[];
  /** Sin vendedor y con expediente completo: nadie los ha tomado. */
  sinAsignar: number;
  alertas: Alerta[];
  /**
   * Los que llevan días quietos, separados por lo que hay que hacerles: a unos
   * hay que perseguirles un papel, a los otros ya no se les debe nada y aun así
   * nadie los movió, que es la peor de las dos.
   */
  enfriandose: { pendientesDoc: LeadFrio[]; docCompleta: LeadFrio[] };
  tiempos: {
    /** Horas promedio de lead nuevo a expediente completo. */
    aExpedienteCompleto: number | null;
    /** De asignación a primer contacto del vendedor. */
    aPrimerContacto: number | null;
    /** De asignación a cierre. */
    aCierre: number | null;
  };
}

export const NOMBRE_SUB: Record<SubEstado, string> = {
  sin_entregar: "No ha mandado nada",
  parcial: "Entregó parte",
  con_observacion: "Con observación",
  en_revision: "Entregó todo, en revisión",
};

const dentro = (ts: string | null | undefined, r: { desde: string; hasta: string }): boolean =>
  !!ts && ts >= r.desde && ts < r.hasta;

const promedioHoras = (pares: [string, string][]): number | null => {
  if (pares.length === 0) return null;
  const total = pares.reduce((s, [a, b]) => s + (Date.parse(b) - Date.parse(a)), 0);
  return Math.round((total / pares.length / HORA) * 10) / 10;
};

export function reporteVentas(
  solicitudes: Solicitud[],
  vendedores: Vendedor[],
  rango: Rango,
  ahora: Date = new Date(),
): ReporteVentas {
  const t = ahora.getTime();
  const abiertas = solicitudes.filter((s) => !s.cerrado);

  const comoLead = (s: Solicitud): LeadEnEtapa => ({
    telefono: s.telefono,
    nombre: s.nombre,
    vendedor: s.vendedor,
    monto: s.monto ?? null,
    canal: s.canal ?? null,
  });

  const embudo = ETAPAS.map((e) => {
    const suyas = solicitudes.filter((s) => etapaDe(s, t) === e.id);
    return {
      etapa: e.id,
      nombre: e.nombre,
      ayuda: e.ayuda,
      color: e.color,
      n: suyas.length,
      // Los que no dijeron monto suman cero. Es preferible un embudo que se
      // queda corto a uno que promedia y le inventa plata al gerente.
      monto: suyas.reduce((m, s) => m + (s.monto ?? 0), 0),
      leads: suyas.map(comoLead).sort((a, b) => (b.monto ?? 0) - (a.monto ?? 0)),
    };
  });

  const enPeriodo = <K extends keyof Solicitud>(campo: K) =>
    solicitudes.filter((s) => dentro(s[campo] as string | null, rango));
  const cerradasPeriodo = enPeriodo("cerrado");
  const ventas = cerradasPeriodo.filter((s) => s.resultado === "venta").length;
  const perdidos = cerradasPeriodo.filter((s) => s.resultado === "perdido").length;

  const antes = rango.anterior;
  const enAntes = (campo: keyof Solicitud) =>
    solicitudes.filter((s) => dentro(s[campo] as string | null, antes)).length;

  // Documentos: solo de quien todavía está en documentación.
  const enDocs = abiertas.filter((s) => etapaDe(s, t) === "documentacion");
  const faltantes = REQUISITOS.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    n: enDocs.filter((s) => {
      const e = docDe(s.expediente, r.id).estado;
      return e === "falta" || e === "rechazado";
    }).length,
  })).filter((f) => f.n > 0);

  const rechazosPor = new Map<string, number>();
  for (const s of enDocs) {
    for (const d of expedienteDe(s.expediente)) {
      if (d.estado === "rechazado") {
        const k = d.motivo ?? "otro";
        rechazosPor.set(k, (rechazosPor.get(k) ?? 0) + 1);
      }
    }
  }

  const subEstados = (Object.keys(NOMBRE_SUB) as SubEstado[])
    .map((sub) => ({
      sub,
      nombre: NOMBRE_SUB[sub],
      n: enDocs.filter((s) => detalleDocumentacion(s.expediente).sub === sub).length,
    }))
    .filter((x) => x.n > 0);

  const filasVendedor: FilaVendedor[] = vendedores.map((v) => {
    const suyas = solicitudes.filter((s) => s.vendedor === v.id);
    const activas = suyas.filter((s) => {
      const e = etapaDe(s, t);
      return e !== "aprobadas" && e !== "rechazadas";
    });
    const cerradas = suyas.filter((s) => dentro(s.cerrado, rango));
    const ventasV = cerradas.filter((s) => s.resultado === "venta").length;
    const tomadas = suyas.filter((s) => dentro(s.tomado, rango));
    return {
      id: v.id,
      nombre: v.nombre,
      iniciales: v.iniciales,
      activos: activas.length,
      sinTomar: activas.filter((s) => !s.tomado).length,
      vencidos: activas.filter((s) => nivelDeAlerta(s, t) !== null).length,
      asignados: suyas.filter((s) => dentro(s.asignado, rango)).length,
      tomados: tomadas.length,
      cerrados: cerradas.length,
      ventas: ventasV,
      perdidos: cerradas.length - ventasV,
      horasEnTomar: promedioHoras(
        suyas.filter((s) => s.asignado && s.tomado).map((s) => [s.asignado as string, s.tomado as string]),
      ),
      tasaCierre: cerradas.length ? Math.round((ventasV / cerradas.length) * 100) : null,
      leads: suyas.filter((s) => dentro(s.asignado, rango)).map(comoLead).sort((a, b) => (b.monto ?? 0) - (a.monto ?? 0)),
    };
  });

  return {
    periodo: rango,
    embudo,
    movimiento: {
      nuevos: enPeriodo("creado").length,
      contactados: enPeriodo("contactado").length,
      completados: enPeriodo("completado").length,
      asignados: enPeriodo("asignado").length,
      tomados: enPeriodo("tomado").length,
      ventas,
      perdidos,
      tasaCierre: cerradasPeriodo.length ? Math.round((ventas / cerradasPeriodo.length) * 100) : null,
    },
    anterior: {
      nuevos: enAntes("creado"),
      completados: enAntes("completado"),
      ventas: solicitudes.filter((s) => dentro(s.cerrado, antes) && s.resultado === "venta").length,
    },
    documentos: {
      faltantes,
      rechazos: [...rechazosPor.entries()]
        .map(([motivo, n]) => ({ motivo, nombre: nombreDeMotivo(motivo), n }))
        .sort((a, b) => b.n - a.n),
      porRevisar: enDocs.filter((s) => detalleDocumentacion(s.expediente).porRevisar.length > 0).length,
      subEstados,
    },
    vendedores: filasVendedor.sort((a, b) => b.activos - a.activos || b.ventas - a.ventas),
    sinAsignar: abiertas.filter((s) => !s.vendedor).length,
    alertas: alertasDe(abiertas, t),
    enfriandose: {
      pendientesDoc: friosDe(abiertas, "documentacion", t),
      docCompleta: friosDe(abiertas, "evaluacion", t),
    },
    tiempos: {
      aExpedienteCompleto: promedioHoras(
        solicitudes.filter((s) => s.completado).map((s) => [s.creado, s.completado as string]),
      ),
      aPrimerContacto: promedioHoras(
        solicitudes.filter((s) => s.asignado && s.tomado).map((s) => [s.asignado as string, s.tomado as string]),
      ),
      aCierre: promedioHoras(
        solicitudes.filter((s) => s.asignado && s.cerrado).map((s) => [s.asignado as string, s.cerrado as string]),
      ),
    },
  };
}
