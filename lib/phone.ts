// Utilidades puras para formatear numeros de telefono salvadorenos.
// Sin dependencias externas.

// Paises de los clientes del demo, los dos con numeracion local de 8 digitos:
// 503 El Salvador (hospital, Grupo Q, Excel) y 502 Guatemala (el hotel).
// Se listan a proposito en vez de recortar cualquier prefijo: quitarle digitos
// a un numero de otro pais lo dejaria irreconocible.
const PREFIJOS_LOCALES = ["503", "502"];

/**
 * Devuelve los digitos locales (8 digitos) de un waId.
 * Si el numero (solo digitos) empieza con un prefijo conocido y al quitarlo
 * quedan 8 digitos, devuelve esos 8 digitos. Si no, devuelve los digitos tal cual.
 * Ejemplo: "50376294980" -> "76294980", "50257881234" -> "57881234"
 */
export function telefonoLocal(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (digits.length - 3 === 8 && PREFIJOS_LOCALES.some((p) => digits.startsWith(p))) {
    return digits.slice(3);
  }
  return digits;
}

/**
 * Formato visual salvadoreno "7629-4980" (8 digitos con guion en la mitad).
 * Si no son exactamente 8 digitos, devuelve telefonoLocal sin formato.
 * Ejemplo: "50376294980" -> "7629-4980"
 */
export function telefonoBonito(waId: string): string {
  const local = telefonoLocal(waId);
  if (local.length === 8) {
    return `${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return local;
}

/**
 * Normaliza un destino salvadoreno a E.164 (+503XXXXXXXX).
 * Acepta "7539 1721", "7539-1721", "50375391721", "+503 7539 1721".
 * Devuelve null si no queda un numero SV marcable de 8 digitos.
 * Vive aca (y no en lib/vapi) para que la UI pueda validar sin importar el
 * modulo que lee VAPI_PRIVATE_KEY.
 */
export function normalizarDestinoSV(entrada: string): string | null {
  const d = (entrada || "").replace(/\D/g, "");
  const local = d.startsWith("503") && d.length === 11 ? d.slice(3) : d;
  if (local.length !== 8) return null;
  // SV: moviles 6 y 7, fijos 2. Otro prefijo no es marcable.
  if (!/^[267]/.test(local)) return null;
  return `+503${local}`;
}

/**
 * El rango 6 no termina por el trunk de Tigo: auditado 13 de 13 fallidas
 * (SIP 480/503, que Vapi marca como providerfault, o sea lado carrier).
 * No se bloquea, pero se avisa antes de gastar el intento.
 */
export function destinoRiesgoso(e164: string): boolean {
  return /^\+5036/.test(e164);
}
