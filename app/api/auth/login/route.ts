import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { validarCredenciales } from "@/lib/auth-server";
import { cookieDeSesion, crearSesion } from "@/lib/session";
import { dosFactorHabilitado, verificarTotp, otpauthUri } from "@/lib/totp";
import { obtenerOCrear2FA, marcarEnrolado2FA } from "@/lib/totp-store";

export const dynamic = "force-dynamic";

async function qrDataUrl(usuario: string, secret: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri(usuario, secret), { width: 240, margin: 1 });
}

// Login REAL: las credenciales se validan en el servidor y la sesion sale como
// cookie HttpOnly firmada. Con 2FA por app (TOTP_2FA=on), la primera vez de cada
// usuario se le devuelve un QR para enrolar su app; despues solo se le pide el
// codigo. El flujo es stateless: la UI reenvia usuario+password+token.
export async function POST(req: Request) {
  let usuario = "";
  let password = "";
  let token = "";
  try {
    const body = (await req.json()) as {
      usuario?: string;
      password?: string;
      token?: string;
    };
    usuario = body.usuario ?? "";
    password = body.password ?? "";
    token = body.token ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo invalido" }, { status: 400 });
  }

  const tenant = validarCredenciales(usuario, password);
  if (!tenant) {
    // Mensaje generico a proposito: no revelamos si el usuario existe.
    return NextResponse.json({ ok: false, error: "Credenciales invalidas" }, { status: 401 });
  }

  if (dosFactorHabilitado()) {
    const reg = obtenerOCrear2FA(usuario);

    if (!token) {
      if (!reg.enrolado) {
        // Primera vez: mostrar el QR para que el usuario enrole su app.
        return NextResponse.json({
          ok: false,
          need2fa: true,
          enrolar: { qr: await qrDataUrl(usuario, reg.secret), secret: reg.secret },
        });
      }
      // Ya enrolado: solo pedir el codigo.
      return NextResponse.json({ ok: false, need2fa: true });
    }

    const codigoValido = await verificarTotp(reg.secret, token);
    if (!codigoValido) {
      const cuerpo: Record<string, unknown> = {
        ok: false,
        need2fa: true,
        error: "Código de verificación inválido",
      };
      // Si todavia estaba enrolando, seguir mostrando el QR.
      if (!reg.enrolado) {
        cuerpo.enrolar = { qr: await qrDataUrl(usuario, reg.secret), secret: reg.secret };
      }
      return NextResponse.json(cuerpo, { status: 401 });
    }

    // Codigo correcto: si era la primera vez, queda enrolado.
    if (!reg.enrolado) marcarEnrolado2FA(usuario);
  }

  const sesion = await crearSesion(tenant);
  if (!sesion) {
    // Fail-closed: falta SESSION_SECRET en el servidor. No emitimos una sesion
    // insegura; el operador debe configurar la variable.
    return NextResponse.json(
      { ok: false, error: "Login no disponible: el servidor no está configurado." },
      { status: 503 },
    );
  }
  const res = NextResponse.json({ ok: true, tenant });
  res.headers.set("Set-Cookie", cookieDeSesion(sesion.valor, sesion.maxAge));
  return res;
}
