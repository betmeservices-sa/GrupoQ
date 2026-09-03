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
  | "nuevo"
  | "contactado"
  | "documentacion"
  | "completa"
  | "asignado"
  | "gestion"
  | "cerrado";

export interface Etapa {
  id: EtapaId;
  nombre: string;
  /** Qué significa estar acá, para quien abre el tablero por primera vez. */
  ayuda: string;
}

export const ETAPAS: Etapa[] = [
  { id: "nuevo", nombre: "Nuevo lead", ayuda: "Escribió y todavía nadie le contesta" },
  { id: "contactado", nombre: "Contactado", ayuda: "Ya se le habló, falta pedirle la documentación" },
  { id: "documentacion", nombre: "Pendiente de documentación", ayuda: "Se le pidieron los papeles y falta alguno o hay que corregirlo" },
  { id: "completa", nombre: "Documentación completa", ayuda: "Expediente aprobado, listo para que lo tome un vendedor" },
  { id: "asignado", nombre: "Asignado a vendedor", ayuda: "Tiene vendedor, esperando que lo contacte" },
  { id: "gestion", nombre: "En gestión", ayuda: "El vendedor ya lo contactó y está negociando" },
  { id: "cerrado", nombre: "Cerrado", ayuda: "Venta hecha o descartado" },
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
    resumen = `entregó todo, falta revisar ${porRevisar.length} ${porRevisar.length === 1 ? "documento" : "documentos"}`;
  } else {
    sub = "parcial";
    resumen = `${faltan.length === 1 ? "falta" : "faltan"} ${lista(faltan.map((d) => d.nombre.toLowerCase()))}`;
  }
  return { sub, resumen, faltan, rechazados, porRevisar, aprobados: ok, total: TOTAL_DOCS };
}

// ---- La solicitud -----------------------------------------------------------

export type Resultado = "venta" | "perdido";

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
  actualizado: string;
}

/** La etapa sale del expediente y las marcas de tiempo, nunca de un campo suelto. */
export function etapaDe(s: Solicitud): EtapaId {
  if (s.cerrado) return "cerrado";
  if (s.tomado) return "gestion";
  if (s.asignado) return "asignado";
  if (expedienteCompleto(s.expediente)) return "completa";
  if (s.pedidos || Object.keys(s.expediente ?? {}).length > 0) return "documentacion";
  if (s.contactado) return "contactado";
  return "nuevo";
}

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

/** Expedientes que llevan días sin moverse: el equipo los dejó enfriar. */
export function estancados(solicitudes: Solicitud[], ahora = Date.now(), dias = DIAS_ESTANCADO): Solicitud[] {
  return solicitudes
    .filter((s) => etapaDe(s) === "documentacion" && ahora - Date.parse(s.actualizado) >= dias * DIA)
    .sort((a, b) => a.actualizado.localeCompare(b.actualizado));
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
    if (etapa === "asignado" || etapa === "gestion") {
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
}

export interface ReporteVentas {
  periodo: Rango;
  /** Foto de ahora: cuántos hay en cada etapa. */
  embudo: { etapa: EtapaId; nombre: string; ayuda: string; n: number }[];
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
  estancados: { telefono: string; nombre: string; dias: number; resumen: string }[];
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

  const embudo = ETAPAS.map((e) => ({
    etapa: e.id,
    nombre: e.nombre,
    ayuda: e.ayuda,
    n: solicitudes.filter((s) => etapaDe(s) === e.id).length,
  }));

  const enPeriodo = <K extends keyof Solicitud>(campo: K) =>
    solicitudes.filter((s) => dentro(s[campo] as string | null, rango));
  const cerradasPeriodo = enPeriodo("cerrado");
  const ventas = cerradasPeriodo.filter((s) => s.resultado === "venta").length;
  const perdidos = cerradasPeriodo.filter((s) => s.resultado === "perdido").length;

  const antes = rango.anterior;
  const enAntes = (campo: keyof Solicitud) =>
    solicitudes.filter((s) => dentro(s[campo] as string | null, antes)).length;

  // Documentos: solo de quien todavía está en documentación.
  const enDocs = abiertas.filter((s) => etapaDe(s) === "documentacion");
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
      const e = etapaDe(s);
      return e === "asignado" || e === "gestion";
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
    sinAsignar: abiertas.filter((s) => etapaDe(s) === "completa").length,
    alertas: alertasDe(abiertas, t),
    estancados: estancados(abiertas, t).map((s) => ({
      telefono: s.telefono,
      nombre: s.nombre,
      dias: Math.floor((t - Date.parse(s.actualizado)) / DIA),
      resumen: detalleDocumentacion(s.expediente).resumen,
    })),
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
