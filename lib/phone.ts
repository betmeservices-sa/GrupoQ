// Utilidades puras para formatear numeros de telefono salvadorenos.
// Sin dependencias externas.

/**
 * Devuelve los digitos locales (8 digitos) de un waId salvadoreno.
 * Si el numero (solo digitos) empieza con "503" y al quitarlo quedan 8 digitos,
 * devuelve esos 8 digitos. Si no, devuelve los digitos tal cual.
 * Ejemplo: "50376294980" -> "76294980"
 */
export function telefonoLocal(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  if (digits.startsWith("503") && digits.length - 3 === 8) {
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
