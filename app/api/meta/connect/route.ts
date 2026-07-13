import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { crearState, redirectUri, urlDialogoOAuth } from "@/lib/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/connect: inicia la conexión OAuth del tenant logueado.
// El botón "Conectar Facebook e Instagram" de cada dashboard apunta aquí; esta
// ruta arma el state firmado con el tenant y redirige al diálogo de Meta. El
// callback (URL fija, una para todos) hace el resto.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const state = crearState(tenant);
  const res = NextResponse.redirect(urlDialogoOAuth(state, redirectUri(req.url)));

  // Doble validación anti-CSRF: el callback exige que este mismo state llegue
  // también en cookie. Dominio compartido para que la cookie viaje entre
  // subdominios (demo. / conectar. / <empresa>.miagentia.com).
  const host = new URL(req.url).hostname;
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: host !== "localhost",
    maxAge: 600,
    path: "/",
    ...(host.endsWith("miagentia.com") ? { domain: ".miagentia.com" } : {}),
  });
  return res;
}
