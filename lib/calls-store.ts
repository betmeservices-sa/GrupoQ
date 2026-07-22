// Persistencia del historial de llamadas. Solo servidor.
// Si Supabase no esta configurado, todas las funciones degradan sin romper:
// haySupabase() es false y el route handler sirve directo de Vapi.
import { getSupabase } from "./supabase";
import type { CallCostBreakdown, CallDirection, CallRecord } from "./data/types";

interface FilaCall {
  id: string;
  direccion: string | null;
  numero_cliente: string | null;
  phone_number_id: string | null;
  numero_propio: string | null;
  nombre_numero: string | null;
  assistant_id: string | null;
  nombre_assistant: string | null;
  creada_en: string | null;
  contestada_en: string | null;
  terminada_en: string | null;
  duracion_seg: number | null;
  estado: string | null;
  motivo_fin: string | null;
  costo: number | string | null;
  costo_desglose: CallCostBreakdown | null;
  transcript: string | null;
  grabacion_url: string | null;
}

export function haySupabase(): boolean {
  return getSupabase() !== null;
}

function aFila(c: CallRecord): FilaCall {
  return {
    id: c.id,
    direccion: c.direccion,
    numero_cliente: c.numeroCliente ?? null,
    phone_number_id: c.phoneNumberId ?? null,
    numero_propio: c.numeroPropio ?? null,
    nombre_numero: c.nombreNumero ?? null,
    assistant_id: c.assistantId ?? null,
    nombre_assistant: c.nombreAssistant ?? null,
    creada_en: c.creada ?? null,
    contestada_en: c.inicio ?? null,
    terminada_en: c.fin ?? null,
    duracion_seg: c.duracionSeg,
    estado: c.estado ?? null,
    motivo_fin: c.estadoFinal ?? null,
    costo: c.costo,
    costo_desglose: c.costoDesglose ?? null,
    transcript: c.transcript ?? null,
    grabacion_url: c.grabacionUrl ?? null,
  };
}

function aRecord(f: FilaCall): CallRecord {
  return {
    id: f.id,
    direccion: (f.direccion ?? "web") as CallDirection,
    numeroCliente: f.numero_cliente ?? undefined,
    phoneNumberId: f.phone_number_id ?? undefined,
    numeroPropio: f.numero_propio ?? undefined,
    nombreNumero: f.nombre_numero ?? undefined,
    assistantId: f.assistant_id ?? undefined,
    nombreAssistant: f.nombre_assistant ?? undefined,
    creada: f.creada_en ?? undefined,
    inicio: f.contestada_en ?? undefined,
    fin: f.terminada_en ?? undefined,
    duracionSeg: f.duracion_seg ?? 0,
    estado: f.estado ?? undefined,
    estadoFinal: f.motivo_fin ?? undefined,
    // numeric de Postgres puede volver como string; normalizamos siempre.
    costo: typeof f.costo === "string" ? Number(f.costo) : (f.costo ?? 0),
    costoDesglose: f.costo_desglose ?? undefined,
    transcript: f.transcript ?? undefined,
    grabacionUrl: f.grabacion_url ?? undefined,
  };
}

// Upsert por id: reejecutar la sincronizacion es idempotente.
export async function guardarLlamadas(calls: CallRecord[]): Promise<number> {
  const sb = getSupabase();
  if (!sb || calls.length === 0) return 0;
  const filas = calls.map(aFila).map((f) => ({ ...f, sincronizada_en: new Date().toISOString() }));
  const { error } = await sb.from("calls").upsert(filas, { onConflict: "id" });
  if (error) throw new Error(`Supabase upsert fallo: ${error.message}`);
  return filas.length;
}

export async function leerLlamadas(limite = 500): Promise<CallRecord[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("calls")
    .select("*")
    .order("creada_en", { ascending: false, nullsFirst: false })
    .limit(limite);
  if (error) throw new Error(`Supabase select fallo: ${error.message}`);
  return ((data as FilaCall[]) ?? []).map(aRecord);
}
