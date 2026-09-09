// Marca cuando la persona lo pide por escrito, con lo que ya se habló encima.
//
// Acá se ejecuta lo que decide lib/pedido-de-llamada.ts, que es puro. La
// separación no es estética: la decisión hay que poder probarla sin red, sin
// reloj y sin gastar una llamada, y esto de acá no se puede probar de otra
// forma que llamándole a alguien.
//
// EL ORDEN IMPORTA Y ES ESTE:
//   1. se le avisa por escrito que ya se le marca;
//   2. recién ahí se marca.
//
// Al revés, si el aviso falla la persona recibe una llamada de la nada; y si la
// llamada falla después del aviso, al menos quedó dicho por escrito y alguien
// puede retomarlo. Además el aviso es la marca que impide marcar dos veces por
// el mismo pedido, así que tiene que quedar ANTES de que exista la llamada.

import { getContacto } from "./contacts-store";
import { getConversaciones } from "./conv-store";
import { normalizarTelefono } from "./memoria-llamadas";
import { normalizarDestinoSV } from "./phone";
import { decidirLlamada, pideLlamada, type MensajeDelHilo } from "./pedido-de-llamada";
import { assistantCampanasDeTenant, esDelTenant } from "./tenants/voz";
import type { TenantId } from "./tenants/types";
import { fetchVapiAgentes, hayLlaveVapi, lanzarLlamadaVapi } from "./vapi";
import { enviarTextoWa } from "./wa-send";
import { addOutbound, mensajesAnteriores } from "./wa-store";

/** Cuántos mensajes del hilo se le llevan al agente. */
const HILO = 20;

/** La hora de El Salvador, que es la que importa para no despertar a nadie. */
function horaSV(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/El_Salvador",
      hour: "numeric",
      hour12: false,
    }).format(d),
  );
}

/**
 * Mira el mensaje que acaba de llegar y, si pide una llamada, la hace.
 *
 * Devuelve una frase corta para el log. Sirve sobre todo para ver por qué NO se
 * llamó, que es lo que uno necesita cuando alguien reclama que pidió una
 * llamada y nunca sonó el teléfono.
 */
export async function atenderPedidoDeLlamada(opts: {
  tenant: TenantId;
  telefono: string;
  texto: string;
}): Promise<string> {
  const { tenant, telefono, texto } = opts;

  // Descarte barato ANTES de ir a la base: el 99% de los mensajes no pide nada
  // y no tiene sentido leerle el hilo entero a cada uno.
  if (!pideLlamada(texto)) return "no lo pidió";

  const [{ mensajes }, convs, ficha] = await Promise.all([
    mensajesAnteriores(telefono, null, HILO, tenant),
    getConversaciones(),
    getContacto(normalizarTelefono(telefono)).catch(() => null),
  ]);

  const hilo: MensajeDelHilo[] = mensajes.map((m) => ({
    direction: m.direccion,
    texto: m.texto ?? "",
    ts: m.ts,
  }));

  const decision = decidirLlamada({
    texto,
    telefono,
    nombre: [ficha?.nombre, ficha?.apellido].filter(Boolean).join(" ").trim() || null,
    hilo,
    sinDueno: !convs.find((c) => c.wa_from === telefono)?.asignado_a,
    ahora: new Date(),
    horaLocal: horaSV(new Date()),
  });

  if (!decision.llamar) return `no se llamó: ${decision.motivo}`;

  if (!hayLlaveVapi()) return "no se llamó: falta VAPI_PRIVATE_KEY (modo demostración)";
  const assistantId = assistantCampanasDeTenant(tenant);
  if (!assistantId || !esDelTenant(assistantId, tenant)) {
    return "no se llamó: este cliente no tiene agente de voz";
  }

  const destino = normalizarDestinoSV(telefono);
  if (!destino) return `no se llamó: ${telefono} no es marcable`;

  const agentes = await fetchVapiAgentes();
  const phoneNumberId = (
    agentes.find((a) => a.id === assistantId)?.numeros ??
    agentes.filter((a) => esDelTenant(a.id, tenant)).flatMap((a) => a.numeros)
  )[0]?.id;
  if (!phoneNumberId) return "no se llamó: no hay ninguna línea para marcar";

  // 1. El aviso por escrito. Va primero, y si falla no se marca: una llamada
  // que llega sin haber dicho nada es peor que una llamada que no llega.
  const aviso = await enviarTextoWa(telefono, decision.aviso, { tenant });
  if (!aviso.ok) return `no se llamó: no se pudo avisar por escrito (${aviso.error ?? "sin detalle"})`;
  if (aviso.id) {
    await addOutbound({
      waId: aviso.id,
      to: telefono,
      texto: decision.aviso,
      ts: new Date().toISOString(),
      tenant,
    });
  }

  // 2. La llamada, con el chat encima. El agente recibe `contexto` con el
  // diálogo tal cual y `primerMensaje` para no presentarse desde cero a quien
  // acaba de escribir pidiendo que le marquen.
  try {
    const llamada = await lanzarLlamadaVapi({
      assistantId,
      phoneNumberId,
      numero: destino,
      variables: {
        nombre: [ficha?.nombre, ficha?.apellido].filter(Boolean).join(" ").trim() || "no disponible",
        contexto: decision.contexto || "no disponible",
        pidio_llamada: "si",
      },
      primerMensaje: decision.primerMensaje,
    });
    console.log(`[pedido-llamada] ${telefono}: marcando (${llamada.id ?? "sin id"}).`);
    return "llamando";
  } catch (e) {
    // El aviso ya salió. No se borra: la persona sabe que la íbamos a llamar y
    // el chat queda para que alguien lo retome, que es mejor que el silencio.
    console.error("[pedido-llamada] no salió la llamada:", e);
    return `avisado pero la llamada falló: ${e instanceof Error ? e.message : "error"}`;
  }
}
