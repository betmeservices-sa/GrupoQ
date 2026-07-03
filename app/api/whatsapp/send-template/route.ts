import { NextResponse } from "next/server";
import { addOutbound } from "@/lib/wa-store";
import { enviarPlantilla } from "@/lib/wa-send";
import { setChatOverride } from "@/lib/ai-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Envía una plantilla aprobada de WhatsApp.
// Body: { to, name, language, variables[], texto?, manual? }.
// `texto` es el cuerpo ya renderizado (para mostrarlo/guardarlo en el hilo).
export async function POST(req: Request) {
  let body: {
    to?: string;
    name?: string;
    language?: string;
    variables?: string[];
    texto?: string;
    manual?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const to = body.to?.trim();
  const name = body.name?.trim();
  const language = body.language?.trim() || "es";
  const variables = Array.isArray(body.variables) ? body.variables.map((v) => String(v)) : [];

  if (!to || !name) {
    return NextResponse.json({ ok: false, error: "Faltan 'to' o 'name'" }, { status: 400 });
  }
  if (!/^\d{8,15}$/.test(to)) {
    return NextResponse.json({ ok: false, error: "Numero invalido" }, { status: 400 });
  }

  // Enviar plantilla cuenta como tomar el chat: la IA se apaga en esta conversación.
  if (body.manual) await setChatOverride(to, false);

  const env = await enviarPlantilla(to, name, language, variables);
  if (!env.ok) {
    return NextResponse.json({ ok: false, error: env.error }, { status: 502 });
  }
  if (env.id) {
    const texto = body.texto?.trim() || `[plantilla: ${name}]`;
    await addOutbound({ waId: env.id, to, texto, ts: new Date().toISOString(), tenant: tenantFromRequest(req) });
  }
  return NextResponse.json({ ok: true, id: env.id });
}
