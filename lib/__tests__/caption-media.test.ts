import { describe, it, expect } from "vitest";
import { captionDeMedia } from "../format";

// El webhook guarda el caption de WhatsApp DENTRO del texto, pegado a una marca:
// "[imagen] Tengo estos productos también". La burbuja pinta la foto y hasta hoy
// tiraba el texto entero, así que el caption se perdía en pantalla aunque
// estuviera guardado. Esto separa el caption de la marca.
describe("captionDeMedia", () => {
  it("saca el caption de una imagen y tira la marca", () => {
    expect(captionDeMedia("[imagen] Tengo estos productos también")).toBe(
      "Tengo estos productos también",
    );
  });

  it("una imagen sin caption no deja texto que pintar", () => {
    expect(captionDeMedia("[imagen]")).toBeNull();
  });

  it("hace lo mismo con video", () => {
    expect(captionDeMedia("[video] miren el local")).toBe("miren el local");
    expect(captionDeMedia("[video]")).toBeNull();
  });

  // El nombre del archivo ya lo pinta el enlace del documento: repetirlo abajo
  // sería decir dos veces lo mismo.
  it("un documento no repite el nombre del archivo", () => {
    expect(captionDeMedia("[documento: cotizacion.pdf]")).toBeNull();
  });

  it("audios y stickers nunca traen caption", () => {
    expect(captionDeMedia("[audio]")).toBeNull();
    expect(captionDeMedia("[sticker]")).toBeNull();
  });

  it("aguanta espacios de sobra y saltos de línea", () => {
    expect(captionDeMedia("[imagen]   con espacios  ")).toBe("con espacios");
    expect(captionDeMedia("[imagen]\nen otra linea")).toBe("en otra linea");
  });

  // Un caption escrito por el cliente puede empezar con corchetes. No es una
  // marca nuestra, así que se respeta tal cual.
  it("no confunde corchetes del cliente con una marca", () => {
    expect(captionDeMedia("[URGENTE] revisen esto")).toBe("[URGENTE] revisen esto");
  });

  it("sin texto no hay caption", () => {
    expect(captionDeMedia("")).toBeNull();
    expect(captionDeMedia(undefined)).toBeNull();
  });
});
