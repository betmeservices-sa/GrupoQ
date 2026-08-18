// Prueba de integración del turno completo (lib/ai-reply), con las fronteras de
// red simuladas: Graph API (envío de WhatsApp), Claude y Supabase. Todo lo demás
// es el código real, incluido el store de sucursal en memoria.
//
// Es lo que responde a las tres preguntas que importan:
//   1. ¿el PRIMER mensaje es siempre la pregunta de sucursal?
//   2. ¿el agente se detiene de verdad a los 10 mensajes?
//   3. ¿una foto llega hasta el modelo y se registra su consumo?
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WaInbound } from "@/lib/wa-store";
import type { RespuestaIA, TurnoIA } from "@/lib/ai";

// ── Bandeja falsa (mismo contrato que lib/wa-store) ──
let bandeja: WaInbound[] = [];
let seq = 0;

function entra(texto: string, media?: WaInbound["media"]): string {
  const waId = `in-${++seq}`;
  bandeja.push({
    seq,
    waId,
    from: "50370000001",
    texto,
    ts: new Date().toISOString(),
    direccion: "in",
    tenant: "yaly",
    media,
  });
  return waId;
}

const enviados: string[] = [];

vi.mock("@/lib/wa-store", () => ({
  getSince: async () => bandeja,
  addOutbound: async (m: { waId: string; to: string; texto: string; ts: string }) => {
    bandeja.push({
      seq: ++seq,
      waId: m.waId,
      from: m.to,
      texto: m.texto,
      ts: m.ts,
      direccion: "out",
      tenant: "yaly",
    });
  },
}));

const chatApagado = vi.fn();
vi.mock("@/lib/ai-store", () => ({
  getChatAiActiva: async () => true,
  setChatOverride: async (from: string, activa: boolean) => chatApagado(from, activa),
}));

vi.mock("@/lib/wa-send", () => ({
  enviarTextoWa: async (_to: string, texto: string) => {
    enviados.push(texto);
    return { ok: true, id: `out-${enviados.length}` };
  },
  mostrarEscribiendo: async () => {},
  enviarReaccion: async () => {},
}));

vi.mock("@/lib/contacts-store", () => ({ upsertContacto: async () => null }));

const imagenDescargada = vi.fn();
vi.mock("@/lib/wa-media", () => ({
  descargarImagenParaIA: async (id: string) => {
    imagenDescargada(id);
    return { base64: "ZmFrZQ==", mime: "image/jpeg", bytes: 5 };
  },
}));

const consumos: Array<Record<string, unknown>> = [];
vi.mock("@/lib/tokens-store", () => ({
  registrarConsumo: async (r: Record<string, unknown>) => {
    consumos.push(r);
  },
}));

const llamadasIA: Array<{ historial: TurnoIA[]; sucursal: string | null }> = [];
vi.mock("@/lib/ai", () => ({
  generarRespuesta: async (
    historial: TurnoIA[],
    _acciones: unknown,
    contexto?: { sucursal?: { id: string } | null },
  ): Promise<RespuestaIA> => {
    llamadasIA.push({ historial, sucursal: contexto?.sucursal?.id ?? null });
    return {
      texto: `respuesta ${llamadasIA.length}`,
      uso: {
        input_tokens: 1500,
        output_tokens: 90,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      modelo: "claude-haiku-4-5",
      llamadas: 1,
      tokensImagen: historial.some((t) => t.imagenes?.length) ? 1600 : 0,
      imagenes: historial.reduce((n, t) => n + (t.imagenes?.length ?? 0), 0),
    };
  },
}));

// Casi sin espera: el debounce real haría que cada turno tardara segundos.
// OJO: tiene que ser "1" y no "0", porque ai-reply usa `Number(env) || 5000` y
// el 0 es falsy, así que un 0 se cae al default de 5 segundos.
// Con min == max el segundo tramo queda en 0 y la espera total es de 1ms.
vi.stubEnv("AI_DELAY_MIN_MS", "1");
vi.stubEnv("AI_DELAY_MAX_MS", "1");

const { programarRespuestaIA } = await import("@/lib/ai-reply");
const { borrarEstadoSucursal } = await import("@/lib/sucursal-store");
const { CIERRE_POR_LIMITE } = await import("@/lib/sucursal-gate");
const { yalySucursales } = await import("@/lib/tenants/yaly-sucursales");

/** Un mensaje del huésped y el turno del agente. */
async function turno(texto: string, media?: WaInbound["media"]): Promise<void> {
  const waId = entra(texto, media);
  await programarRespuestaIA({ from: "50370000001", triggerWamid: waId, tenant: "yaly" });
}

beforeEach(async () => {
  bandeja = [];
  seq = 0;
  enviados.length = 0;
  llamadasIA.length = 0;
  consumos.length = 0;
  chatApagado.mockClear();
  imagenDescargada.mockClear();
  await borrarEstadoSucursal("50370000001");
});

describe("el primer mensaje siempre es la pregunta de sucursal", () => {
  it("aunque el huésped pregunte otra cosa, y sin gastar un token", async () => {
    await turno("Hola, quiero una habitación para el sábado");
    expect(enviados).toEqual([yalySucursales.pregunta]);
    expect(llamadasIA).toHaveLength(0); // no se llamó al modelo
    expect(consumos).toHaveLength(0); // por lo tanto no hay consumo
  });

  it("con la sucursal contestada, recién ahí entra la IA y se le pasa la sede", async () => {
    await turno("Hola");
    await turno("la B");
    expect(llamadasIA).toHaveLength(1);
    expect(llamadasIA[0].sucursal).toBe("b");
    expect(enviados[1]).toBe("respuesta 1");
  });

  it("no se vuelve a preguntar en los turnos siguientes", async () => {
    await turno("Hola");
    await turno("A");
    await turno("¿Cuánto cuesta la noche?");
    await turno("¿Y tienen parqueo?");
    const preguntas = enviados.filter((t) => t === yalySucursales.pregunta);
    expect(preguntas).toHaveLength(1);
    expect(llamadasIA.every((l) => l.sucursal === "a")).toBe(true);
  });

  it("una respuesta que no se entiende se reformula y después pasa a una persona", async () => {
    await turno("Hola");
    await turno("mmm");
    await turno("no sé");
    await turno("ninguna idea");
    expect(enviados[0]).toBe(yalySucursales.pregunta);
    expect(enviados[1]).toBe(yalySucursales.reintento);
    expect(enviados[2]).toBe(yalySucursales.reintento);
    expect(enviados[3]).toBe(yalySucursales.handoff);
    expect(chatApagado).toHaveBeenCalledWith("50370000001", false);
    expect(llamadasIA).toHaveLength(0);
  });
});

describe("tope duro de 10 mensajes por conversación", () => {
  it("manda 10 y ni uno más, y el último avisa que pasa a una persona", async () => {
    await turno("Hola");
    await turno("C");
    for (let i = 0; i < 20; i++) await turno(`pregunta ${i}`);

    expect(enviados).toHaveLength(10);
    expect(enviados[0]).toBe(yalySucursales.pregunta);
    expect(enviados.at(-1)).toBe(CIERRE_POR_LIMITE);
    // La pregunta de sucursal cuenta: quedan 8 respuestas de la IA + el cierre.
    expect(llamadasIA).toHaveLength(8);
    expect(chatApagado).toHaveBeenCalledWith("50370000001", false);
  });

  it("después del cierre el agente se calla (no gasta más tokens)", async () => {
    await turno("Hola");
    await turno("C");
    for (let i = 0; i < 20; i++) await turno(`pregunta ${i}`);
    const enviadosTrasCierre = enviados.length;
    const consumoTrasCierre = consumos.length;

    await turno("¿hola? ¿sigue ahí?");
    expect(enviados).toHaveLength(enviadosTrasCierre);
    expect(consumos).toHaveLength(consumoTrasCierre);
  });
});

describe("imágenes", () => {
  const foto = { id: "media-123", tipo: "image", mime: "image/jpeg" };

  it("una foto se baja y llega al modelo junto al texto del mensaje", async () => {
    await turno("Hola");
    await turno("A");
    await turno("[imagen] ¿tienen esta habitación?", foto);

    expect(imagenDescargada).toHaveBeenCalledWith("media-123");
    const ultima = llamadasIA.at(-1)!;
    const turnoConFoto = ultima.historial.at(-1)!;
    expect(turnoConFoto.imagenes).toHaveLength(1);
    expect(turnoConFoto.imagenes![0].mime).toBe("image/jpeg");
    expect(turnoConFoto.texto).toContain("¿tienen esta habitación?");
  });

  it("solo viaja la foto del último mensaje, no todo el álbum del historial", async () => {
    await turno("Hola");
    await turno("A");
    await turno("[imagen] la primera", foto);
    await turno("[imagen] la segunda", { ...foto, id: "media-456" });

    const ultima = llamadasIA.at(-1)!;
    const conImagen = ultima.historial.filter((t) => t.imagenes?.length);
    expect(conImagen).toHaveLength(1);
    expect(ultima.historial.at(-1)!.imagenes).toHaveLength(1);
  });

  it("el consumo del turno con foto separa los tokens de imagen", async () => {
    await turno("Hola");
    await turno("A");
    await turno("[imagen] mire esto", foto);

    const ultimo = consumos.at(-1)!;
    expect(ultimo.tokensImagen).toBe(1600);
    expect(ultimo.imagenes).toBe(1);
    expect(ultimo.modelo).toBe("claude-haiku-4-5");
    expect(ultimo.tenant).toBe("yaly");
    expect(ultimo.waFrom).toBe("50370000001");
  });

  it("un turno de solo texto no reporta tokens de imagen", async () => {
    await turno("Hola");
    await turno("A");
    await turno("¿cuánto cuesta?");
    expect(imagenDescargada).not.toHaveBeenCalled();
    expect(consumos.at(-1)!.tokensImagen).toBe(0);
    expect(consumos.at(-1)!.imagenes).toBe(0);
  });
});

describe("registro del consumo", () => {
  it("cada respuesta de la IA deja su registro, con modelo y los cuatro campos de usage", async () => {
    await turno("Hola");
    await turno("A");
    await turno("una pregunta");
    await turno("otra pregunta");

    expect(consumos).toHaveLength(3); // los 3 turnos que llamaron al modelo
    for (const c of consumos) {
      expect(c.modelo).toBe("claude-haiku-4-5");
      expect(c.uso).toMatchObject({
        input_tokens: expect.any(Number),
        output_tokens: expect.any(Number),
        cache_creation_input_tokens: expect.any(Number),
        cache_read_input_tokens: expect.any(Number),
      });
      expect(c.llamadas).toBe(1);
    }
  });

  it("los mensajes fijos (sucursal y cierre) no generan consumo", async () => {
    await turno("Hola");
    expect(consumos).toHaveLength(0);
  });
});
