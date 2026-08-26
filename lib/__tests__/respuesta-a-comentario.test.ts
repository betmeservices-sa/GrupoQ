// Que la bandeja no muestre conversaciones que no son conversaciones.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { esRespuestaAComentario } from "@/lib/respuesta-a-comentario";

// El texto exacto que dejó Meta en el hilo de Yali, recortado.
const NOTA_DE_META =
  "You are responding to a user comment to a post on your Page. View comment.(https://facebook.com/story.php?story_fbid=123&id=456)";

describe("respuestas privadas a un comentario", () => {
  it("reconoce la nota que deja Meta", () => {
    expect(esRespuestaAComentario(NOTA_DE_META)).toBe(true);
  });

  it("la reconoce también en español", () => {
    // La página puede estar en cualquiera de los dos idiomas.
    expect(esRespuestaAComentario("Estás respondiendo a un comentario de una publicación")).toBe(true);
  });

  it("no se lleva por delante un mensaje de verdad", () => {
    // Alguien puede escribir la palabra "comentario" sin que eso sea una nota
    // de Meta, y ese mensaje sí va en la bandeja.
    expect(esRespuestaAComentario("Vi su comentario en la publicación, tienen disponible?")).toBe(false);
    expect(esRespuestaAComentario("Hola, quiero reservar")).toBe(false);
    expect(esRespuestaAComentario("")).toBe(false);
    expect(esRespuestaAComentario(null)).toBe(false);
  });

  it("el importador usa exactamente las mismas señales", () => {
    // El script es .mjs y no puede importar este .ts, así que las tiene
    // copiadas. Si se separan, los mensajes vuelven a entrar por ahí.
    const script = fs.readFileSync(
      path.join(process.cwd(), "scripts/importar-meta.mjs"),
      "utf8",
    );
    const enElScript = script.match(/RESPUESTA_A_COMENTARIO = \[([\s\S]*?)\]/)?.[1] ?? "";
    const fuente = fs.readFileSync(
      path.join(process.cwd(), "lib/respuesta-a-comentario.ts"),
      "utf8",
    );
    const enLaFuente = fuente.match(/const SENALES = \[([\s\S]*?)\]/)?.[1] ?? "";
    const limpiar = (s: string) => s.replace(/\s|,/g, "");
    expect(enElScript).not.toBe("");
    expect(limpiar(enElScript)).toBe(limpiar(enLaFuente));
  });
});
