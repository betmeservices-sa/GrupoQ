// Los apartados de Sofía: verlos y confirmarlos o rechazarlos.
//
// GET  ?clave=...  → los apartados de esa conversación (o los últimos del tenant)
// POST { id, accion: "confirmar" | "rechazar", motivo? }
//
// Confirmar mete la reserva al sistema y le avisa al huésped por el mismo
// canal, firmado por quien confirmó.

import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { quienResponde } from "@/lib/staff-de-sesion";
import {
  confirmarPreReserva,
  listarPreReservas,
  rechazarPreReserva,
  textoReservaConfirmada,
  type PreReserva,
} from "@/lib/yali-prereservas";
import { partesDeClave } from "@/lib/meta-conversaciones";
import { conexionesDe } from "@/lib/meta-store";
import { enviarYGuardarMeta, type QuienResponde } from "@/lib/meta-enviar";
import { enviarTextoWa } from "@/lib/wa-send";
import { addOutbound } from "@/lib/wa-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const clave = new URL(req.url).searchParams.get("clave")?.trim() || undefined;
  try {
    return NextResponse.json({ ok: true, reservas: await listarPreReservas(tenant, clave) });
  } catch (e) {
    console.error("yali/prereservas GET:", e);
    return NextResponse.json({ ok: false, error: "No se pudieron leer los apartados." });
  }
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { id?: string; accion?: string; motivo?: string };
  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Falta el apartado." }, { status: 400 });
  const quien = await quienResponde(req, tenant);
  try {
    if (body.accion === "rechazar") {
      const r = await rechazarPreReserva(tenant, id, body.motivo ?? "", quien);
      return NextResponse.json(r);
    }
    const r = await confirmarPreReserva(tenant, id, quien);
    if (!r.ok || !r.reserva) return NextResponse.json(r);
    const aviso = await avisarAlHuesped(tenant, r.reserva, quien);
    return NextResponse.json({ ...r, avisado: aviso.ok, avisoError: aviso.error });
  } catch (e) {
    console.error("yali/prereservas POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar el apartado." });
  }
}

/** El mensaje de confirmación por el canal en que escribió el huésped. */
async function avisarAlHuesped(
  tenant: string,
  p: PreReserva,
  quien: QuienResponde,
): Promise<{ ok: boolean; error?: string }> {
  const texto = textoReservaConfirmada(p);
  try {
    if (p.clave.startsWith("wa:")) {
      const to = p.clave.slice(3);
      const env = await enviarTextoWa(to, texto);
      if (!env.ok || !env.id) return { ok: false, error: env.error };
      await addOutbound({ waId: env.id, to, texto, ts: new Date().toISOString(), tenant });
      return { ok: true };
    }
    const partes = partesDeClave(p.clave);
    if (!partes) return { ok: false, error: "conversación desconocida" };
    const cx = (await conexionesDe(tenant)).find((c) => c.pageId === partes.pageId);
    if (!cx) return { ok: false, error: "la página ya no está conectada" };
    await enviarYGuardarMeta(cx, partes.canal, partes.senderId, texto, quien);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "falló el envío" };
  }
}
