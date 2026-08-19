import { NextResponse } from "next/server";
import { TENANTS } from "@/lib/tenants";
import { destinoWhatsApp, enlacePorCodigo } from "@/lib/enlaces";
import { registrarClic } from "@/lib/clics-store";
import type { TenantId } from "@/lib/tenants/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El link que va en la bio de cada perfil. Es PÚBLICO a propósito: lo toca un
// huésped que no tiene sesión en el panel.
//
// Registra el clic con sus UTMs y manda a WhatsApp con el mensaje escrito. Es
// el eslabón que un `wa.me` pelado no tiene: sin este paso intermedio, nadie
// sabe cuánta gente tocó el link ni de qué campaña venía.
//
// Si algo falla al registrar, se redirige IGUAL: perder una métrica es
// molesto, perder al huésped no es opción.

// Hoy los links son de Yali. Cuando otro cliente los use, este mapa crece (o se
// mueve el código a la config del tenant).
const TENANT_DE_LOS_LINKS: TenantId = "yaly";

export async function GET(req: Request, ctx: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await ctx.params;
  const cfg = TENANTS[TENANT_DE_LOS_LINKS];
  const enlace = enlacePorCodigo(codigo, cfg.sucursales);
  const numero = cfg.whatsapp?.numeroPublico;

  // Un código que no existe no manda a nadie a un WhatsApp cualquiera.
  if (!enlace || !numero) {
    return NextResponse.json({ ok: false, error: "Link no válido" }, { status: 404 });
  }

  const url = new URL(req.url);
  try {
    await registrarClic({
      tenant: TENANT_DE_LOS_LINKS,
      codigo: enlace.codigo,
      utm_source: url.searchParams.get("utm_source") ?? enlace.utm.source,
      utm_medium: url.searchParams.get("utm_medium") ?? enlace.utm.medium,
      utm_campaign: url.searchParams.get("utm_campaign") ?? enlace.utm.campaign,
      referer: req.headers.get("referer"),
      ts: new Date().toISOString(),
    });
  } catch (e) {
    console.error("registrar clic:", e);
  }

  // 302 y sin caché: si un intermediario lo cacheara, dejaríamos de contar.
  return NextResponse.redirect(destinoWhatsApp(numero, enlace), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
