import { NextResponse } from "next/server";
import { listContactos, upsertContacto, type Contacto } from "@/lib/contacts-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DTO para la UI: expone `telefono` en vez de `wa_from`.
function aDTO(c: Contacto) {
  return {
    telefono: c.wa_from,
    nombre: c.nombre ?? "",
    apellido: c.apellido ?? "",
    correo: c.correo ?? "",
    notas: c.notas ?? "",
    tags: c.tags ?? [],
  };
}

// Lista los contactos del cliente activo (según cookie de tenant).
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const contactos = await listContactos(tenant);
  return NextResponse.json({ ok: true, contactos: contactos.map(aDTO) });
}

// Crea o actualiza un contacto manualmente desde la pestaña Contactos. Aquí los
// tags SÍ reemplazan (es edición explícita del staff).
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  let body: {
    telefono?: string;
    nombre?: string;
    apellido?: string;
    correo?: string;
    notas?: string;
    tags?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const telefono = (body.telefono ?? "").replace(/[^\d]/g, "");
  if (telefono.length < 8) {
    return NextResponse.json({ ok: false, error: "Teléfono inválido" }, { status: 400 });
  }

  const contacto = await upsertContacto({
    from: telefono,
    nombre: body.nombre,
    apellido: body.apellido,
    correo: body.correo,
    notas: body.notas,
    tags: Array.isArray(body.tags) ? body.tags : undefined,
    tenant: tenant ?? undefined,
    replaceTags: true,
  });

  return NextResponse.json({ ok: true, contacto: contacto ? aDTO(contacto) : null });
}
