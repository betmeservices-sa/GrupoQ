// Imágenes en el chat interno.
//
// Sin Supabase el store cae a memoria, que es justo el camino que se prueba
// acá: alcanza para fijar el contrato de que la imagen viaja junto al mensaje
// y no se pierde por el camino.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getSupabase: () => null }));

const { enviarMensaje, mensajesDesde } = await import("@/lib/interno-store");

const UNA_IMAGEN = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

beforeEach(() => {
  const g = globalThis as unknown as { __interno?: unknown };
  g.__interno = { canales: new Map(), mensajes: [], seq: 0 };
});

describe("mandar imágenes por el chat interno", () => {
  it("guarda la imagen junto al mensaje", async () => {
    const m = await enviarMensaje("yaly", "ic-1", "s2", "", UNA_IMAGEN);
    expect(m?.imagen).toBe(UNA_IMAGEN);
  });

  it("un mensaje sin imagen no inventa una", async () => {
    const m = await enviarMensaje("yaly", "ic-1", "s2", "hola");
    expect(m?.imagen).toBeUndefined();
  });

  it("la imagen sigue ahí cuando el otro lado va a buscar lo nuevo", async () => {
    // Es lo que hace el sondeo cada 4 segundos. Si la imagen se cayera acá, el
    // que la mandó la vería y nadie más.
    await enviarMensaje("yaly", "ic-1", "s3", "mirá esto", UNA_IMAGEN);
    const nuevos = await mensajesDesde("yaly", 0);
    expect(nuevos.at(-1)?.imagen).toBe(UNA_IMAGEN);
  });

  it("deja mandar una imagen sola, sin texto", async () => {
    // Es el caso normal: se pega la captura y después se comenta.
    const m = await enviarMensaje("yaly", "ic-1", "s2", "", UNA_IMAGEN);
    expect(m?.texto).toBe("");
    expect(m?.imagen).toBeTruthy();
  });
});
