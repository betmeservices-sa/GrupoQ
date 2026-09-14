// El portal del paciente: lo que ve quien entra con su correo.
//
// Es para el día que el correo no llegó o el papel se perdió. La persona
// escribe el correo con el que se registró al escanear el QR del doctor y le
// salen sus recetas y sus órdenes, cada orden con el código que se da en el
// mostrador (el mismo que allá ya abre la orden sin marcar nada a mano).
//
// Lo que decide QUÉ se enseña vive acá, sin red ni base, para poder probarlo:
// la ruta solo busca y llama.
//
// Enseña lo que el paciente necesita para reclamar y nada más: ni teléfonos ni
// el diagnóstico que el doctor le escribe al técnico. Quien entra solo probó
// que sabe un correo.

import { NOMBRE_TIPO, agruparDe, conLado, preparacionDe, type TipoOrden } from "./catalogos";
import type { Doctor, Documento, Medicamento, Paciente, Sucursal, TipoUnidad } from "./tipos";

/** El correo como se compara: sin espacios ni mayúsculas. null si no es un correo. */
export function normalizarCorreo(s: string): string | null {
  const c = (s ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : null;
}

/**
 * El correo listo para un `ilike` que no busca parecidos.
 *
 * En un `like`, `_` vale por cualquier letra y `%` por cualquier cosa. El guion
 * bajo es comunísimo en un correo: sin escaparlo, "ana_p@gmail.com" abriría
 * también lo de "anaxp@gmail.com".
 */
export function patronExacto(correo: string): string {
  return correo.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Freno por clave (la IP) para la búsqueda.
 *
 * Sin él se podrían probar correos en bucle hasta dar con uno que tenga algo.
 * Vive en memoria del proceso: no es infalible entre instancias de Vercel, pero
 * corta el caso real de alguien apretando en bucle.
 */
export function demasiados(
  golpes: Map<string, number[]>,
  clave: string,
  ahora: number,
  max = 12,
  ventanaMs = 10 * 60_000,
): boolean {
  const previos = (golpes.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  previos.push(ahora);
  golpes.set(clave, previos);
  return previos.length > max;
}

export type Seccion = "receta" | TipoOrden;

export const TITULO_SECCION: Record<Seccion, string> = {
  receta: "Recetas",
  orden: "Exámenes de laboratorio",
  imagen: "Imagenología",
  proceso: "Procedimientos",
};

const ORDEN_SECCIONES: Seccion[] = ["receta", "orden", "imagen", "proceso"];

/** En qué unidad de la clínica se hace cada tipo de orden. */
const UNIDAD_DE: Record<TipoOrden, TipoUnidad> = {
  orden: "laboratorio",
  imagen: "imagenologia",
  proceso: "procesos",
};

interface Base {
  id: string;
  codigo: string;
  fecha: string;
  /** Para quién es. Importa cuando alguien registró a sus hijos con su correo. */
  paciente: string;
  doctor: { nombre: string; especialidad: string; registro: string };
}

export interface RecetaDelPortal extends Base {
  tipo: "receta";
  medicamentos: Medicamento[];
  indicaciones: string;
}

export interface OrdenDelPortal extends Base {
  tipo: TipoOrden;
  titulo: string;
  /** Agrupados por área, como en la hoja impresa, con el lado cuando lo lleva. */
  grupos: { area: string; estudios: string[] }[];
  preparacion: string[];
  indicaciones: string;
  /** Dónde se hace: las sedes de la unidad que toca. */
  lugares: { nombre: string; direccion: string; horario: string }[];
}

export type DocumentoDelPortal = RecetaDelPortal | OrdenDelPortal;

export interface Portal {
  /** El nombre con el que se registró la última vez. */
  nombre: string;
  /** Más de una persona bajo el mismo correo: cada documento dice para quién es. */
  varias: boolean;
  /** Solo las que tienen algo, en orden fijo. */
  secciones: { id: Seccion; titulo: string; cantidad: number }[];
  /** Lo más reciente primero. */
  documentos: DocumentoDelPortal[];
}

export function armarPortal(
  pacientes: Paciente[],
  documentos: Documento[],
  doctores: Doctor[],
  sucursales: Sucursal[],
): Portal {
  const deQuien = new Map(pacientes.map((p) => [p.id, p]));
  const recientes = [...pacientes].sort((a, b) => b.creado.localeCompare(a.creado));
  const nombres = new Set(pacientes.map((p) => p.nombre.trim().toLowerCase()));

  const lista: DocumentoDelPortal[] = documentos
    // La consulta ya trae solo lo de estas personas; se vuelve a filtrar porque
    // es la línea entre ver lo propio y ver lo ajeno, y no cuesta nada.
    .filter((d) => deQuien.has(d.pacienteId))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map((d): DocumentoDelPortal => {
      const dr = doctores.find((x) => x.id === d.doctorId);
      const base: Base = {
        id: d.id,
        codigo: d.codigo,
        fecha: d.fecha,
        paciente: deQuien.get(d.pacienteId)?.nombre ?? "",
        doctor: {
          nombre: dr?.nombre ?? "",
          especialidad: dr?.especialidad ?? "",
          registro: dr?.registro ?? "",
        },
      };
      if (d.tipo === "receta") {
        return {
          ...base,
          tipo: "receta",
          medicamentos: d.medicamentos ?? [],
          indicaciones: d.indicaciones ?? "",
        };
      }
      const examenes = d.examenes ?? [];
      return {
        ...base,
        tipo: d.tipo,
        titulo: NOMBRE_TIPO[d.tipo],
        grupos: agruparDe(d.tipo, examenes).map((g) => ({
          area: g.area,
          estudios: g.examenes.map((e) => conLado(e.id, d.lados)),
        })),
        preparacion: preparacionDe(examenes),
        indicaciones: d.indicaciones ?? "",
        lugares: sucursales
          .filter((s) => s.tipo === UNIDAD_DE[d.tipo])
          .map((s) => ({ nombre: s.nombre, direccion: s.direccion, horario: s.horario })),
      };
    });

  return {
    nombre: recientes[0]?.nombre ?? "",
    varias: nombres.size > 1,
    secciones: ORDEN_SECCIONES.map((id) => ({
      id,
      titulo: TITULO_SECCION[id],
      cantidad: lista.filter((d) => d.tipo === id).length,
    })).filter((s) => s.cantidad > 0),
    documentos: lista,
  };
}
