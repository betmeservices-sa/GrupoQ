// El número de WhatsApp de cada cliente, guardado.
//
// Mismo patrón que meta-store (las páginas de Facebook): Supabase en el esquema
// del cliente, y memoria como respaldo para dev local. Tabla: wa_connections.
//
// El webhook no sabe de qué cliente es un mensaje hasta mirar el número al que
// llegó (phone_number_id). Por eso `conexionPorPhoneNumberId` busca en todos
// los esquemas: averiguarlo es el motivo de la consulta.

import { getSupabase, todosLosClientes } from "./supabase";

export interface WaConnection {
  tenant: string;
  wabaId: string;
  phoneNumberId: string;
  /** Como lo ve la gente: "+503 7020 0301". */
  displayPhone: string | null;
  /** El nombre verificado del negocio en WhatsApp. */
  verifiedName: string | null;
  /** Token del negocio del cliente. Nunca sale al navegador. */
  accessToken: string;
  /** PIN de registro del número en la Cloud API. */
  pin?: string | null;
  connectedAt?: string;
}

const g = globalThis as unknown as { __waConexiones?: Map<string, WaConnection[]> };
const memoria: Map<string, WaConnection[]> = (g.__waConexiones ??= new Map());

const COLUMNAS =
  "tenant,waba_id,phone_number_id,display_phone,verified_name,access_token,pin,connected_at";

function deFila(r: Record<string, unknown>): WaConnection {
  return {
    tenant: r.tenant as string,
    wabaId: r.waba_id as string,
    phoneNumberId: r.phone_number_id as string,
    displayPhone: (r.display_phone as string | null) ?? null,
    verifiedName: (r.verified_name as string | null) ?? null,
    accessToken: r.access_token as string,
    pin: (r.pin as string | null) ?? null,
    connectedAt: (r.connected_at as string | null) ?? undefined,
  };
}

/** Guarda o actualiza un número. No lanza: si la base falla, queda en memoria. */
export async function guardarConexionWa(cx: WaConnection): Promise<"db" | "memoria"> {
  const previas = memoria.get(cx.tenant) ?? [];
  memoria.set(cx.tenant, [...previas.filter((p) => p.phoneNumberId !== cx.phoneNumberId), cx]);

  const sb = getSupabase(cx.tenant);
  if (!sb) return "memoria";
  const { error } = await sb.from("wa_connections").upsert(
    {
      tenant: cx.tenant,
      waba_id: cx.wabaId,
      phone_number_id: cx.phoneNumberId,
      display_phone: cx.displayPhone,
      verified_name: cx.verifiedName,
      access_token: cx.accessToken,
      pin: cx.pin ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "phone_number_id" },
  );
  if (error) {
    console.error("[wa-conexiones] upsert falló:", error.message);
    return "memoria";
  }
  return "db";
}

export async function conexionesWaDe(tenant: string): Promise<WaConnection[]> {
  const sb = getSupabase(tenant);
  if (sb) {
    const { data, error } = await sb.from("wa_connections").select(COLUMNAS).eq("tenant", tenant);
    if (!error) return ((data ?? []) as unknown as Record<string, unknown>[]).map(deFila);
    // La tabla puede no existir todavía: se cae a memoria sin ruido.
    if (!/wa_connections/.test(error.message)) console.error("[wa-conexiones] leer:", error.message);
  }
  return memoria.get(tenant) ?? [];
}

/** De quién es el número al que llegó un mensaje. Busca en todos los esquemas. */
export async function conexionPorPhoneNumberId(phoneNumberId: string): Promise<WaConnection | null> {
  if (!phoneNumberId) return null;
  for (const sb of todosLosClientes()) {
    const { data, error } = await sb
      .from("wa_connections")
      .select(COLUMNAS)
      .eq("phone_number_id", phoneNumberId)
      .limit(1);
    if (!error && data && data.length) return deFila(data[0] as unknown as Record<string, unknown>);
  }
  for (const lista of memoria.values()) {
    const hit = lista.find((c) => c.phoneNumberId === phoneNumberId);
    if (hit) return hit;
  }
  return null;
}

export async function borrarConexionWa(tenant: string, phoneNumberId: string): Promise<void> {
  memoria.set(tenant, (memoria.get(tenant) ?? []).filter((c) => c.phoneNumberId !== phoneNumberId));
  const sb = getSupabase(tenant);
  if (!sb) return;
  const { error } = await sb
    .from("wa_connections")
    .delete()
    .eq("tenant", tenant)
    .eq("phone_number_id", phoneNumberId);
  if (error) console.error("[wa-conexiones] borrar:", error.message);
}

/** Para las pruebas. */
export function olvidarConexionesWa(): void {
  memoria.clear();
}
