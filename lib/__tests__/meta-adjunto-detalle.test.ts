import { describe, expect, it } from "vitest";
import { MARCA_HISTORIA_VENCIDA, marcaDesdeDetalle } from "../meta-adjunto-detalle";

describe("marcaDesdeDetalle", () => {
  it("una respuesta a una historia que venció trae un share a facebook.com sin texto", () => {
    // Forma exacta de Meta para el mensaje de Ilcia Bruno del 28 de junio de 2026.
    const m = marcaDesdeDetalle({
      message: "",
      shares: { data: [{ link: "https://www.facebook.com/photo.php?fbid=993252560182028", name: "YALI Hotel & Resort agregó una foto nueva — en YALI Hotel & Resort." }] },
    });
    expect(m).toBe(`${MARCA_HISTORIA_VENCIDA} YALI Hotel & Resort agregó una foto nueva — en YALI Hotel & Resort.`);
  });

  it("un enlace externo compartido, un archivo con mime, o nada", () => {
    expect(marcaDesdeDetalle({ shares: { data: [{ link: "https://booking.com/x", name: "Booking" }] } })).toBe("[compartió un enlace] Booking\nhttps://booking.com/x");
    expect(marcaDesdeDetalle({ attachments: { data: [{ mime_type: "image/jpeg" }] } })).toBe("[imagen]");
    expect(marcaDesdeDetalle({ attachments: { data: [{ mime_type: "application/pdf", name: "recibo.pdf" }] } })).toBe("[archivo] recibo.pdf");
    expect(marcaDesdeDetalle({ message: "hola" })).toBe("hola");
    expect(marcaDesdeDetalle({})).toBeNull();
  });
});
