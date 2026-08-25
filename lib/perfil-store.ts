// Solicitudes de cambio al perfil del agente.
//
// Editar el perfil NO reescribe el guion en vivo, y es a propósito: el guion
// tiene barandas de seguridad y de estilo que un cambio suelto podría romper
// sin que nadie se entere hasta que un huésped reciba una respuesta rara. Lo
// que hace el botón es dejar la solicitud registrada con un número de gestión;
// el equipo la aplica y responde por ese número.
//
// Persistencia igual que el resto del demo: tabla en Supabase si hay env y la
// tabla existe, y si no, memoria del proceso.

import { getSupabase } from "./supabase";
import { latchDeTabla, tablaFaltante } from "./tabla-faltante";
import type { CampoPerfilId } from "./perfil-agente";

export interface SolicitudPerfil {
  numero: string; // el número de gestión que se le muestra al hotel
  tenant: string;
  campo: CampoPerfilId;
  texto: string; // lo que el hotel quiere que diga
  estado: "recibida" | "aplicada";
  creada: string; // ISO 8601
}

const COLS = "numero, tenant, campo, texto, estado, creada";
const mem: SolicitudPerfil[] = [];
// Se apaga sola a los minutos (ver latchDeTabla): correr la migración alcanza.
const faltaTabla = latchDeTabla();

function guardarEnMemoria(s: SolicitudPerfil): SolicitudPerfil {
  mem.unshift(s);
  if (mem.length > 100) mem.length = 100;
  return s;
}

export async function crearSolicitud(
  s: Omit<SolicitudPerfil, "creada" | "estado">,
): Promise<SolicitudPerfil> {
  const solicitud: SolicitudPerfil = { ...s, estado: "recibida", creada: new Date().toISOString() };
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) return guardarEnMemoria(solicitud);

  const { data, error } = await sb
    .from("perfil_solicitudes")
    .insert(solicitud)
    .select(COLS)
    .single();
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      return guardarEnMemoria(solicitud);
    }
    throw new Error(error.message);
  }
  return data as SolicitudPerfil;
}

export async function listarSolicitudes(tenant: string): Promise<SolicitudPerfil[]> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) return mem.filter((s) => s.tenant === tenant);

  const { data, error } = await sb
    .from("perfil_solicitudes")
    .select(COLS)
    .eq("tenant", tenant)
    .order("creada", { ascending: false })
    .limit(50);
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      return mem.filter((s) => s.tenant === tenant);
    }
    throw new Error(error.message);
  }
  return (data ?? []) as SolicitudPerfil[];
}
