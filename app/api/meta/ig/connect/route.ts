import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { crearStateIg, hayLoginIg, redirectUriIg, urlLoginIg } from "@/lib/meta-ig-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/ig/connect: la cuenta de Instagram entra con SU usuario de
// Instagram (no con Facebook). Mismo esquema anti-CSRF que /api/meta/connect:
// state firmado con el tenant + la misma cookie exigida en el callback.
export async function GET(req: Request) {
  if (!hayLoginIg()) {
    return NextResponse.redirect(new URL("/settings?meta=error&motivo=ig-sin-config", req.url));
  }
  const tenant = tenantFromRequest(req);
  const state = crearStateIg(tenant);
  const res = NextResponse.redirect(urlLoginIg(state, redirectUriIg(req.url)));

  const host = new URL(req.url).hostname;
  res.cookies.set("meta_ig_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: host !== "localhost",
    maxAge: 600,
    path: "/",
    ...(host.endsWith("miagentia.com") ? { domain: ".miagentia.com" } : {}),
  });
  return res;
}
