// La conversación que terminó en una reserva, para abrirla desde "Quién cerró".
//
// Devuelve la MISMA tanda que usa el conteo de mensajes de esa fila (desde que
// arrancó hasta que se confirmó), así lo que se lee en la ventana cuadra con
// los números de la tabla.
//
// GET ?cliente=<tenant>&clave=<canal>:<pagina>:<persona>&hasta=<confirmadaTs ISO>
//
// Solo para la agencia, igual que /api/agencia/cierres.

import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { esAgencia } from "@/lib/tenants/voz";
import { TENANTS, isTenantId } from "@/lib/tenants";
import { tenantFromRequest } from "@/lib/tenants/server";
import { mensajesAnteriores } from "@/lib/meta-messages-store";
import { ID_AGENTE, tandaDelCierre } from "@/lib/cierre-de-reserva";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Los mismos mensajes que mira /api/agencia/cierres. */
const HILO = 200;

/**
 * Quién escribió cada mensaje. "equipo" es alguien del cliente que contestó
 * desde el celular o Business Suite, sin pasar por el panel: Meta no dice
 * quién fue, y por eso el conteo de la tabla no lo suma a nadie.
 */
type Autor ="huesped" | "agente" | "persona" | "equipo";

export async function GET(req: Request) {
  if (!esAgencia(tenantFromRequest(req))) {
    return NextResponse.json({ ok: false, error: "Solo para la agencia" }, { status: 403 });
  }
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const cliente = q.get("cliente") ?? "";
  if (!isTenantId(cliente)) {
    return NextResponse.json({ ok: false, error: "Falta el cliente." }, { status: 400 });
  }
  const [canal, pageId, senderId] = (q.get("clave") ?? "").split(":");
  if ((canal !== "instagram" && canal !== "facebook") || !pageId || !senderId) {
    return NextResponse.json({ ok: false, error: "Esta reserva no tiene chat." }, { status: 400 });
  }

  const hilo = await mensajesAnteriores({ canal, pageId, senderId }, null, HILO, cliente).catch(() => ({
    mensajes: [],
  }));
  const tanda = tandaDelCierre(
    hilo.mensajes.map((m) => ({
      direction: m.direction === "in" ? ("in" as const) : ("out" as const),
      ts: m.ts,
      staffId: m.staffId ?? null,
      staffNombre: m.staffNombre ?? null,
      texto: m.texto,
    })),
    q.get("hasta"),
  );

  const agente = TENANTS[cliente].ai?.nombre ?? "Agente";
  return NextResponse.json({
    ok: true,
    agente,
    mensajes: tanda.map((m) => {
      const autor: Autor =
        m.direction === "in" ? "huesped" : m.staffId === ID_AGENTE ? "agente" : m.staffId ? "persona" : "equipo";
      return {
        ts: m.ts,
        texto: m.texto,
        autor,
        nombre: autor === "agente" ? agente : autor === "huesped" ? null : (m.staffNombre?.trim() || "Equipo"),
      };
    }),
  });
}
