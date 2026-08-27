// Probar a Sofía desde el panel, sin WhatsApp ni Meta de por medio.
//
// Corre EXACTAMENTE el mismo turno que un mensaje real: la pregunta de sede
// (lib/sucursal-gate.ts), el tope de mensajes, el guion, las herramientas
// (disponibilidad real de Cloudbeds, apartar_estadia, crear_ticket) y los
// traspasos a una persona. La única diferencia es que el historial vive en el
// navegador de quien prueba y viaja completo en cada turno, en vez de en la
// base; por eso el reset es borrar ese historial (y cerrar el apartado vivo).
//
// La conversación se identifica como "prueba:<sesion>", así los apartados que
// deja se distinguen de los de huéspedes reales.

import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { TENANTS } from "@/lib/tenants";
import { generarRespuesta, type TurnoIA } from "@/lib/ai";
import { decidirTurno, limiteDe } from "@/lib/sucursal-gate";
import { RESPONSABLE, type Motivo } from "@/lib/pasar-a-persona";
import {
  preReservaViva,
  rechazarPreReserva,
  recibirComprobante,
  textoComprobanteRecibido,
} from "@/lib/yali-prereservas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface TurnoPrueba {
  autor: "cliente" | "staff";
  texto: string;
  /** true en los mensajes fijos de sede (cuentan aparte para el tope). */
  sucursal?: boolean;
}

interface Cuerpo {
  sesionId?: string;
  texto?: string;
  historial?: TurnoPrueba[];
  sucursalId?: string | null;
  intentos?: number;
  /** true = "el huésped mandó una foto" (el comprobante). */
  comprobante?: boolean;
}

function claveDe(sesionId: string): string {
  return `prueba:${sesionId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40)}`;
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const cfg = TENANTS[tenant];
  const b = (await req.json().catch(() => ({}))) as Cuerpo;
  const sesionId = (b.sesionId ?? "").trim();
  if (!sesionId) return NextResponse.json({ ok: false, error: "Falta la sesión." }, { status: 400 });
  const clave = claveDe(sesionId);
  const historial = Array.isArray(b.historial) ? b.historial : [];
  const texto = (b.texto ?? "").trim();
  let sucursalId = b.sucursalId ?? null;
  let intentos = Number(b.intentos) || 0;

  try {
    // ── El comprobante: igual que el webhook, sin pasar por el modelo ──
    if (b.comprobante) {
      const p = await recibirComprobante(tenant, clave, { url: null, mid: `prueba-${Date.now()}` });
      if (!p) {
        return NextResponse.json({
          ok: true,
          tipo: "sin_apartado",
          aviso: "Llegó una foto pero no hay ninguna habitación apartada en este chat, así que no cuenta como comprobante. Primero hay que llegar al paso del apartado.",
          apartado: null,
          sucursalId,
          intentos,
        });
      }
      return NextResponse.json({
        ok: true,
        tipo: "comprobante",
        respuesta: textoComprobanteRecibido(),
        traspaso: { para: RESPONSABLE.reservas, motivo: "pago" },
        apartado: p,
        sucursalId,
        intentos,
      });
    }

    if (!texto) return NextResponse.json({ ok: false, error: "Escribe algo." }, { status: 400 });

    const salientes = historial.filter((m) => m.autor === "staff");
    const decision = decidirTurno({
      sucursales: cfg.sucursales,
      limite: cfg.ai?.limiteMensajes,
      mensajesAgente: salientes.length,
      mensajesSucursal: salientes.filter((m) => m.sucursal).length,
      sucursalId,
      intentos,
      textoCliente: texto,
    });
    const limite = limiteDe(cfg.ai?.limiteMensajes);

    if (decision.tipo === "silencio") {
      return NextResponse.json({ ok: true, tipo: "silencio", aviso: `Ya se llegó al tope de ${limite} mensajes: Sofía no responde más en este chat.`, apartado: await preReservaViva(tenant, clave), sucursalId, intentos, limite });
    }
    if (decision.tipo === "preguntar_sucursal") {
      return NextResponse.json({ ok: true, tipo: "sucursal", respuesta: decision.texto, sucursalMsg: true, sucursalId, intentos: intentos + 1, apartado: null, limite });
    }
    if (decision.tipo === "handoff_sucursal" || decision.tipo === "cerrar_por_limite") {
      return NextResponse.json({
        ok: true,
        tipo: decision.tipo,
        respuesta: decision.texto,
        traspaso: { para: RESPONSABLE.reservas, motivo: decision.tipo === "cerrar_por_limite" ? "limite" : "sede" },
        apartado: await preReservaViva(tenant, clave),
        sucursalId,
        intentos,
        limite,
      });
    }

    if (decision.pedirSede) intentos += 1;
    if (decision.recienElegida && decision.sucursal) sucursalId = decision.sucursal.id;

    const turnos: TurnoIA[] = [
      ...historial.map((m) => ({ autor: m.autor, texto: m.texto })),
      { autor: "cliente" as const, texto },
    ];
    let traspaso: { para: string; motivo: Motivo; area?: string } | null = null;
    const reacciones: string[] = [];
    const r = await generarRespuesta(
      turnos,
      {
        onReaccionar: (emoji) => {
          reacciones.push(emoji);
        },
        onElegirHotel: (sede) => {
          sucursalId = sede.id;
        },
        onPasarAPersona: async (motivo, area) => {
          const para = motivo === "socio" ? RESPONSABLE.membresias : RESPONSABLE.reservas;
          traspaso = { para, motivo, area };
          return { ok: true, para };
        },
      },
      {
        telefono: `prueba-${sesionId}`,
        tenantId: tenant,
        sucursal: decision.sucursal,
        pedirSede: decision.pedirSede === true,
        clave,
      },
    );
    return NextResponse.json({
      ok: true,
      tipo: "ia",
      respuesta: r.texto,
      reacciones,
      traspaso,
      uso: { llamadas: r.llamadas, entrada: r.uso.input_tokens, salida: r.uso.output_tokens, modelo: r.modelo },
      apartado: await preReservaViva(tenant, clave),
      sucursalId,
      intentos,
      limite,
    });
  } catch (e) {
    console.error("yali/sofia:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Falló el turno." });
  }
}

/** Reset: cierra el apartado vivo de esta sesión de prueba. El historial lo borra el navegador. */
export async function DELETE(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "yaly") return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { sesionId?: string };
  const sesionId = (b.sesionId ?? "").trim();
  if (!sesionId) return NextResponse.json({ ok: true });
  try {
    const p = await preReservaViva(tenant, claveDe(sesionId));
    if (p) await rechazarPreReserva(tenant, p.id, "reset de la prueba", { nombre: "Prueba" });
    return NextResponse.json({ ok: true, cerrado: p?.id ?? null });
  } catch (e) {
    console.error("yali/sofia reset:", e);
    return NextResponse.json({ ok: false, error: "No se pudo cerrar el apartado de prueba." });
  }
}
