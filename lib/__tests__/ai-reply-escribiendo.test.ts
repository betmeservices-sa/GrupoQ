// La espera antes de contestar va en dos tramos: primero silencio, y solo
// despues aparece el "escribiendo...". Esto prueba justamente esa frontera,
// porque es la que se rompe sola si alguien reordena el archivo.
//
// Por que importa el orden: si el indicador saliera de una, el cliente lo ve,
// deja de escribir, y perdemos la ventana que abrimos para que terminara.
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WaInbound } from "@/lib/wa-store";
import type { RespuestaIA, TurnoIA } from "@/lib/ai";

let bandeja: WaInbound[] = [];
let seq = 0;
// Bitacora de lo que pasa y en que orden. Es la unica forma de afirmar que el
// "escribiendo" salio ANTES de la respuesta y no al reves.
const eventos: string[] = [];

function entra(texto: string): string {
  const waId = `in-${++seq}`;
  bandeja.push({
    seq,
    waId,
    from: "50370000001",
    texto,
    ts: new Date().toISOString(),
    direccion: "in",
    tenant: "miagentia",
  });
  return waId;
}

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
      tenant: "miagentia",
    });
  },
}));

vi.mock("@/lib/ai-store", () => ({
  getChatAiActiva: async () => true,
  setChatOverride: async () => {},
}));

vi.mock("@/lib/wa-send", () => ({
  enviarTextoWa: async (_to: string, texto: string) => {
    eventos.push(`responde:${texto}`);
    return { ok: true, id: `out-${eventos.length}` };
  },
  mostrarEscribiendo: async () => {
    eventos.push("escribiendo");
  },
  enviarReaccion: async () => {},
}));

vi.mock("@/lib/contacts-store", () => ({ upsertContacto: async () => null }));
vi.mock("@/lib/wa-media", () => ({ descargarImagenParaIA: async () => null }));
vi.mock("@/lib/tokens-store", () => ({ registrarConsumo: async () => {} }));

vi.mock("@/lib/ai", () => ({
  generarRespuesta: async (_h: TurnoIA[]): Promise<RespuestaIA> => ({
    texto: "listo",
    uso: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    modelo: "claude-haiku-4-5",
    llamadas: 1,
    tokensImagen: 0,
    imagenes: 0,
  }),
}));

// Los dos tramos tienen que ser DISTINTOS y medibles, o las pruebas no separan
// el comportamiento nuevo del viejo: el silencio es fijo (40ms) y el resto es
// aleatorio hasta completar 300ms. Asi hay una ventana ancha, entre los 40 y
// los 300, donde el indicador YA salio y la respuesta todavia no.
const SILENCIO_MS = 40;
const TOTAL_MAX_MS = 300;
vi.stubEnv("AI_DELAY_MIN_MS", String(SILENCIO_MS));
vi.stubEnv("AI_DELAY_MAX_MS", String(TOTAL_MAX_MS));

const { programarRespuestaIA } = await import("@/lib/ai-reply");

function correr(waId: string) {
  return programarRespuestaIA({
    from: "50370000001",
    triggerWamid: waId,
    tenant: "miagentia",
  });
}

beforeEach(() => {
  bandeja = [];
  seq = 0;
  eventos.length = 0;
});

describe("el escribiendo... llega despues del silencio", () => {
  it("un mensaje solo: primero el indicador, despues la respuesta", async () => {
    await correr(entra("hola, que precios manejan"));

    expect(eventos).toEqual(["escribiendo", "responde:listo"]);
  });

  it("no aparece durante el silencio, y ya esta puesto apenas termina", async () => {
    const p = correr(entra("hola"));

    // A mitad del tramo de silencio: nada todavia.
    await new Promise((r) => setTimeout(r, SILENCIO_MS / 2));
    expect(eventos).toEqual([]);

    // Pasado el silencio con holgura, el indicador YA salio aunque la respuesta
    // siga pendiente. Esto es lo que no pasaba antes, cuando el indicador
    // esperaba a que se cumpliera la espera COMPLETA.
    await new Promise((r) => setTimeout(r, SILENCIO_MS));
    expect(eventos[0]).toBe("escribiendo");

    await p;
  });

  // El caso que motivo todo: alguien que escribe de a poco.
  it("si el cliente sigue escribiendo durante el silencio, no se le muestra nada", async () => {
    const p = correr(entra("hola"));

    // Llega la segunda parte de la idea mientras seguimos callados.
    await new Promise((r) => setTimeout(r, SILENCIO_MS / 3));
    entra("queria preguntar por los agentes de voz");

    await p;

    // Ni indicador ni respuesta: contesta el handler del mensaje nuevo.
    expect(eventos).toEqual([]);
  });

  // Este es el que separa lo nuevo de lo viejo. Con el codigo anterior el
  // indicador salia despues de la espera entera, asi que un mensaje que llegaba
  // a mitad de camino dejaba la bitacora VACIA. Ahora el indicador ya salio, y
  // lo que se cancela es solo la respuesta.
  it("si escribe despues del silencio, el indicador ya salio pero no se responde", async () => {
    // El segundo tramo es aleatorio, asi que sin fijarlo la prueba a veces
    // alcanzaba a responder antes de la interrupcion. Con random al tope, la
    // ventana va de los 40ms a los ~300ms y la interrupcion cae siempre dentro.
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    try {
      const p = correr(entra("hola"));

      await new Promise((r) => setTimeout(r, SILENCIO_MS * 2));
      entra("perdon, era otra cosa");

      await p;

      expect(eventos).toEqual(["escribiendo"]);
    } finally {
      random.mockRestore();
    }
  });

  it("la rafaga se contesta UNA sola vez, por el ultimo mensaje", async () => {
    const p1 = correr(entra("hola"));
    await new Promise((r) => setTimeout(r, SILENCIO_MS / 3));
    const p2 = correr(entra("es para una clinica"));

    await Promise.all([p1, p2]);

    expect(eventos).toEqual(["escribiendo", "responde:listo"]);
  });

  it("espera al menos el tramo de silencio antes de contestar", async () => {
    const arranque = performance.now();
    await correr(entra("hola"));
    // Solo cota INFERIOR: la de arriba dependeria de la carga de la maquina.
    expect(performance.now() - arranque).toBeGreaterThanOrEqual(SILENCIO_MS);
  });
});
