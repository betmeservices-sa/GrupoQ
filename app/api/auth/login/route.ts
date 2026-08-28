import { NextResponse } from "next/server";
import { ipDe, registrarAcceso } from "@/lib/accesos";
import QRCode from "qrcode";
import { validarCredenciales } from "@/lib/auth-server";
import {
  cookieDeSesion,
  crearSesion,
  crear2faRecordado,
  verificar2faRecordado,
  cookie2faRecordado,
  leer2faRecordadoDeCookies,
} from "@/lib/session";
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

  const acceso = await validarCredenciales(usuario, password);
  if (!acceso) {
    // Mensaje generico a proposito: no revelamos si el usuario existe.
    return NextResponse.json({ ok: false, error: "Credenciales invalidas" }, { status: 401 });
  }

  // Segundo factor con "recordar 24h": tras verificar el codigo se emite una
  // cookie firmada de 24h; mientras dure, el login salta el paso del codigo para
  // ese usuario. A las 24h expira y se vuelve a pedir el codigo (NO re-escanear:
  // el secreto del usuario es permanente, una sola app enrolada para siempre).
  let abrirVentana2fa = false;
  if (dosFactorHabilitado()) {
    const reg = obtenerOCrear2FA(usuario);
    const recordado =
      reg.enrolado &&
      (await verificar2faRecordado(
        leer2faRecordadoDeCookies(req.headers.get("cookie")),
        usuario,
      ));

    if (!recordado) {
      if (!token) {
        if (!reg.enrolado) {
          // Primera vez: mostrar el QR para que el usuario enrole su app (una sola vez).
          return NextResponse.json({
            ok: false,
            need2fa: true,
            enrolar: { qr: await qrDataUrl(usuario, reg.secret), secret: reg.secret },
          });
        }
        // Enrolado pero sin ventana vigente: pedir solo el codigo (sin QR).
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
      abrirVentana2fa = true; // recien verifico el codigo: abrir ventana de 24h
    }
  }

  const sesion = await crearSesion(
    acceso.tenant,
    acceso.rol,
    acceso.fijo,
    acceso.usuario ?? "",
    acceso.todos === true,
  );
  if (!sesion) {
    // Fail-closed: falta SESSION_SECRET en el servidor. No emitimos una sesion
    // insegura; el operador debe configurar la variable.
    return NextResponse.json(
      { ok: false, error: "Login no disponible: el servidor no está configurado." },
      { status: 503 },
    );
  }
  // Quién entró, de qué cliente y desde dónde (lo mira el tablero de la agencia).
  if (acceso.usuario) {
    await registrarAcceso({
      tenant: acceso.tenant,
      usuario: acceso.usuario,
      nombre: acceso.nombre ?? null,
      rol: acceso.rol,
      todos: acceso.todos === true,
      host: req.headers.get("host"),
      ip: ipDe(req),
      agente: req.headers.get("user-agent"),
    });
  }
  const res = NextResponse.json({
    ok: true,
    tenant: acceso.tenant,
    rol: acceso.rol,
    nombre: acceso.nombre,
    todos: acceso.todos === true,
  });
  res.headers.append("Set-Cookie", cookieDeSesion(sesion.valor, sesion.maxAge, req.headers.get("host")));
  // Abrir/renovar la ventana de 24h solo cuando se acaba de verificar el codigo.
  if (abrirVentana2fa) {
    const rem = await crear2faRecordado(usuario);
    if (rem) res.headers.append("Set-Cookie", cookie2faRecordado(rem.valor, rem.maxAge));
  }
  return res;
}
