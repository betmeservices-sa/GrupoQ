// Ficha del contacto (nombre, apellido, correo, tags, notas) y archivos adjuntos.
// La IA la actualiza cuando el cliente da sus datos o muestra interés; la pestaña
// Contactos la lista, crea y filtra por tag. Persiste en la tabla wa_contacts.
import { getSupabase } from "./supabase";

export interface Contacto {
  wa_from: string;
  nombre?: string | null;
  apellido?: string | null;
  correo?: string | null;
  notas?: string | null;
  tags?: string[] | null;
  tenant?: string | null;
}

const COLS = "wa_from, nombre, apellido, correo, notas, tags, tenant";
const memContactos = new Map<string, Contacto>();

function unirTags(prev: string[] | null | undefined, add: string[] | undefined): string[] {
  const set = new Set([...(prev ?? []), ...(add ?? [])].map((t) => t.trim()).filter(Boolean));
  return [...set];
}

// Actualiza/crea la ficha. Solo toca los campos provistos. Los `tags` se UNEN a
// los existentes (no se pierden los que puso el staff) salvo que replaceTags sea
// true (edición manual desde la pestaña Contactos).
export async function upsertContacto(c: {
  from: string;
  nombre?: string;
  apellido?: string;
  correo?: string;
  notas?: string;
  tags?: string[];
  tenant?: string;
  replaceTags?: boolean;
}): Promise<Contacto | null> {
  const from = c.from?.trim();
  if (!from) return null;
  const nombre = c.nombre?.trim();
  const apellido = c.apellido?.trim();
  const correo = c.correo?.trim();
  const notas = c.notas?.trim();
  const tags = c.tags?.map((t) => t.trim()).filter(Boolean);

  const sb = getSupabase();
  if (!sb) {
    const prev = memContactos.get(from) ?? { wa_from: from };
    const next: Contacto = {
      ...prev,
      ...(nombre ? { nombre } : {}),
      ...(apellido ? { apellido } : {}),
      ...(correo ? { correo } : {}),
      ...(notas ? { notas } : {}),
      ...(c.tenant ? { tenant: c.tenant } : {}),
      ...(tags ? { tags: c.replaceTags ? tags : unirTags(prev.tags, tags) } : {}),
    };
    memContactos.set(from, next);
    return next;
  }

  // Para unir tags sin perder los actuales, los leemos primero.
  let tagsFinal = tags;
  if (tags && !c.replaceTags) {
    const { data } = await sb.from("wa_contacts").select("tags").eq("wa_from", from).maybeSingle();
    tagsFinal = unirTags((data as { tags?: string[] } | null)?.tags, tags);
  }

  const patch: Record<string, unknown> = { wa_from: from, updated_at: new Date().toISOString() };
  if (nombre) patch.nombre = nombre;
  if (apellido) patch.apellido = apellido;
  if (correo) patch.correo = correo;
  if (notas) patch.notas = notas;
  if (c.tenant) patch.tenant = c.tenant;
  if (tagsFinal) patch.tags = tagsFinal;

  const { data, error } = await sb
    .from("wa_contacts")
    .upsert(patch, { onConflict: "wa_from" })
    .select(COLS)
    .maybeSingle();
  if (error) {
    console.error("wa_contacts upsert:", error.message);
    return null;
  }
  return (data as Contacto | null) ?? null;
}

export async function getContacto(from: string): Promise<Contacto | null> {
  const sb = getSupabase();
  if (!sb) return memContactos.get(from) ?? null;
  const { data, error } = await sb
    .from("wa_contacts")
    .select(COLS)
    .eq("wa_from", from)
    .maybeSingle();
  if (error) {
    console.error("wa_contacts select:", error.message);
    return null;
  }
  return (data as Contacto | null) ?? null;
}

// --- Siembra de la pestaña Contactos en modo demo ---
//
// Sin Supabase, `wa_contacts` arranca vacío y la pestaña Contactos se ve en
// blanco hasta que alguien escriba por WhatsApp. En un demo eso es una pantalla
// muerta justo cuando la están enseñando. Así que la primera vez que se pide la
// lista de un cliente, se copian los contactos de su seed.
//
// Solo aplica en memoria: con Supabase configurado manda la base y esto no
// corre, porque ahí los contactos son de gente real.
const sembrados = new Set<string>();

async function sembrarDesdeSeed(tenant: string): Promise<void> {
  if (sembrados.has(tenant)) return;
  sembrados.add(tenant);

  const { TENANTS, isTenantId } = await import("./tenants");
  if (!isTenantId(tenant)) return;

  for (const c of TENANTS[tenant].seed.contacts) {
    // La ficha se identifica por teléfono. Los contactos que solo tienen
    // handle de Instagram o Facebook no entran: no hay con qué llavearlos, y
    // meterlos con un id falso los dejaría sin poder abrirse.
    const from = (c.telefono ?? "").replace(/\D/g, "");
    if (from.length < 8 || memContactos.has(from)) continue;

    const partes = c.nombre.trim().split(/\s+/);
    memContactos.set(from, {
      wa_from: from,
      nombre: partes[0] ?? c.nombre,
      apellido: partes.slice(1).join(" ") || null,
      correo: c.correo ?? null,
      notas: c.notas ?? null,
      tags: c.tags ?? [],
      tenant,
    });
  }
}

// Lista los contactos de un tenant (para la pestaña Contactos).
export async function listContactos(tenant?: string): Promise<Contacto[]> {
  const sb = getSupabase();
  if (!sb) {
    if (tenant) await sembrarDesdeSeed(tenant);
    return [...memContactos.values()].filter((c) => !tenant || c.tenant === tenant);
  }
  let q = sb.from("wa_contacts").select(COLS).order("updated_at", { ascending: false });
  if (tenant) q = q.eq("tenant", tenant);
  const { data, error } = await q;
  if (error) {
    console.error("wa_contacts list:", error.message);
    return [];
  }
  return (data as Contacto[]) ?? [];
}

// Registra un archivo recibido en la ficha del contacto.
export async function addAdjunto(a: {
  from: string;
  tipo: string;
  mediaId?: string;
  mime?: string;
  filename?: string;
  caption?: string;
  ts: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("wa_adjuntos").insert({
    wa_from: a.from,
    tipo: a.tipo,
    media_id: a.mediaId ?? null,
    mime: a.mime ?? null,
    filename: a.filename ?? null,
    caption: a.caption ?? null,
    ts: a.ts,
  });
  if (error) console.error("wa_adjuntos insert:", error.message);
}
