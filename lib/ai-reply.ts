// Respuesta automática de la IA con "debounce": espera un silencio antes de
// contestar, para que una ráfaga de mensajes del cliente se responda UNA vez.
import { addOutbound, getSince } from "./wa-store";
import { getChatAiActiva } from "./ai-store";
import { upsertContacto } from "./contacts-store";
import { generarRespuesta, type TurnoIA } from "./ai";
import { enviarTextoWa, mostrarEscribiendo, enviarReaccion } from "./wa-send";
import type { TenantId } from "./tenants/types";

// Espera ALEATORIA antes de responder, para que se sienta humano (a veces
// contesta rapido, a veces se tarda). Rango 3-9s: en Vercel Pro la funcion del
// webhook corre hasta 60s (maxDuration=60), asi que la espera + consultas +
// Claude + envio caben de sobra. Ajustable con AI_DELAY_MIN_MS / AI_DELAY_MAX_MS.
const DELAY_MIN_MS = Number(process.env.AI_DELAY_MIN_MS) || 3000;
const DELAY_MAX_MS = Number(process.env.AI_DELAY_MAX_MS) || 9000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function esperaAleatoria(): number {
  const min = Math.min(DELAY_MIN_MS, DELAY_MAX_MS);
  const max = Math.max(DELAY_MIN_MS, DELAY_MAX_MS);
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Tras un hueco largo (default 4h) la conversacion se trata como NUEVA: la IA
// solo ve los mensajes de la "sesion" reciente, no arrastra historial viejo.
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

export async function programarRespuestaIA(opts: {
  from: string;
  triggerWamid: string;
  tenant?: TenantId;
}): Promise<void> {
  try {
    // Activa si: override del chat (si existe) o, si no, el interruptor global.
    if (!(await getChatAiActiva(opts.from))) return;

    await sleep(esperaAleatoria());

    // ¿Sigo siendo el último mensaje de esta conversación? Si llegó uno más nuevo
    // (otra parte de la ráfaga) o ya hay respuesta, me retiro: otro handler responde.
    const conv = (await getSince(0, opts.tenant))
      .filter((m) => m.from === opts.from)
      .sort((a, b) => a.seq - b.seq);
    // Si el ultimo mensaje ya no es mi disparador (llego otro o ya hay respuesta),
    // me retiro. Esto tambien cubre que un humano haya tomado el chat (su mensaje
    // saliente seria el ultimo, con direccion "out").
    const ultimo = conv.at(-1);
    if (!ultimo || ultimo.waId !== opts.triggerWamid || ultimo.direccion !== "in") return;

    // Solo la sesion reciente (tras un hueco largo arranca fresca).
    const historial: TurnoIA[] = sesionReciente(conv).map((m) => ({
      autor: m.direccion === "out" ? "staff" : "cliente",
      texto: m.texto,
    }));
    if (historial.length === 0) return;

    // "escribiendo..." mientras Claude redacta.
    await mostrarEscribiendo(opts.triggerWamid);

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
      },
      { telefono: opts.from, tenantId: opts.tenant },
    );
    const env = await enviarTextoWa(opts.from, respuesta);
    if (env.ok && env.id) {
      await addOutbound({ waId: env.id, to: opts.from, texto: respuesta, ts: new Date().toISOString(), tenant: opts.tenant });
    } else {
      console.error("IA: falló el envío:", env.error);
    }
  } catch (e) {
    console.error("IA error:", e);
  }
}
