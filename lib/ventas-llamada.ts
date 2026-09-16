// Lo que una llamada de Sofía deja escrito en el caso del embudo.
//
// POR QUÉ EXISTE. La llamada de CrediQ existe para averiguar dos cosas: qué
// vehículo quiere y de cuánto la anda pensando. Hasta ahora eso se guardaba en
// la memoria del agente y en la nota de la ficha, pero NO en la solicitud, que
// es lo que mira el vendedor y de donde sale la plata del embudo. Resultado: el
// tablero mostraba leads en cero dólares de gente que sí había dicho su monto
// por teléfono.
//
// QUÉ NO HACE. No pisa nada que ya esté puesto: si alguien escribió el monto a
// mano en la ficha, ese gana. Y no marca el canal, porque de una llamada no se
// puede saber de dónde vino el lead (los canales son WhatsApp, Instagram,
// Facebook y orgánico); inventarlo sería peor que dejarlo sin marcar.

import { comoDinero, montoHablado } from "./monto-hablado";
import { siguienteVendedor } from "./ventas-pipeline";
import { vendedoresDe } from "./ventas-equipo";
import {
  asegurarSolicitud,
  asignarVendedor,
  guardarSolicitud,
  listarSolicitudes,
  marcarContactado,
  registrarEvento,
} from "./ventas-store";

export interface LlamadaAnotada {
  /** Frase corta para la respuesta del webhook: qué quedó y qué no. */
  resumen: string;
  monto: number | null;
  vehiculo: string | null;
}

/**
 * Guarda en la solicitud lo que dejó la llamada.
 *
 * `montoTexto` viene tal como lo oyó el agente ("quince mil", "$12,500"): acá
 * se convierte a número, y si no se puede, se deja sin monto a propósito.
 */
export async function anotarLlamadaEnSolicitud(opciones: {
  tenant: string;
  telefono: string;
  nombre?: string | null;
  vehiculo?: string | null;
  montoTexto?: string | null;
  actor?: string;
}): Promise<LlamadaAnotada> {
  const { tenant, telefono } = opciones;
  const actor = opciones.actor ?? "llamada";
  const monto = montoHablado(opciones.montoTexto);
  const vehiculo = (opciones.vehiculo ?? "").trim() || null;

  // Si la persona nunca pasó por el CSV ni escribió, la llamada la mete al
  // embudo: alguien a quien ya le marcamos y no está en el tablero es alguien
  // que nadie va a volver a tocar.
  const previa = await asegurarSolicitud(tenant, telefono, {
    nombre: opciones.nombre?.trim() || undefined,
    vehiculo,
  });

  const cambios: string[] = [];
  let siguiente = previa;

  if (monto !== null && previa.monto == null) {
    siguiente = { ...siguiente, monto };
    cambios.push(`monto ${comoDinero(monto)}`);
  }
  if (vehiculo && !previa.vehiculo) {
    siguiente = { ...siguiente, vehiculo };
    cambios.push(`vehículo ${vehiculo}`);
  }
  if (!previa.nombre && opciones.nombre?.trim()) {
    siguiente = { ...siguiente, nombre: opciones.nombre.trim() };
  }

  if (cambios.length > 0) {
    await guardarSolicitud({ ...siguiente, actualizado: new Date().toISOString() });
    await registrarEvento(tenant, telefono, "monto", actor, cambios.join(" · "));
  }

  // La llamada ES el primer contacto: si nadie lo había marcado, se marca. Es
  // idempotente, así que una segunda llamada no mueve la fecha.
  await marcarContactado(tenant, telefono, actor);

  // Y SE LE PONE DUEÑO, con el mismo reparto que usa el CSV. Un caso sin
  // vendedor no sale en las barras por vendedor ni cuenta para los plazos de
  // 48 y 72 horas: existe en la base y no lo ve nadie.
  if (!previa.vendedor) {
    const equipo = vendedoresDe(tenant);
    const toca = equipo.length > 0 ? siguienteVendedor(equipo, await listarSolicitudes(tenant)) : null;
    if (toca) await asignarVendedor(tenant, telefono, toca.id, actor, toca.nombre);
  }

  const resumen =
    cambios.length > 0
      ? `anotado en el caso: ${cambios.join(" · ")}`
      : monto === null && !vehiculo
        ? "la llamada no dejó monto ni vehículo"
        : "el caso ya tenía esos datos";

  return { resumen, monto, vehiculo };
}
