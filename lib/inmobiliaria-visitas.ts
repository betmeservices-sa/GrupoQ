// La agenda de visitas del agente inmobiliario.
//
// FUENTE ÚNICA: una visita no es un registro aparte, es un LEAD que está en la
// etapa "visita agendada" con su día y su hora. Si hubiera dos listas (leads por
// un lado, citas por otro) se desincronizan al primer cambio, y el agente
// terminaría creyéndole a la que está mal. Por eso `visita` cuelga del lead, y
// agendar desde la ficha mueve al lead a esa etapa.
//
// Todo puro: entra la lista de leads, la cartera y el día de hoy, y sale la
// agenda ya resuelta. Sin reloj ni red, para poder probarla con fechas fijas.

import { sumarDias } from "./inmobiliaria-pipeline";
import type {
  CanalLead,
  LeadSemilla,
  PropiedadSemilla,
  TipoOperacion,
  TipoPropiedad,
  VisitaAgendada,
} from "./inmobiliaria-tipos";

export const DURACION_POR_DEFECTO = 45;

export interface Visita {
  id: string; // el del lead: un lead, una visita
  leadId: string;
  fecha: string;
  hora: string;
  inicio: number; // minutos desde medianoche
  fin: number;
  duracionMin: number;
  confirmada: boolean;
  nota?: string;
  operacion: TipoOperacion;
  cliente: string;
  canal: CanalLead;
  telefonoBusca: string; // qué anda buscando, en una línea
  propiedadId: string;
  codigo: string;
  tipo: TipoPropiedad;
  zona: string;
  municipio: string;
  precio: number;
  // Aviso de la visita que quedó pegada a la anterior. Va en la SEGUNDA, que es
  // la que se pierde por llegar tarde.
  choque: string | null;
}

export interface DiaDeAgenda {
  fecha: string;
  visitas: Visita[];
  sinConfirmar: number;
  choques: number;
}

export interface Agenda {
  hoy: string;
  visitas: Visita[]; // todas, ordenadas por día y hora
  dias: DiaDeAgenda[]; // solo los días que tienen algo
  hoyVisitas: Visita[];
  proximas: Visita[]; // de mañana en adelante
  sinConfirmar: number; // de hoy en adelante
  choques: number;
}

// Minutos que hay que dejar entre dos visitas para llegar. En el área
// metropolitana cruzar de un municipio a otro a media mañana es media hora
// larga; dentro de la misma colonia es caminar.
export const HOLGURA_MISMA_ZONA = 15;
export const HOLGURA_MISMO_MUNICIPIO = 30;
export const HOLGURA_OTRO_MUNICIPIO = 45;

export function aMinutos(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora ?? "").trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function aHora(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// Como lo dice la gente: "10:00 a.m.", "2:30 p.m.".
export function horaHablada(hora: string): string {
  const min = aMinutos(hora);
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const sufijo = h24 < 12 ? "a.m." : "p.m.";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}:00 ${sufijo}` : `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

export function fechaDeVisita(v: VisitaAgendada, hoy: string): string {
  return v.fecha ?? sumarDias(hoy, v.enDias ?? 0);
}

// Cuánto hay que dejar entre dos visitas según lo lejos que queden.
export function holguraEntre(a: Visita, b: Visita): number {
  if (a.municipio !== b.municipio) return HOLGURA_OTRO_MUNICIPIO;
  if (a.zona !== b.zona) return HOLGURA_MISMO_MUNICIPIO;
  return HOLGURA_MISMA_ZONA;
}

// Marca la visita que quedó demasiado pegada a la anterior. Perder una visita
// por llegar tarde cuesta plata, y el agente no lo ve venir mirando una lista.
export function marcarChoques(delDia: Visita[]): Visita[] {
  const orden = [...delDia].sort((a, b) => a.inicio - b.inicio);
  return orden.map((v, i) => {
    if (i === 0) return { ...v, choque: null };
    const previa = orden[i - 1];
    const hueco = v.inicio - previa.fin;
    const necesario = holguraEntre(previa, v);
    if (hueco < 0) {
      return {
        ...v,
        choque: `Se encima con la de ${horaHablada(previa.hora)} en ${previa.zona}.`,
      };
    }
    if (hueco < necesario) {
      const donde =
        previa.municipio !== v.municipio
          ? `${previa.zona}, ${previa.municipio}`
          : previa.zona;
      return {
        ...v,
        choque: `Quedan ${hueco} minutos desde la de ${horaHablada(previa.hora)} en ${donde}. No se llega.`,
      };
    }
    return { ...v, choque: null };
  });
}

export function construirAgenda(entrada: {
  leads: LeadSemilla[];
  propiedades: PropiedadSemilla[];
  hoy: string;
}): Agenda {
  const porId = new Map(entrada.propiedades.map((p) => [p.id, p]));

  const crudas: Visita[] = [];
  for (const lead of entrada.leads) {
    // La agenda sale de la etapa, no de una lista aparte: si el lead ya cerró o
    // volvió atrás, su visita deja de estar.
    if (lead.etapa !== "visita" || !lead.visita) continue;
    const p = porId.get(lead.visita.propiedadId);
    if (!p) continue;
    const duracionMin = lead.visita.duracionMin ?? DURACION_POR_DEFECTO;
    const inicio = aMinutos(lead.visita.hora);
    crudas.push({
      id: lead.id,
      leadId: lead.id,
      fecha: fechaDeVisita(lead.visita, entrada.hoy),
      hora: lead.visita.hora,
      inicio,
      fin: inicio + duracionMin,
      duracionMin,
      confirmada: lead.visita.confirmada,
      nota: lead.visita.nota,
      operacion: lead.operacion,
      cliente: lead.nombre,
      canal: lead.canal,
      telefonoBusca: lead.busca,
      propiedadId: p.id,
      codigo: p.codigo,
      tipo: p.tipo,
      zona: p.zona,
      municipio: p.municipio,
      precio: p.precio,
      choque: null,
    });
  }

  const porDia = new Map<string, Visita[]>();
  for (const v of crudas) {
    porDia.set(v.fecha, [...(porDia.get(v.fecha) ?? []), v]);
  }

  const dias: DiaDeAgenda[] = [...porDia.entries()]
    .map(([fecha, delDia]) => {
      const visitas = marcarChoques(delDia);
      return {
        fecha,
        visitas,
        sinConfirmar: visitas.filter((v) => !v.confirmada).length,
        choques: visitas.filter((v) => v.choque).length,
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const visitas = dias.flatMap((d) => d.visitas);
  const deHoyEnAdelante = visitas.filter((v) => v.fecha >= entrada.hoy);

  return {
    hoy: entrada.hoy,
    visitas,
    dias,
    hoyVisitas: visitas.filter((v) => v.fecha === entrada.hoy),
    proximas: visitas.filter((v) => v.fecha > entrada.hoy),
    sinConfirmar: deHoyEnAdelante.filter((v) => !v.confirmada).length,
    choques: deHoyEnAdelante.filter((v) => v.choque).length,
  };
}

export function visitasDe(agenda: Agenda, fecha: string): Visita[] {
  return agenda.dias.find((d) => d.fecha === fecha)?.visitas ?? [];
}

// ── Mes ──

export interface CeldaMes {
  fecha: string;
  delMes: boolean;
  esHoy: boolean;
  visitas: number;
  sinConfirmar: number;
  choques: number;
}

// Rejilla de seis semanas que empieza en LUNES, como se lee un calendario aquí.
export function armarMes(agenda: Agenda, ancla: string): CeldaMes[] {
  const [a, m] = ancla.split("-").map(Number);
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const diaSemana = (primero.getUTCDay() + 6) % 7; // 0 = lunes
  const inicio = new Date(primero);
  inicio.setUTCDate(inicio.getUTCDate() - diaSemana);

  const celdas: CeldaMes[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setUTCDate(d.getUTCDate() + i);
    const fecha = d.toISOString().slice(0, 10);
    const delDia = agenda.dias.find((x) => x.fecha === fecha);
    celdas.push({
      fecha,
      delMes: d.getUTCMonth() === m - 1,
      esHoy: fecha === agenda.hoy,
      visitas: delDia?.visitas.length ?? 0,
      sinConfirmar: delDia?.sinConfirmar ?? 0,
      choques: delDia?.choques ?? 0,
    });
  }
  return celdas;
}

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}

export function sumarMeses(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
