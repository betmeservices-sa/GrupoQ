import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  claveMeta,
  listarConversacionesMeta,
  partesDeClave,
  upsertConversacionMeta,
} from "@/lib/meta-conversaciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado de las conversaciones de Messenger e Instagram del cliente:
// asignación, estado y departamento. Mismo contrato que /api/wa/conversaciones.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const conversaciones = (await listarConversacionesMeta(tenant)).map((c) => ({
    id: `metac-${c.canal}-${c.pageId}-${c.senderId}`,
    asignado_a: c.asignadoA,
    estado: c.estado,
    departamento: c.departamento,
  }));
  return NextResponse.json({ conversaciones });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const p = partesDeClave(id);
  if (!p) return NextResponse.json({ ok: false, error: "Falta 'id' (metac-...)" }, { status: 400 });

  const patch: { asignadoA?: string | null; estado?: string; departamento?: string } = {};
  if ("asignado_a" in body) {
    const v = body.asignado_a;
    patch.asignadoA = v === null ? null : typeof v === "string" ? v : undefined;
  }
  if (typeof body.estado === "string") {
    if (!["nuevo", "en_progreso", "resuelto"].includes(body.estado)) {
      return NextResponse.json({ ok: false, error: "Estado inválido" }, { status: 400 });
    }
    patch.estado = body.estado;
  }
  if (typeof body.departamento === "string" && body.departamento) patch.departamento = body.departamento;

  const tenant = tenantFromRequest(req);
  try {
    await upsertConversacionMeta(tenant, claveMeta(p.canal, p.pageId, p.senderId), patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No se pudo." }, { status: 500 });
  }
}
