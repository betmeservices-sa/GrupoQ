// Barrido programado: reservas cerradas por el equipo en el chat.
//
// Ya no corre desde acá: el cron vive en hub.miagentia.com (repo yali), que
// lee el mismo esquema. Correrlo en los dos era barrer dos veces. La ruta
// queda por si hace falta lanzarlo a mano con el CRON_SECRET.
//
// Dos veces al día se leen los chats de Yali con señal de
// reserva en las últimas 24 horas (una foto del huésped, o mensajes sobre
// reservar o precios) que todavía no tienen tarjeta, y se detecta la reserva
// en cada uno. Lo inmediato (una foto que llega) ya lo hace el webhook; esto
// atrapa lo que se cerró sin foto: enlace de pago, "ya me llegó el correo".
//
// Vercel llama con Authorization: Bearer <CRON_SECRET>. Sin eso, 401.

import { NextResponse } from "next/server";
import { chatsConSenalDeReserva, detectarReservaEnChat } from "@/lib/yali-detectar-reserva";
import { listarPreReservas, preReservaViva } from "@/lib/yali-prereservas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secreto || auth !== `Bearer ${secreto}`) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  const dias = Math.min(7, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 1));
  const tenant = "yaly";
  const claves = await chatsConSenalDeReserva(tenant, dias);
  const resumen = { leidos: 0, conTarjeta: 0, detectadas: [] as string[], sinReserva: 0, errores: 0 };
  for (const clave of claves) {
    if (await preReservaViva(tenant, clave)) {
      resumen.conTarjeta++;
      continue;
    }
    const cerradas = await listarPreReservas(tenant, clave);
    if (cerradas.some((p) => p.estado === "confirmada" && p.actualizada >= new Date(Date.now() - dias * 86_400_000).toISOString())) {
      resumen.conTarjeta++;
      continue;
    }
    try {
      resumen.leidos++;
      const r = await detectarReservaEnChat(tenant, clave);
      if (r.reserva) resumen.detectadas.push(`${r.reserva.id} ${r.reserva.estado} ${r.reserva.huesped}`);
      else resumen.sinReserva++;
    } catch (e) {
      resumen.errores++;
      console.error("[cron yali-reservas]", clave, e instanceof Error ? e.message : e);
    }
  }
  console.log(`[cron yali-reservas] ${claves.length} chats con señal, ${resumen.leidos} leídos, ${resumen.detectadas.length} detectadas`);
  return NextResponse.json({ ok: true, dias, chats: claves.length, ...resumen });
}
