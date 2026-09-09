// El recordatorio de WhatsApp a los 5 minutos, para quien no contestó.
//
// Al colgar la llamada de CrediQ sale `crediq_seguimiento_requisitos` con los
// cuatro papeles. A quien no contesta ese, cinco minutos después le llega
// `crediq_continuar_solicitud`, que no repite la lista y le baja el escalón:
// "empiece por el que tenga a la mano".
//
// POR QUÉ UN CRON Y NO UN TEMPORIZADOR. El webhook de fin de llamada vive 30
// segundos; esperar cinco minutos ahí no es una opción. Y un temporizador en
// memoria se pierde en el siguiente despliegue, justo con la gente que estaba
// esperando.
//
// Corre cada 2 minutos, así que el recordatorio cae entre los 5 y los 7 minutos.
// La decisión de a quién le toca es pura y está en lib/plantilla-tras-llamada.ts.
//
// SE PUEDE MIRAR SIN MANDAR NADA: ?seco=1 dice a quién le tocaría y por qué.

import { NextResponse } from "next/server";
import { getContacto } from "@/lib/contacts-store";
import { normalizarTelefono } from "@/lib/memoria-llamadas";
import { normalizarDestinoSV } from "@/lib/phone";
import { CONTINUAR, REQUISITOS, decidirRecordatorio } from "@/lib/plantilla-tras-llamada";
import { enviarPlantilla } from "@/lib/wa-send";
import { addOutbound, mensajesAnteriores, ultimoPorConversacion } from "@/lib/wa-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** El cliente cuyo agente promete el WhatsApp. */
const TENANT = "grupoq";

/** Cuántos mensajes del hilo se miran. Alcanza de sobra para ver la plantilla. */
const HILO = 30;

export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secreto || auth !== `Bearer ${secreto}`) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const seco = new URL(req.url).searchParams.get("seco") === "1";
  const ahora = new Date();

  const conversaciones = await ultimoPorConversacion(TENANT);
  const enviados: string[] = [];
  const saltados: Record<string, number> = {};
  let errores = 0;

  for (const c of Object.values(conversaciones)) {
    const telefono = c.from;
    try {
      // Descarte barato antes de ir a buscar el hilo: si el último mensaje no
      // es nuestro, o no es la plantilla de requisitos, no hay nada que hacer.
      if (!c.texto?.includes(REQUISITOS.marca)) continue;

      const { mensajes } = await mensajesAnteriores(telefono, null, HILO, TENANT);
      const ficha = await getContacto(normalizarTelefono(telefono)).catch(() => null);

      const decision = decidirRecordatorio({
        telefono,
        nombre: [ficha?.nombre, ficha?.apellido].filter(Boolean).join(" ").trim() || null,
        hilo: mensajes.map((m) => ({ direction: m.direccion, texto: m.texto ?? "", ts: m.ts })),
        ahora,
      });

      if (!decision.enviar) {
        saltados[decision.motivo] = (saltados[decision.motivo] ?? 0) + 1;
        continue;
      }

      if (seco) {
        enviados.push(`[SECO] ${telefono}: ${decision.plantilla}`);
        continue;
      }

      const destino = normalizarDestinoSV(telefono)?.replace(/\D/g, "") ?? telefono;
      const env = await enviarPlantilla(destino, decision.plantilla, decision.idioma, [decision.nombre], {
        tenant: TENANT,
      });
      if (!env.ok) {
        errores++;
        console.error(`[recordatorio] ${telefono}: ${env.error}`);
        continue;
      }
      if (env.id) {
        await addOutbound({
          waId: env.id,
          to: destino,
          texto: decision.texto,
          ts: new Date().toISOString(),
          tenant: TENANT,
        });
      }
      enviados.push(telefono);
      console.log(`[recordatorio] ${telefono}: enviado ${CONTINUAR.nombre}.`);
    } catch (e) {
      errores++;
      console.error("[recordatorio]", telefono, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({
    ok: true,
    seco,
    revisadas: Object.keys(conversaciones).length,
    enviados: enviados.length,
    detalle: enviados,
    // Por qué NO se le escribió al resto. Un barrido que no explica sus
    // silencios no se puede depurar.
    saltados,
    errores,
  });
}
