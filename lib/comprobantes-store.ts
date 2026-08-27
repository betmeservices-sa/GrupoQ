// Guardar y servir los comprobantes de pago.
//
// La foto se baja del enlace temporal de Meta en el momento en que llega y
// se guarda entera (base64) en la tabla comprobantes. A partir de ahí vive en
// /api/comprobantes/<id>: se abre en el panel, no caduca y no descarga.

import { getSupabase } from "./supabase";

const ESPERA_MS = 15_000;
const MAX_BYTES = 8 * 1024 * 1024;

export interface ComprobanteGuardado {
  id: string;
  tenant: string;
  apartadoId: string | null;
  clave: string | null;
  mime: string;
  nombre: string;
  datosB64: string;
  creada: string;
}

const mem = new Map<string, ComprobanteGuardado>();

export function rutaDeComprobante(id: string): string {
  return `/api/comprobantes/${id}`;
}

function extensionDe(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("pdf")) return "pdf";
  return "jpg";
}

/** Baja la foto del enlace y la deja guardada. null si no se pudo (el enlace venció, no es imagen, muy grande). */
export async function guardarComprobanteDesdeUrl(
  tenant: string,
  datos: { apartadoId: string; clave: string; url: string },
): Promise<{ id: string; ruta: string; mime: string; nombre: string } | null> {
  let res: Response;
  try {
    res = await fetch(datos.url, { cache: "no-store", signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (e) {
    console.error("[comprobantes] no se pudo bajar:", e instanceof Error ? e.message : e);
    return null;
  }
  if (!res.ok) {
    console.error("[comprobantes] Meta respondió", res.status);
    return null;
  }
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim() || "image/jpeg";
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    console.error("[comprobantes] no es imagen:", mime);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
    console.error("[comprobantes] tamaño fuera de rango:", buf.byteLength);
    return null;
  }
  const id = `c_${datos.apartadoId.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`;
  const nombre = `comprobante-${datos.apartadoId}.${extensionDe(mime)}`;
  const fila: ComprobanteGuardado = {
    id,
    tenant,
    apartadoId: datos.apartadoId,
    clave: datos.clave,
    mime,
    nombre,
    datosB64: buf.toString("base64"),
    creada: new Date().toISOString(),
  };
  const sb = getSupabase();
  if (!sb) {
    mem.set(id, fila);
  } else {
    const { error } = await sb.from("comprobantes").insert({
      id: fila.id,
      tenant: fila.tenant,
      apartado_id: fila.apartadoId,
      clave: fila.clave,
      mime: fila.mime,
      nombre: fila.nombre,
      datos_b64: fila.datosB64,
      creada: fila.creada,
    });
    if (error) {
      console.error("[comprobantes] no se pudo guardar:", error.message);
      return null;
    }
  }
  return { id, ruta: rutaDeComprobante(id), mime, nombre };
}

export async function leerComprobante(tenant: string, id: string): Promise<{ mime: string; nombre: string; bytes: Buffer } | null> {
  const sb = getSupabase();
  if (!sb) {
    const f = mem.get(id);
    return f && f.tenant === tenant ? { mime: f.mime, nombre: f.nombre, bytes: Buffer.from(f.datosB64, "base64") } : null;
  }
  const { data, error } = await sb.from("comprobantes").select("mime, nombre, datos_b64").eq("tenant", tenant).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const f = data as { mime: string; nombre: string; datos_b64: string };
  return { mime: f.mime, nombre: f.nombre, bytes: Buffer.from(f.datos_b64, "base64") };
}
