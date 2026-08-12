// Propiedades que el agente dio de alta EN EL DEMO, y las fotos que tomó.
//
// Vive en memoria del proceso, igual que las reservas simuladas del hotel (ver
// lib/hotel-reservas.ts): es estado de demostración, se reinicia solo y no
// ensucia la cartera sembrada. Si algún día tiene que sobrevivir a un reinicio
// o compartirse entre funciones serverless, el reemplazo es una tabla en la
// misma base que ya usa wa-store, no un archivo en disco.
//
// Anclado en globalThis a propósito: en dev cada ruta compila su propia
// instancia del módulo, y un arreglo a nivel de módulo NO se comparte entre la
// ruta que guarda la propiedad y la que sirve sus fotos.

import { LEADS, PROPIEDADES } from "./inmobiliaria-datos";
import { construirCartera, resolverPropiedad } from "./inmobiliaria-cartera";
import { construirPipeline, hoyEnSv } from "./inmobiliaria-pipeline";
import { construirAgenda, type Agenda } from "./inmobiliaria-visitas";
import type {
  Cartera,
  Foto,
  LeadSemilla,
  Pipeline,
  Propiedad,
  PropiedadSemilla,
  VisitaAgendada,
} from "./inmobiliaria-tipos";

interface FotoGuardada {
  id: string;
  tipoMime: string;
  bytes: Buffer;
  ancho: number;
  alto: number;
}

// Un anuncio que ya salió (o que salió en simulado porque el cliente todavía no
// conectó su página de Meta). Sirve para que la pantalla diga qué se publicó y
// cuándo, sin inventarlo.
export interface Publicacion {
  id: string;
  propiedadId: string;
  codigo: string;
  red: "facebook" | "simulada";
  cuando: string; // ISO 8601
  fotos: number;
  enlace?: string;
}

interface Almacen {
  propiedades: PropiedadSemilla[];
  fotos: Map<string, FotoGuardada>;
  publicaciones: Publicacion[];
  // Visitas agendadas en el demo, por lead. No es una lista paralela de citas:
  // es el mismo lead con su etapa movida a "visita" y su día y hora puestos.
  visitas: Map<string, VisitaAgendada>;
}

const g = globalThis as unknown as { __inmoAlmacen?: Almacen };
const almacen: Almacen = (g.__inmoAlmacen ??= {
  propiedades: [],
  fotos: new Map(),
  publicaciones: [],
  visitas: new Map(),
});

// Topes del demo. No es una nube: si alguien se pone a cargar cien casas con
// veinte fotos cada una, la memoria del proceso se va al techo.
const MAX_PROPIEDADES = 30;
const MAX_FOTOS = 200;
export const MAX_BYTES_FOTO = 3_500_000; // ~3.5 MB ya reducida en el teléfono

function nuevoId(prefijo: string): string {
  return `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Fotos ──

// Guarda una foto que llegó como data URL desde el teléfono y devuelve la ruta
// con la que se va a servir. El navegador ya la redujo; aquí solo se valida.
export function guardarFoto(dataUrl: string, ancho: number, alto: number): { id: string; src: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? "");
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_BYTES_FOTO) return null;

  const id = nuevoId("f");
  almacen.fotos.set(id, { id, tipoMime: m[1], bytes, ancho, alto });
  // FIFO: la más vieja se cae cuando se llena.
  while (almacen.fotos.size > MAX_FOTOS) {
    const primera = almacen.fotos.keys().next().value;
    if (primera === undefined) break;
    almacen.fotos.delete(primera);
  }
  return { id, src: `/api/inmobiliaria/foto/${id}` };
}

export function leerFoto(id: string): FotoGuardada | null {
  return almacen.fotos.get(id) ?? null;
}

// ── Propiedades ──

export function propiedadesDelDemo(): PropiedadSemilla[] {
  return [...almacen.propiedades];
}

// Semillas + lo que se dio de alta hoy. Lo nuevo va PRIMERO: el agente acaba de
// cargarlo y quiere verlo, no buscarlo al final de la lista.
export function todasLasPropiedades(): PropiedadSemilla[] {
  return [...almacen.propiedades, ...PROPIEDADES];
}

export function agregarPropiedad(semilla: PropiedadSemilla): PropiedadSemilla {
  almacen.propiedades.unshift(semilla);
  if (almacen.propiedades.length > MAX_PROPIEDADES) almacen.propiedades.length = MAX_PROPIEDADES;
  return semilla;
}

// Marca que el anuncio de verdad salió. Solo aplica a lo que se dio de alta en
// el demo: la cartera sembrada no se toca.
export function marcarPublicada(id: string, publicada = true): PropiedadSemilla | null {
  const p = almacen.propiedades.find((x) => x.id === id);
  if (!p) return null;
  p.publicada = publicada;
  return p;
}

export function registrarPublicacion(p: Omit<Publicacion, "id" | "cuando">): Publicacion {
  const pub: Publicacion = { ...p, id: nuevoId("pub"), cuando: new Date().toISOString() };
  almacen.publicaciones.unshift(pub);
  if (almacen.publicaciones.length > 50) almacen.publicaciones.length = 50;
  return pub;
}

export function publicaciones(propiedadId?: string): Publicacion[] {
  return almacen.publicaciones.filter((p) => !propiedadId || p.propiedadId === propiedadId);
}

export function limpiarDemo(): void {
  almacen.propiedades.length = 0;
  almacen.fotos.clear();
  almacen.publicaciones.length = 0;
  almacen.visitas.clear();
}

// ── Visitas ──

// Agendar mueve al lead a la etapa "visita agendada". No se crea una cita en
// otra lista: si el pipeline y el calendario no salieran del mismo lead, uno de
// los dos empezaría a mentir.
export function agendarVisita(leadId: string, visita: VisitaAgendada): LeadSemilla | null {
  const lead = LEADS.find((l) => l.id === leadId);
  if (!lead) return null;
  almacen.visitas.set(leadId, visita);
  return leadsVivos().find((l) => l.id === leadId) ?? null;
}

export function cancelarVisita(leadId: string): void {
  almacen.visitas.delete(leadId);
}

// Los leads como están HOY en el demo: las semillas, con la visita agendada
// encima si alguien la agendó desde la ficha.
export function leadsVivos(): LeadSemilla[] {
  return LEADS.map((l) => {
    const visita = almacen.visitas.get(l.id);
    return visita ? { ...l, etapa: "visita" as const, visita } : l;
  });
}

// ── Vistas que sirven las rutas ──

export function cargarCartera(hoy = hoyEnSv()): Cartera {
  return construirCartera({ propiedades: todasLasPropiedades(), leads: leadsVivos(), hoy });
}

export function buscarPropiedad(id: string, hoy = hoyEnSv()): Propiedad | null {
  const semilla = todasLasPropiedades().find(
    (p) => p.id === id || p.codigo.toLowerCase() === id.toLowerCase(),
  );
  return semilla ? resolverPropiedad(semilla, hoy, leadsVivos()) : null;
}

export function cargarPipeline(hoy = hoyEnSv()): Pipeline {
  return construirPipeline({ leads: leadsVivos(), hoy });
}

export function cargarAgenda(hoy = hoyEnSv()): Agenda {
  return construirAgenda({ leads: leadsVivos(), propiedades: todasLasPropiedades(), hoy });
}

// Fotos de la propiedad, tal como se guardaron.
export function fotosDe(id: string): Foto[] {
  return todasLasPropiedades().find((p) => p.id === id)?.fotos ?? [];
}
