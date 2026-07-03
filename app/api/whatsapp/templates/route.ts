import { NextResponse } from "next/server";
import {
  listarTemplates,
  crearTemplate,
  eliminarTemplate,
  type NuevoTemplate,
} from "@/lib/wa-templates";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: lista las plantillas de la WABA (o el seed demo del tenant si no hay
// credenciales). El tenant sale de la cookie que fijó el login.
export async function GET(req: Request) {
  const r = await listarTemplates(tenantFromRequest(req));
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, templates: r.templates, demo: r.demo });
}

// POST: crea una plantilla en Meta. Body = NuevoTemplate.
export async function POST(req: Request) {
  let body: NuevoTemplate;
  try {
    body = (await req.json()) as NuevoTemplate;
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  if (!body?.name || !body?.body || !body?.category || !body?.language) {
    return NextResponse.json(
      { ok: false, error: "Faltan campos obligatorios (name, body, category, language)." },
      { status: 400 },
    );
  }
  const r = await crearTemplate(body, tenantFromRequest(req));
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, template: r.template, demo: r.demo });
}

// DELETE: borra una plantilla por nombre. ?name=...
export async function DELETE(req: Request) {
  const name = new URL(req.url).searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Falta 'name'." }, { status: 400 });
  }
  const r = await eliminarTemplate(name, tenantFromRequest(req));
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, demo: r.demo });
}
