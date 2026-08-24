import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe } from "@/lib/meta-store";
import { comentariosDe, ocultarComentario, responderComentario } from "@/lib/meta-comentarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Comentarios de las publicaciones del tenant logueado.
//
// El tenant sale de la cookie firmada, NUNCA del cuerpo: si viniera del cliente,
// cualquiera podría leer o responder los comentarios de otro hotel.

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  try {
    const conexiones = await conexionesDe(tenant);
    if (conexiones.length === 0) {
      return NextResponse.json({ ok: true, comentarios: [], sinConexion: true });
    }
    return NextResponse.json({ ok: true, comentarios: await comentariosDe(conexiones) });
  } catch (e) {
    console.error("comentarios GET:", e);
    return NextResponse.json({ ok: false, error: "No se pudieron leer los comentarios." });
  }
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    pageId?: string;
    texto?: string;
    ocultar?: boolean;
  };
  if (!body.id || !body.pageId) {
    return NextResponse.json({ ok: false, error: "Falta el comentario." }, { status: 400 });
  }

  // La conexión se busca ENTRE LAS DEL TENANT, no por el pageId a secas: si no,
  // mandando el pageId de otro cliente se podría responder en su nombre.
  const conexion = (await conexionesDe(tenant)).find((c) => c.pageId === body.pageId);
  if (!conexion) {
    return NextResponse.json({ ok: false, error: "Esa página no es de este cliente." }, { status: 403 });
  }

  try {
    if (body.ocultar !== undefined) {
      await ocultarComentario(conexion, body.id, body.ocultar);
      return NextResponse.json({ ok: true, oculto: body.ocultar });
    }
    if (!(body.texto ?? "").trim()) {
      return NextResponse.json({ ok: false, error: "La respuesta viene vacía." }, { status: 400 });
    }
    await responderComentario(conexion, body.id, body.texto as string);
    return NextResponse.json({ ok: true, respondido: true });
  } catch (e) {
    // El mensaje de Meta sí se muestra: "el comentario fue borrado" o "no tenés
    // permiso" le dicen a quien atiende qué hacer, y un error genérico no.
    const msg = e instanceof Error ? e.message : "No se pudo completar la acción.";
    console.error("comentarios POST:", msg);
    return NextResponse.json({ ok: false, error: msg });
  }
}
