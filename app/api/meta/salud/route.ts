import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe } from "@/lib/meta-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

// ¿Sigue conectado, y hasta cuándo?
//
// Existe porque la pregunta "¿esto se va a desconectar solo?" no se puede
// contestar mirando la pantalla: la conexión se ve igual el día antes de
// vencerse. Acá se le pregunta a Meta directamente por cada página.
//
// NO devuelve ningún token, ni recortado. Solo si sirve, hasta cuándo y qué
// permisos tiene.

interface Debug {
  is_valid?: boolean;
  expires_at?: number;
  data_access_expires_at?: number;
  scopes?: string[];
  type?: string;
  error?: { message?: string };
}

/** Lo que el panel necesita de Meta para funcionar. */
const NECESARIOS = [
  "pages_show_list",
  "pages_messaging",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_read_user_content",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_manage_comments",
  "instagram_manage_messages",
];

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ ok: false, error: "Faltan las credenciales de la app." });
  }
  const appToken = `${appId}|${appSecret}`;

  const conexiones = await conexionesDe(tenant);
  if (!conexiones.length) {
    return NextResponse.json({ ok: true, paginas: [], mensaje: "Ninguna página conectada." });
  }

  const paginas = await Promise.all(
    conexiones.map(async (c) => {
      let d: Debug = {};
      try {
        const r = await fetch(
          `${GRAPH}/debug_token?input_token=${encodeURIComponent(c.pageToken)}&access_token=${encodeURIComponent(appToken)}`,
          { cache: "no-store" },
        );
        d = ((await r.json()) as { data?: Debug }).data ?? {};
      } catch {
        d = { is_valid: false };
      }

      const scopes = d.scopes ?? [];
      return {
        pagina: c.pageName,
        instagram: Boolean(c.igId),
        sirve: Boolean(d.is_valid),
        // 0 = no vence. Es lo normal en un token de página sacado de un token
        // de usuario de larga duración, y es justo lo que queremos ver.
        vence: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null,
        // Este SÍ vence a los 90 días de inactividad aunque el token no: si
        // nadie usa la conexión, Meta corta el acceso a los datos.
        datosHasta: d.data_access_expires_at
          ? new Date(d.data_access_expires_at * 1000).toISOString()
          : null,
        faltan: NECESARIOS.filter((p) => !scopes.includes(p)),
      };
    }),
  );

  return NextResponse.json({ ok: true, paginas });
}
