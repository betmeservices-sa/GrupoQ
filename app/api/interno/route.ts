import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { tenantFromRequest } from "@/lib/tenants/server";
import { staffDeUsuario } from "@/lib/usuarios";
import {
  borrarCanal,
  enviarMensaje,
  guardarCanal,
  internoEnMemoria,
  leidoDe,
  listarCanales,
  marcarLeido,
  mensajesDesde,
  type CanalInterno,
} from "@/lib/interno-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El chat interno del equipo.
//
// El tenant sale de la cookie firmada y el autor de la cuenta con la que se
// entró, NUNCA del cuerpo del pedido: si vinieran del cliente, cualquiera
// podría escribir a nombre de otro o leer los canales de otro hotel.

async function quien(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  const tenant = tenantFromRequest(req);
  // Los logins de demo no son de nadie: entran como el usuario del seed.
  const staffId = sesion?.usuario ? staffDeUsuario(sesion.usuario) : "me";
  return { tenant, staffId: staffId ?? "me", rol: sesion?.rol, fijo: Boolean(sesion?.fijo) };
}

/** Puede crear canales y mover miembros. Hoy: quien ve la configuración. */
function puedeAdministrar(rol: string | undefined, fijo: boolean): boolean {
  if (!fijo) return true; // login de demo: puede todo
  return rol === "admin" || rol === "gerente_marketing";
}

export async function GET(req: Request) {
  const { tenant, staffId } = await quien(req);
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");

  const [canales, mensajes, leido] = await Promise.all([
    listarCanales(tenant),
    mensajesDesde(tenant, Number.isFinite(after) ? after : 0),
    leidoDe(tenant, staffId),
  ]);

  return NextResponse.json({
    ok: true,
    yo: staffId,
    canales,
    mensajes,
    leido,
    // Un chat que no entrega no es un chat: el panel lo avisa en pantalla.
    enMemoria: internoEnMemoria(),
  });
}

export async function POST(req: Request) {
  const { tenant, staffId, rol, fijo } = await quien(req);
  const body = (await req.json().catch(() => ({}))) as {
    accion?: string;
    canalId?: string;
    texto?: string;
    canal?: Partial<CanalInterno>;
    ultimoId?: number;
  };

  if (body.accion === "mensaje") {
    const texto = (body.texto ?? "").trim();
    if (!body.canalId || !texto) {
      return NextResponse.json({ ok: false, error: "Falta el mensaje." }, { status: 400 });
    }
    const m = await enviarMensaje(tenant, body.canalId, staffId, texto);
    if (!m) return NextResponse.json({ ok: false, error: "No se pudo enviar." }, { status: 500 });
    return NextResponse.json({ ok: true, mensaje: m });
  }

  if (body.accion === "leido") {
    if (!body.canalId) return NextResponse.json({ ok: false }, { status: 400 });
    await marcarLeido(tenant, staffId, body.canalId, Number(body.ultimoId) || 0);
    return NextResponse.json({ ok: true });
  }

  if (body.accion === "canal") {
    if (!puedeAdministrar(rol, fijo)) {
      return NextResponse.json(
        { ok: false, error: "Tu perfil no puede crear ni cambiar canales." },
        { status: 403 },
      );
    }
    const c = body.canal ?? {};
    const nombre = (c.nombre ?? "").trim();
    if (!nombre) return NextResponse.json({ ok: false, error: "Falta el nombre." }, { status: 400 });

    const canal: CanalInterno = {
      id: c.id || `ic-${Date.now().toString(36)}`,
      nombre,
      tipo: c.tipo === "dm" ? "dm" : "canal",
      // Quien lo crea queda dentro: un canal sin su creador no se puede abrir.
      miembros: Array.from(new Set([...(c.miembros ?? []), staffId])),
    };
    await guardarCanal(tenant, canal);
    return NextResponse.json({ ok: true, canal });
  }

  if (body.accion === "borrar_canal") {
    if (!puedeAdministrar(rol, fijo)) {
      return NextResponse.json({ ok: false, error: "Tu perfil no puede borrar canales." }, { status: 403 });
    }
    if (!body.canalId) return NextResponse.json({ ok: false }, { status: 400 });
    await borrarCanal(tenant, body.canalId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
