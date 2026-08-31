// A qué número llegó un aviso de WhatsApp.
//
// Meta lo manda en entry[].changes[].value.metadata.phone_number_id. Con eso
// se sabe de qué cliente es el mensaje sin depender del interruptor global.

export function phoneNumberIdDe(payload: unknown): string | null {
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const meta = (change as { value?: { metadata?: { phone_number_id?: string } } })?.value
        ?.metadata;
      if (meta?.phone_number_id) return String(meta.phone_number_id);
    }
  }
  return null;
}
