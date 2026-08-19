import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { campoPerfil, numeroDeGestion, perfilDeTenant } from "@/lib/perfil-agente";
import { crearSolicitud, listarSolicitudes } from "@/lib/perfil-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Perfil resumido del agente + las solicitudes de cambio que dejó el cliente.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const campos = perfilDeTenant(tenant);
  if (campos.length === 0) {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, campos, solicitudes: await listarSolicitudes(tenant) });
  } catch (e) {
    console.error("perfil GET:", e);
    return NextResponse.json({ ok: true, campos, solicitudes: [] });
  }
}

// Deja registrada una solicitud de cambio y devuelve su número de gestión. NO
// reescribe el guion: ver la cabecera de lib/perfil-store.ts.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as { campo?: string; texto?: string };
  const campo = campoPerfil(tenant, body.campo ?? "");
  const texto = (body.texto ?? "").trim();
  if (!campo) {
    return NextResponse.json({ ok: false, error: "Ese campo no existe." }, { status: 400 });
  }
  if (!texto) {
    return NextResponse.json({ ok: false, error: "El texto no puede quedar vacío." }, { status: 400 });
  }
  const numero = numeroDeGestion();
  try {
    const solicitud = await crearSolicitud({ numero, tenant, campo: campo.id, texto });
    return NextResponse.json({ ok: true, solicitud });
  } catch (e) {
    console.error("perfil POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo registrar el cambio." });
  }
}
