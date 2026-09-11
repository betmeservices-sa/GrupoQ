// Cómo se cerró cada reserva: quién la cerró y a qué hora pasó cada cosa.
//
// LA PREGUNTA QUE CONTESTA, tal como la hizo el cliente: de las confirmadas,
// "qué tanto fue Sofía y qué tanto fue Vero", con la hora en que arrancó la
// conversación, la hora en que se le pasó a una persona, y la hora en que se
// cerró el trato.
//
// VA APARTE DE /api/agencia/resumen a propósito. Esto lee el hilo completo de
// cada reserva, o sea una consulta por reserva. Meterlo en el resumen haría
// lento el panel entero para un bloque que no siempre se mira.
//
// Solo para la agencia: acá se ve la operación de un cliente con nombre y
// apellido de quién cerró qué.

import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { esAgencia } from "@/lib/tenants/voz";
import { isTenantId } from "@/lib/tenants";
import { tenantFromRequest } from "@/lib/tenants/server";
import { listarPreReservas } from "@/lib/yali-prereservas";
import { mensajesAnteriores } from "@/lib/meta-messages-store";
import { comoSeCerro, resumirCierres, type MensajeDelHilo } from "@/lib/cierre-de-reserva";
import type { MetaCanal } from "@/lib/meta-messages-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una consulta por reserva: con muchas confirmadas esto toma unos segundos.
export const maxDuration = 60;

/** Cuántos mensajes del hilo se miran. De sobra para ver cómo se cerró. */
const HILO = 200;

/** Hasta cuántas reservas se arman por pedido, para no colgar el panel. */
const TOPE = 40;

export async function GET(req: Request) {
  // La agencia y nadie más: esto muestra quién de un cliente cerró qué.
  const tenantDelPanel = tenantFromRequest(req);
  if (!esAgencia(tenantDelPanel)) {
    return NextResponse.json({ ok: false, error: "Solo para la agencia" }, { status: 403 });
  }
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

  const pedido = new URL(req.url).searchParams.get("cliente") ?? "";
  if (!isTenantId(pedido)) {
    return NextResponse.json({ ok: false, error: "Falta el cliente." }, { status: 400 });
  }

  const desde = new URL(req.url).searchParams.get("desde");

  const todas = await listarPreReservas(pedido).catch(() => []);
  const confirmadas = todas
    .filter((r) => r.estado === "confirmada")
    .filter((r) => !desde || (r.confirmadaTs ?? r.creada) >= desde)
    .sort((a, b) => (b.confirmadaTs ?? b.creada).localeCompare(a.confirmadaTs ?? a.creada))
    .slice(0, TOPE);

  const cierres = await Promise.all(
    confirmadas.map(async (r) => {
      // La clave es "<canal>:<pagina>:<persona>". Una reserva que entró por
      // otro camino (WhatsApp, o cargada a mano) no tiene hilo que mirar: se
      // devuelve igual, sin línea de tiempo, en vez de desaparecerla del
      // reporte y que los totales no cuadren con el bloque de arriba.
      const [canal, pageId, senderId] = (r.clave ?? "").split(":");
      let mensajes: MensajeDelHilo[] = [];
      if (canal && pageId && senderId) {
        const h = await mensajesAnteriores(
          { canal: canal as MetaCanal, pageId, senderId },
          null,
          HILO,
          pedido,
        ).catch(() => ({ mensajes: [] }));
        mensajes = h.mensajes.map((m) => ({
          direction: m.direction === "in" ? "in" : "out",
          ts: m.ts,
          staffId: m.staffId ?? null,
          staffNombre: m.staffNombre ?? null,
        }));
      }
      return {
        id: r.id,
        huesped: r.huesped ?? "",
        sede: r.sedeNombre ?? "",
        habitacion: r.habitacionNombre ?? "",
        total: r.total ?? 0,
        noches: r.noches ?? 0,
        confirmadaTs: r.confirmadaTs ?? null,
        confirmadaPor: r.confirmadaPor ?? null,
        comprobanteTs: r.comprobanteTs ?? null,
        conversacion: r.clave ?? null,
        cierre: comoSeCerro(mensajes, r.confirmadaTs ?? null),
      };
    }),
  );

  return NextResponse.json({ ok: true, cliente: pedido, resumen: resumirCierres(cierres), cierres });
}
