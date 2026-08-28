// El último mensaje que escribió la PERSONA en un hilo (no el último mensaje).
//
// Sofía no funciona por turnos. Si la persona escribe justo después de que
// Sofía respondió (o mientras estaba redactando), ese mensaje es nuevo y hay
// que contestarlo aunque el último mensaje del hilo sea nuestro. Por eso lo
// que se mira es "¿cuál fue lo último que dijo la persona?" y "¿ya se le
// contestó a eso?", nunca "¿quién habló último?".

export function ultimoEntrante<T extends { direction?: string; direccion?: string }>(msgs: T[]): T | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if ((m.direction ?? m.direccion) === "in") return m;
  }
  return null;
}
