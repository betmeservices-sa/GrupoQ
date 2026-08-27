import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe } from "@/lib/meta-store";
import {
  comentariosDe,
  meGustaComentario,
  ocultarComentario,
  responderComentario,
  responderEnPrivado,
} from "@/lib/meta-comentarios";
import { addMetaOutbound } from "@/lib/meta-messages-store";
import { esComentarioInstagram } from "@/lib/meta-ig-login";

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
    /** true = contestar por mensaje privado en vez de debajo del comentario. */
    privado?: boolean;
    /** true = me gusta de la página; false = quitarlo. Solo Facebook. */
    meGusta?: boolean;
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
    if (body.meGusta !== undefined) {
      await meGustaComentario(conexion, body.id, body.meGusta);
      return NextResponse.json({ ok: true, meGusta: body.meGusta });
    }
    if (!(body.texto ?? "").trim()) {
      return NextResponse.json({ ok: false, error: "La respuesta viene vacía." }, { status: 400 });
    }
    if (body.privado) {
      const { recipientId, mid } = await responderEnPrivado(conexion, body.id, body.texto as string);
      // Queda en la bandeja desde ya, bajo la persona: el sondeo de Messenger
      // trae después su nombre y lo que conteste.
      if (recipientId) {
        await addMetaOutbound({
          mid,
          tenant,
          canal: esComentarioInstagram(body.id) ? "instagram" : "facebook",
          pageId: conexion.pageId,
          senderId: recipientId,
          texto: (body.texto as string).trim(),
          ts: new Date().toISOString(),
        });
      }
      return NextResponse.json({ ok: true, privado: true, recipientId });
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
