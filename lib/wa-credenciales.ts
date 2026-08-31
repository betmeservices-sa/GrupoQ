// Con qué número y qué token habla cada cliente por WhatsApp.
//
// Dos fuentes, en este orden:
//   1. El número que el cliente conectó desde su panel (wa_connections).
//   2. El número de la demo, el de las variables de entorno. Pero SOLO para el
//      cliente al que el interruptor global lo tiene apuntado.
//
// Lo segundo importa más de lo que parece. Antes cualquier cliente sin número
// propio terminaba mandando desde el de la demo, porque era el único que
// había. Así fue como los enlaces de Yali apuntaban a un número que no era el
// suyo. Un cliente sin número conectado no manda nada, y se le dice.

import { conexionesWaDe, conexionPorPhoneNumberId } from "./wa-conexiones-store";
import { getWaTenant } from "./wa-routing";

export interface CredencialesWa {
  token: string;
  phoneId: string;
  wabaId: string | null;
  /** De dónde salieron: el número del cliente, o el de la demo. */
  origen: "cliente" | "demo";
}

function deEnv(): CredencialesWa | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return null;
  return { token, phoneId, wabaId: process.env.WHATSAPP_WABA_ID ?? null, origen: "demo" };
}

/**
 * Las credenciales para hablar en nombre de un cliente, o null si no tiene
 * número. Sin tenant se devuelve el de la demo, que es lo que hacía siempre.
 */
export async function credencialesWa(tenant?: string): Promise<CredencialesWa | null> {
  if (!tenant) return deEnv();

  const propias = await conexionesWaDe(tenant);
  if (propias.length > 0) {
    const c = propias[0];
    return { token: c.accessToken, phoneId: c.phoneNumberId, wabaId: c.wabaId, origen: "cliente" };
  }

  // El número de la demo es de un solo cliente a la vez: el que diga el
  // interruptor. Para los demás, no hay número.
  const env = deEnv();
  if (!env) return null;
  return (await getWaTenant()) === tenant ? env : null;
}

/**
 * Las credenciales del número al que LLEGÓ un mensaje, para contestar por el
 * mismo. Si no es de ningún cliente, es el de la demo.
 */
export async function credencialesPorNumero(phoneNumberId: string): Promise<CredencialesWa | null> {
  const cx = await conexionPorPhoneNumberId(phoneNumberId);
  if (cx) return { token: cx.accessToken, phoneId: cx.phoneNumberId, wabaId: cx.wabaId, origen: "cliente" };
  const env = deEnv();
  return env && env.phoneId === phoneNumberId ? env : null;
}
