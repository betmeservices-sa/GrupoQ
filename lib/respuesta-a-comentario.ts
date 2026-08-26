// Respuestas privadas a un comentario, que no son conversaciones.
//
// Cuando alguien del hotel contesta en privado un comentario de una
// publicación, Meta deja en el hilo de Messenger un mensaje que no escribió
// nadie:
//
//   "You are responding to a user comment to a post on your Page. View
//    comment.(https://facebook.com/story.php?story_fbid=...)"
//
// No es un mensaje: es una nota de Meta para sí mismo. En la bandeja aparecía
// como una conversación con esa persona, en inglés, sin nada que contestar. Eso
// pertenece a Comentarios, no a la bandeja.
//
// El texto llega en el idioma de la página, así que se reconoce por la forma y
// no por la frase exacta: en los dos idiomas dice "comment"/"comentario" junto
// al enlace de la publicación.

const SENALES = [
  /responding to a user comment/i,
  /respondiendo a un comentario/i,
  /est[aá]s respondiendo.{0,40}comentario/i,
];

/**
 * ¿Este mensaje es la nota que deja Meta al contestar un comentario?
 *
 * Se usa en los dos lados: al importar el historial y al recibir por webhook.
 * Si solo se filtrara en uno, volverían a entrar por el otro.
 */
export function esRespuestaAComentario(texto: string | null | undefined): boolean {
  if (!texto) return false;
  return SENALES.some((s) => s.test(texto));
}
