// La IA contestando por Messenger e Instagram.
//
// Es el espejo de lib/ai-reply.ts (WhatsApp), con las mismas barandas y el
// mismo orden del turno:
//   1. ¿la IA está encendida para este chat? (interruptor global + override)
//   2. silencio y ¿sigo siendo el último mensaje? (si no, responde el más nuevo)
//   3. "escribiendo..." y el resto de la espera
//   4. ¿sigo siendo el último?
//   5. barandas: sede obligatoria, tope de mensajes
//   6. si toca responder: Claude, envío, consumo
//
// Lo que cambia respecto a WhatsApp es de dónde salen las cosas: el historial
// de meta_messages, el estado de sede de meta_conversaciones, el envío por la
// página o por la cuenta de Instagram, y el "escribiendo" por sender_action.
//
// Cuando la IA se retira (tope, sede que no aparece, socio, pago, reclamo,
// nota de voz) el chat NO queda huérfano: se apaga la IA en ese chat y se
// asigna a una persona (reservas o membresías), que lo ve en "Mis chats".

import { generarRespuesta, type TurnoIA } from "./ai";
import { getChatAiActiva, setChatOverride } from "./ai-store";
import { accionEnMensaje } from "./meta-acciones";
import { claveMeta, getConversacionMeta, upsertConversacionMeta } from "./meta-conversaciones";
import { enviarYGuardarMeta, IA_STAFF_ID } from "./meta-enviar";
import { mensajesAnteriores, type MetaCanal, type MetaMensaje } from "./meta-messages-store";
import { conexionesDe, type MetaConnection } from "./meta-store";
import { RESPONSABLE, type Motivo, type Traspaso } from "./pasar-a-persona";
import { decidirTurno, limiteDe, sucursalDePagina } from "./sucursal-gate";
import { sinMarkdown } from "./negritas";
import { ultimoEntrante } from "./ultimo-entrante";
import { upsertContacto } from "./contacts-store";
import { registrarConsumo } from "./tokens-store";
import { TENANTS } from "./tenants";
import type { TenantId } from "./tenants/types";

const DELAY_MIN_MS = Number(process.env.AI_DELAY_MIN_MS) || 5000;
const DELAY_MAX_MS = Number(process.env.AI_DELAY_MAX_MS) || 12000;
const SESION_GAP_MS = (Number(process.env.AI_SESSION_GAP_HORAS) || 4) * 60 * 60 * 1000;
const HILO = 60;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function restoAleatorio(): number {
  const extra = Math.max(DELAY_MAX_MS - DELAY_MIN_MS, 0);
  return Math.floor(Math.random() * (extra + 1));
}

/** Tras un hueco largo la conversación arranca fresca (igual que WhatsApp). */
function sesionReciente(msgs: MetaMensaje[]): MetaMensaje[] {
  const out: MetaMensaje[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (out.length > 0) {
      const gap = new Date(out[0].ts).getTime() - new Date(msgs[i].ts).getTime();
      if (gap > SESION_GAP_MS) break;
    }
    out.unshift(msgs[i]);
  }
  return out;
}

function esMensajeDeSucursal(texto: string, tenant: TenantId): boolean {
  const s = TENANTS[tenant]?.sucursales;
  if (!s) return false;
  return texto === s.pregunta || texto === s.reintento || texto === s.handoff;
}

/** El hilo entero de esta persona, viejo → nuevo. */
async function hilo(tenant: TenantId, canal: MetaCanal, pageId: string, senderId: string): Promise<MetaMensaje[]> {
  const r = await mensajesAnteriores({ canal, pageId, senderId }, null, HILO, tenant);
  return r.mensajes.slice().sort((a, b) => a.seq - b.seq);
}

export interface TurnoMeta {
  tenant: TenantId;
  canal: MetaCanal;
  pageId: string;
  senderId: string;
  /** El mid del mensaje entrante que dispara el turno. */
  mid: string;
}

/**
 * Pasar la conversación a una persona: se apaga la IA en ese chat y se asigna
 * a quien corresponde (socio → membresías; lo demás → reservas).
 *
 * Nunca lanza. Devuelve si quedó hecho, para que el modelo no prometa que
 * "alguien le escribe" si el traspaso falló.
 */
export async function pasarAPersonaMeta(
  t: Omit<TurnoMeta, "mid">,
  motivo: Motivo,
  departamento?: string,
): Promise<Traspaso> {
  const para = motivo === "socio" ? RESPONSABLE.membresias : RESPONSABLE.reservas;
  const clave = claveMeta(t.canal, t.pageId, t.senderId);
  try {
    // Primero se apaga el agente: si se asignara primero y fallara el
    // apagado, quedarían los dos contestando.
    await setChatOverride(clave, false);
    await upsertConversacionMeta(t.tenant, clave, {
      asignadoA: para,
      estado: "en_progreso",
      departamento,
    });
    return { ok: true, para };
  } catch (e) {
    console.error("[meta-ia] pasar a persona:", motivo, e);
    return { ok: false, para, error: e instanceof Error ? e.message : "falló" };
  }
}

async function conexionDe(tenant: TenantId, pageId: string): Promise<MetaConnection | null> {
  return (await conexionesDe(tenant)).find((c) => c.pageId === pageId) ?? null;
}

export async function programarRespuestaIAMeta(t: TurnoMeta): Promise<void> {
  // A Yali la contesta hub.miagentia.com (repo yali), que lee este mismo
  // esquema. Cuando los dos contestaban, ganaba este por rápido (5-12 s contra
  // 15-35 s) y con el guion viejo: "Sunsal", día de la semana mal, sin las
  // barandas que solo existen allá. Acá los mensajes de Yali solo se guardan.
  if (t.tenant === "yaly") return;
  const cfg = TENANTS[t.tenant];
  if (!cfg) return;
  const clave = claveMeta(t.canal, t.pageId, t.senderId);

  try {
    // Activa si: override del chat (si existe) o, si no, el interruptor global.
    if (!(await getChatAiActiva(clave))) return;

    const cx = await conexionDe(t.tenant, t.pageId);
    if (!cx) return;

    // Tramo 1: silencio. Si la persona manda otro mensaje, este turno se
    // retira y el de ese mensaje contesta todo junto. Lo que NO importa es
    // quién habló último: si Sofía acaba de responder y la persona escribió
    // encima (o mientras Sofía redactaba), se le contesta igual.
    await sleep(DELAY_MIN_MS);
    let conv = await hilo(t.tenant, t.canal, t.pageId, t.senderId);
    let ultimo = ultimoEntrante(conv);
    if (!ultimo || ultimo.mid !== t.mid) return;

    // Recién ahora el "escribiendo...", y el resto de la espera.
    await accionEnMensaje(cx, t.canal, t.senderId, { accion: "escribiendo" }).catch(() => {});
    await sleep(restoAleatorio());

    conv = await hilo(t.tenant, t.canal, t.pageId, t.senderId);
    ultimo = ultimoEntrante(conv);
    if (!ultimo || ultimo.mid !== t.mid) return;

    const sesion = sesionReciente(conv);
    if (sesion.length === 0) return;

    // ── Barandas ──
    const salientes = sesion.filter((m) => m.direction === "out");
    const estado = await getConversacionMeta(t.tenant, clave);
    // Ya se contestó leyendo este mismo mensaje: nada que agregar.
    if (estado.ultimoMidAtendido === t.mid) return;
    const decision = decidirTurno({
      sucursales: cfg.sucursales,
      limite: cfg.ai.limiteMensajes,
      mensajesAgente: salientes.length,
      mensajesSucursal: salientes.filter((m) => esMensajeDeSucursal(m.texto, t.tenant)).length,
      sucursalId: estado.sucursalId,
      intentos: estado.intentosSucursal,
      textoCliente: ultimo.texto,
      // En Messenger e Instagram la sede la dice la página: no se pregunta.
      origenSede: sucursalDePagina(cfg.sucursales, cx.pageName),
    });

    if (decision.tipo === "silencio") return;

    const ia = { staffId: IA_STAFF_ID, nombre: cfg.ai.nombre ?? "IA" };

    if (decision.tipo === "preguntar_sucursal") {
      await enviarYGuardarMeta(cx, t.canal, t.senderId, decision.texto, ia);
      await upsertConversacionMeta(t.tenant, clave, { intentosSucursal: estado.intentosSucursal + 1, ultimoMidAtendido: t.mid });
      return;
    }

    // Se acabó el cupo o la sede no aparece: se avisa y pasa a una persona.
    // La IA queda apagada para ESTE chat y el chat queda asignado a reservas,
    // que lo ve en "Mis chats". El interruptor global sigue como está.
    if (decision.tipo === "handoff_sucursal" || decision.tipo === "cerrar_por_limite") {
      await enviarYGuardarMeta(cx, t.canal, t.senderId, decision.texto, ia);
      await upsertConversacionMeta(t.tenant, clave, { ultimoMidAtendido: t.mid });
      await pasarAPersonaMeta(t, "otro", "reservas");
      console.warn(
        `[meta-ia] ${clave} pasa a una persona (${decision.tipo}). Tope: ${limiteDe(cfg.ai.limiteMensajes)} mensajes.`,
      );
      return;
    }

    if (decision.pedirSede) {
      await upsertConversacionMeta(t.tenant, clave, { intentosSucursal: estado.intentosSucursal + 1 });
    }
    if (decision.recienElegida && decision.sucursal) {
      await upsertConversacionMeta(t.tenant, clave, {
        sucursalId: decision.sucursal.id,
        sucursalNombre: decision.sucursal.nombre,
      });
    }

    const historial: TurnoIA[] = sesion.map((m) => ({
      autor: m.direction === "out" ? "staff" : "cliente",
      texto: m.texto,
    }));

    const respuesta = await generarRespuesta(
      historial,
      {
        // La ficha del contacto, con la clave de la conversación como llave
        // (en WhatsApp es el teléfono). Antes en Meta esto no se guardaba.
        onGuardarContacto: async (d) => {
          await upsertContacto({
            from: clave,
            nombre: d.nombre,
            apellido: d.apellido,
            correo: d.correo,
            tags: d.interes ? [d.interes] : undefined,
            tenant: t.tenant,
          });
        },
        onReaccionar: (emoji) =>
          accionEnMensaje(cx, t.canal, t.senderId, { accion: "reaccionar", mid: t.mid, emoji }).then(() => {}),
        onElegirHotel: async (sede) => {
          await upsertConversacionMeta(t.tenant, clave, { sucursalId: sede.id, sucursalNombre: sede.nombre });
        },
        // Socio, pago que no cuadra, reclamo: la IA sale y entra una persona.
        onPasarAPersona: (motivo, area) => pasarAPersonaMeta(t, motivo, area),
      },
      {
        // No hay teléfono en Messenger: el id de la persona cumple el mismo
        // papel para los tickets y el registro de consumo.
        telefono: t.senderId,
        tenantId: t.tenant,
        sucursal: decision.sucursal,
        pedirSede: decision.pedirSede === true,
        clave,
      },
    );

    const mid = await enviarYGuardarMeta(cx, t.canal, t.senderId, sinMarkdown(respuesta.texto), ia);
    // Queda anotado hasta dónde leyó: lo que la persona escriba después de
    // esto (aunque Sofía haya sido la última en hablar) se contesta.
    // Solo si de verdad salió: si Meta rechazó el envío, el mensaje sigue
    // sin contestar y el próximo turno lo vuelve a intentar.
    if (mid) await upsertConversacionMeta(t.tenant, clave, { ultimoMidAtendido: t.mid }).catch(() => {});

    // El consumo se registra AUNQUE falle el envío: los tokens ya se gastaron.
    await registrarConsumo({
      ts: new Date().toISOString(),
      tenant: t.tenant,
      waFrom: `${t.canal}:${t.senderId}`,
      waId: mid,
      modelo: respuesta.modelo,
      uso: respuesta.uso,
      tokensImagen: respuesta.tokensImagen,
      imagenes: respuesta.imagenes,
      llamadas: respuesta.llamadas,
    });
  } catch (e) {
    console.error("[meta-ia] error:", e);
  }
}
