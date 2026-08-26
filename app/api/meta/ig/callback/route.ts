import { NextResponse } from "next/server";
import {
  intercambiarCodigoIg,
  perfilIg,
  redirectUriIg,
  suscribirIg,
  tokenLargoIg,
  validarStateIg,
} from "@/lib/meta-ig-login";
import { guardarLoginIg } from "@/lib/meta-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vuelta del login de Instagram: código → token corto → token largo (60 días)
// → id y usuario de la cuenta → suscripción a los webhooks → guardar.
//
// Todo el flujo termina en /settings con ?meta=... para que la pantalla diga
// qué pasó. Los errores de Meta se pasan tal cual: "no tenés rol de tester"
// le dice a la persona qué hacer, y un genérico no.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state");

  const volver = (params: string) => {
    const res = NextResponse.redirect(new URL(`/settings?${params}`, req.url));
    res.cookies.set("meta_ig_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  if (url.searchParams.get("error")) {
    const motivo = url.searchParams.get("error_description") ?? url.searchParams.get("error_reason") ?? "cancelado";
    return volver(`meta=error&motivo=${encodeURIComponent(motivo)}`);
  }

  const v = validarStateIg(state);
  const cookieState = req.headers.get("cookie")?.match(/(?:^|;\s*)meta_ig_state=([^;]+)/)?.[1];
  if (!v.ok || !cookieState || decodeURIComponent(cookieState) !== state) {
    return volver("meta=error&motivo=state");
  }

  const code = url.searchParams.get("code");
  if (!code) return volver("meta=error&motivo=sin-codigo");

  try {
    const corto = await intercambiarCodigoIg(code, redirectUriIg(req.url));
    const largo = await tokenLargoIg(corto.token);
    const perfil = await perfilIg(largo.token);
    const campos = await suscribirIg(perfil.igId, largo.token);
    const donde = await guardarLoginIg(v.tenant, {
      igId: perfil.igId,
      igUsername: perfil.username,
      igToken: largo.token,
      igTokenVence: largo.vence,
    });
    console.log(
      `[ig-login] tenant=${v.tenant} conectó @${perfil.username ?? perfil.igId} (${perfil.igId}); webhooks: ${campos ?? "NO"}; guardado en ${donde}`,
    );
    const p = new URLSearchParams({
      meta: "ig-conectado",
      cuenta: perfil.username ?? perfil.igId,
      ...(campos ? {} : { aviso: "sin-webhooks" }),
    });
    return volver(p.toString());
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "desconocido";
    console.error("[ig-login] callback falló:", motivo);
    return volver(`meta=error&motivo=${encodeURIComponent(motivo)}`);
  }
}
