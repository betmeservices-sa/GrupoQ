// Respuesta automática de la IA con "debounce": espera un silencio antes de
// contestar, para que una ráfaga de mensajes del cliente se responda UNA vez.
//
// Este archivo EJECUTA; quien DECIDE es lib/sucursal-gate.ts (funciones puras).
// El orden del turno es siempre el mismo:
//   1. ¿la IA está encendida para este chat?
//   2. silencio (MIN) y ¿sigo siendo el último mensaje? (si no, otro contesta)
//   3. "escribiendo..." y el resto de la espera, aleatorio hasta MAX
//   4. ¿sigo siendo el último? (pudo llegar otro durante ese resto)
//   5. ¿qué toca según las barandas? (sucursal obligatoria / tope de mensajes)
//   6. si toca responder: se baja la imagen (si hay), se llama a Claude y se
//      registra el consumo en tokens y en dinero.
import { addOutbound, getSince, type WaInbound } from "./wa-store";
import { getChatAiActiva, setChatOverride } from "./ai-store";
import { upsertContacto } from "./contacts-store";
import { generarRespuesta, type ImagenIA, type TurnoIA } from "./ai";
import { enviarTextoWa, mostrarEscribiendo, enviarReaccion } from "./wa-send";
import { descargarImagenParaIA } from "./wa-media";
import { decidirTurno, limiteDe } from "./sucursal-gate";
import {
  getEstadoSucursal,
  guardarSucursal,
  marcarPreguntaSucursal,
} from "./sucursal-store";
import { registrarConsumo } from "./tokens-store";
import { recibirComprobante, textoComprobanteRecibido } from "./yali-prereservas";
import { paraWhatsApp } from "./negritas";
import { pasarAPersona } from "./pasar-a-persona";
import { TENANTS, DEFAULT_TENANT } from "./tenants";
import type { TenantId } from "./tenants/types";

// La espera antes de responder va en DOS tramos, a proposito:
//
//   1. MIN en SILENCIO (5s), sin mostrarle nada al cliente. Es la ventana para
//      que el que escribe de a poco termine su idea: si llega otro mensaje,
//      este turno se retira sin haber dado señales. Mostrar "escribiendo..."
//      aqui seria contraproducente, porque al verlo la gente deja de escribir
//      y se pierde justo lo que queriamos esperar.
//   2. "escribiendo..." y el RESTO, aleatorio, hasta completar MAX (12s).
//
// El total sigue cayendo uniforme en [MIN, MAX], asi que se siente humano: a
// veces contesta rapido, a veces se tarda. Ajustable con AI_DELAY_MIN_MS y
// AI_DELAY_MAX_MS.
//
// Dos techos que este reparto respeta: el "escribiendo..." de Meta se cae solo
// a los 25s, y aqui vive como mucho (MAX - MIN) mas lo que tarde Claude, o sea
// ~7s mas unos pocos; y la funcion del webhook en Vercel Pro corre hasta 60s
// (maxDuration=60), donde MAX + consultas + Claude + envio caben de sobra.
const DELAY_MIN_MS = Number(process.env.AI_DELAY_MIN_MS) || 5000;
const DELAY_MAX_MS = Number(process.env.AI_DELAY_MAX_MS) || 12000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Sobrante aleatorio DESPUES del tramo de silencio. Si alguien invierte las dos
// variables (MAX menor que MIN), queda en 0 en vez de mandarle un negativo a
// setTimeout.
function restoAleatorio(): number {
  const extra = Math.max(DELAY_MAX_MS - DELAY_MIN_MS, 0);
  return Math.floor(Math.random() * (extra + 1));
}

// ¿El mensaje que me disparo sigue siendo el ultimo de la conversacion? Si
// llego otro (el cliente seguia escribiendo) o ya contesto alguien, este handler
// se retira y responde el mas nuevo. Cubre tambien que un humano haya tomado el
// chat: su mensaje saliente seria el ultimo, con direccion "out".
async function sigoSiendoElUltimo(
  from: string,
  triggerWamid: string,
  tenant?: TenantId,
): Promise<boolean> {
  const ultimo = (await getSince(0, tenant))
    .filter((m) => m.from === from)
    .sort((a, b) => a.seq - b.seq)
    .at(-1);
  return Boolean(ultimo && ultimo.waId === triggerWamid && ultimo.direccion === "in");
}

// Tras un hueco largo (default 4h) la conversacion se trata como NUEVA: la IA
// solo ve los mensajes de la "sesion" reciente, no arrastra historial viejo.
// El tope de mensajes se cuenta sobre esa MISMA sesion: "conversacion" quiere
// decir lo mismo en los dos lados.
const SESION_GAP_MS = (Number(process.env.AI_SESSION_GAP_HORAS) || 4) * 60 * 60 * 1000;

function sesionReciente<T extends { ts: string }>(msgs: T[]): T[] {
  const out: T[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (out.length > 0) {
      const gap = new Date(out[0].ts).getTime() - new Date(msgs[i].ts).getTime();
      if (gap > SESION_GAP_MS) break;
    }
    out.unshift(msgs[i]);
  }
  return out;
}

/** Textos deterministas del agente (sucursal y cierres): no llaman al modelo. */
function esMensajeDeSucursal(texto: string, tenant: TenantId): boolean {
  const s = TENANTS[tenant]?.sucursales;
  if (!s) return false;
  return texto === s.pregunta || texto === s.reintento || texto === s.handoff;
}

export async function programarRespuestaIA(opts: {
  from: string;
  triggerWamid: string;
  tenant?: TenantId;
}): Promise<void> {
  const tenantId: TenantId = opts.tenant ?? DEFAULT_TENANT;
  const cfg = TENANTS[tenantId];

  try {
    // Activa si: override del chat (si existe) o, si no, el interruptor global.
    if (!(await getChatAiActiva(opts.from))) return;

    // Tramo 1: silencio. Le damos tiempo a que termine sin mostrarle nada.
    await sleep(DELAY_MIN_MS);
    if (!(await sigoSiendoElUltimo(opts.from, opts.triggerWamid, opts.tenant))) return;

    // Recien ahora aparece el "escribiendo...". Va aqui y no antes porque Meta
    // pide no mostrarlo si no vas a responder, y hasta este punto no lo sabiamos.
    // Ojo: mostrarlo tambien marca el mensaje como leido (doble check azul).
    await mostrarEscribiendo(opts.triggerWamid);

    // Tramo 2: el resto de la espera, ya con el indicador puesto.
    await sleep(restoAleatorio());

    const conv = (await getSince(0, opts.tenant))
      .filter((m) => m.from === opts.from)
      .sort((a, b) => a.seq - b.seq);
    // Se vuelve a mirar: pudo llegar otro mensaje durante el segundo tramo.
    const ultimo = conv.at(-1);
    if (!ultimo || ultimo.waId !== opts.triggerWamid || ultimo.direccion !== "in") return;

    const sesion = sesionReciente(conv);
    if (sesion.length === 0) return;

    // ── Barandas ──
    const salientes = sesion.filter((m) => m.direccion === "out");
    const estado = await getEstadoSucursal(opts.from);
    const decision = decidirTurno({
      sucursales: cfg.sucursales,
      limite: cfg.ai.limiteMensajes,
      mensajesAgente: salientes.length,
      mensajesSucursal: salientes.filter((m) => esMensajeDeSucursal(m.texto, tenantId)).length,
      sucursalId: estado.sucursalId,
      intentos: estado.intentos,
      textoCliente: ultimo.texto,
    });

    if (decision.tipo === "silencio") return;

    // Pregunta de sucursal: texto fijo, CERO tokens. Solo sale cuando el
    // huésped no dijo nada más que un saludo; si trajo contenido, responde el
    // modelo (ver decidirTurno).
    if (decision.tipo === "preguntar_sucursal") {
      await enviarYGuardar(opts.from, decision.texto, tenantId);
      await marcarPreguntaSucursal(opts.from, tenantId, estado.intentos);
      return;
    }

    // Se acabaron los reintentos o se acabó el cupo: se avisa y pasa a una
    // persona. La IA queda apagada PARA ESTE CHAT (el interruptor global sigue
    // como está y el staff puede reactivarla desde la bandeja).
    if (decision.tipo === "handoff_sucursal" || decision.tipo === "cerrar_por_limite") {
      await enviarYGuardar(opts.from, decision.texto, tenantId);
      await setChatOverride(opts.from, false);
      console.warn(
        `IA: chat ${opts.from} pasa a una persona (${decision.tipo}). Tope: ${limiteDe(cfg.ai.limiteMensajes)} mensajes.`,
      );
      return;
    }

    // Todavía no sabemos la sede y la va a resolver el modelo: se cuenta como
    // un intento igual, para que la red de seguridad del handoff siga contando y
    // nadie quede dando vueltas para siempre.
    if (decision.pedirSede) {
      await marcarPreguntaSucursal(opts.from, tenantId, estado.intentos);
    }

    // El contacto acaba de decir su sucursal: se guarda ANTES de responder, para
    // que no se le vuelva a preguntar aunque este turno falle.
    if (decision.recienElegida && decision.sucursal) {
      await guardarSucursal(
        opts.from,
        tenantId,
        decision.sucursal.id,
        decision.sucursal.nombre,
      );
    }

    // Solo la sesion reciente (tras un hueco largo arranca fresca).
    const historial: TurnoIA[] = sesion.map((m) => ({
      autor: m.direccion === "out" ? "staff" : "cliente",
      texto: m.texto,
    }));

    // Imágenes: se le pasa al modelo la del ÚLTIMO mensaje del contacto (la que
    // disparó el turno). Mandarle todas las del historial multiplicaría el costo
    // de entrada en cada turno siguiente, y lo que se necesita responder es la
    // foto recién enviada.
    // Una foto en un chat con habitación apartada es el comprobante: no lo
    // revisa la IA, pasa a la persona que verifica el pago y confirma.
    if (ultimo.media?.tipo === "image") {
      const apartado = await recibirComprobante(tenantId, `wa:${opts.from}`, { mid: ultimo.waId });
      if (apartado) {
        await enviarYGuardar(opts.from, textoComprobanteRecibido(), tenantId);
        await pasarAPersona(opts.from, "pago", "reservas");
        return;
      }
    }
    const imagenes = await imagenesDelUltimo(ultimo, cfg.ai.imagenes === true);
    if (imagenes.length) historial[historial.length - 1].imagenes = imagenes;

    const respuesta = await generarRespuesta(
      historial,
      {
        onGuardarContacto: async (d) => {
          await upsertContacto({
            from: opts.from,
            nombre: d.nombre,
            apellido: d.apellido,
            correo: d.correo,
            tags: d.interes ? [d.interes] : undefined,
            tenant: opts.tenant,
          });
        },
        onReaccionar: (emoji) => enviarReaccion(opts.from, opts.triggerWamid, emoji),
        // El modelo dedujo de qué hotel habla el huésped: se guarda igual que si
        // lo hubiera contestado a la pregunta fija, para no volver a pedirlo.
        onElegirHotel: async (sede) => {
          await guardarSucursal(opts.from, tenantId, sede.id, sede.nombre);
        },
      },
      {
        telefono: opts.from,
        tenantId: opts.tenant,
        sucursal: decision.sucursal,
        pedirSede: decision.pedirSede === true,
        clave: `wa:${opts.from}`,
      },
    );

    const textoWa = paraWhatsApp(respuesta.texto);
    const env = await enviarTextoWa(opts.from, textoWa);
    if (env.ok && env.id) {
      await addOutbound({
        waId: env.id,
        to: opts.from,
        texto: textoWa,
        ts: new Date().toISOString(),
        tenant: opts.tenant,
      });
    } else {
      console.error("IA: falló el envío:", env.error);
    }

    // El consumo se registra AUNQUE falle el envío: los tokens ya se gastaron.
    await registrarConsumo({
      ts: new Date().toISOString(),
      tenant: tenantId,
      waFrom: opts.from,
      waId: env.ok ? (env.id ?? null) : null,
      modelo: respuesta.modelo,
      uso: respuesta.uso,
      tokensImagen: respuesta.tokensImagen,
      imagenes: respuesta.imagenes,
      llamadas: respuesta.llamadas,
    });
  } catch (e) {
    console.error("IA error:", e);
  }
}

/** Manda un texto fijo del agente y lo deja en el hilo (para que cuente). */
async function enviarYGuardar(from: string, texto: string, tenant: TenantId): Promise<void> {
  const env = await enviarTextoWa(from, texto);
  if (env.ok && env.id) {
    await addOutbound({
      waId: env.id,
      to: from,
      texto,
      ts: new Date().toISOString(),
      tenant,
    });
  } else {
    console.error("IA: falló el envío del mensaje fijo:", env.error);
  }
}

async function imagenesDelUltimo(ultimo: WaInbound, habilitado: boolean): Promise<ImagenIA[]> {
  if (!habilitado || ultimo.media?.tipo !== "image" || !ultimo.media.id) return [];
  const img = await descargarImagenParaIA(ultimo.media.id);
  return img ? [{ base64: img.base64, mime: img.mime }] : [];
}
