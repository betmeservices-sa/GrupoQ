import { NextResponse } from "next/server";
import { bloquearNumeroWa } from "@/lib/wa-send";
import { borrarConversacionCompleta } from "@/lib/wa-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Borrar y bloquear" una conversación de WhatsApp: bloquea el número (deja de
// escribir) y borra todo su historial de la base. Solo lo llama la UI para
// gerentes/jefes/dirección; el gating de rol vive en el cliente.
export async function POST(req: Request) {
  let body: { from?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const from = (body.from ?? "").replace(/\D/g, "");
  if (from.length < 6) {
    return NextResponse.json({ ok: false, error: "Número inválido" }, { status: 400 });
  }

  // 1. Bloquear en WhatsApp (que no vuelva a escribir).
  const bloqueo = await bloquearNumeroWa(from);
  // 2. Borrar toda la conversación de la base (aunque el bloqueo falle).
  await borrarConversacionCompleta(from);

  return NextResponse.json({ ok: true, bloqueado: bloqueo.ok, error: bloqueo.error });
}
