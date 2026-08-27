// Las negritas del modelo, canal por canal.
//
// El modelo escribe **así** (markdown). WhatsApp entiende *así* (un asterisco);
// Messenger e Instagram no entienden nada y muestran los asteriscos tal cual,
// que es lo que se vio en la primera prueba del guion. El guion pide sin
// markdown, pero esto es lo que garantiza que no salga.

/** Para Messenger e Instagram: sin asteriscos ni marcas. */
export function sinMarkdown(texto: string): string {
  return texto
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[\s(¡¿"'])\*(?!\s)([^*\n]+?)\*(?=$|[\s.,;:!?)"'])/gm, "$1$2")
    .replace(/__(.+?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•]\s+/gm, "• ");
}

/** Para WhatsApp: **negrita** de markdown → *negrita* de WhatsApp. */
export function paraWhatsApp(texto: string): string {
  return texto.replace(/\*\*(.+?)\*\*/g, "*$1*").replace(/^#{1,6}\s+/gm, "");
}
