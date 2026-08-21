// La memoria del agente de voz entre llamadas.
//
// Lo que se protege acá es que el agente no suene a fichero. Un dato mal
// fundido (un modelo que se pierde, un "no especificado" que se cuela) termina
// saliendo por el parlante en una llamada real.
import { describe, it, expect } from "vitest";
import {
  contextoParaAgente,
  fundir,
  normalizarTelefono,
  type MemoriaLlamada,
} from "@/lib/memoria-llamadas";

const AHORA = Date.parse("2026-08-21T18:00:00.000Z");
const hace = (dias: number) => new Date(AHORA - dias * 86_400_000).toISOString();

describe("el teléfono como llave", () => {
  it("la misma persona es la misma venga como venga marcada", () => {
    const esperado = "75391721";
    expect(normalizarTelefono("+50375391721")).toBe(esperado);
    expect(normalizarTelefono("50375391721")).toBe(esperado);
    expect(normalizarTelefono("7539-1721")).toBe(esperado);
    expect(normalizarTelefono("7539 1721")).toBe(esperado);
    expect(normalizarTelefono("(503) 7539 1721")).toBe(esperado);
  });

  it("no explota con basura", () => {
    expect(normalizarTelefono("")).toBe("");
    expect(normalizarTelefono("anonimo")).toBe("");
  });
});

describe("fundir lo nuevo con lo viejo", () => {
  const previo: MemoriaLlamada = {
    tenant: "toyota",
    telefono: "75391721",
    nombre: "Roberto Mendoza",
    modelos: ["Rav cuatro"],
    uso: "la familia",
    pago: "financiamiento",
    agendo: false,
    resumen: "Preguntó precios y quedó de pensarlo.",
    llamadas: 1,
    ultima: hace(3),
  };

  it("cuenta la visita y pone los modelos nuevos adelante", () => {
    const m = fundir(previo, { modelos: ["Corolla Cross"] }, { tenant: "toyota", telefono: "75391721", ahora: hace(0) });
    expect(m.llamadas).toBe(2);
    expect(m.modelos).toEqual(["Corolla Cross", "Rav cuatro"]);
  });

  it("un campo vacío NO borra lo que ya se sabía", () => {
    // Que en esta llamada no se hable del uso no significa que haya dejado de
    // ser para la familia.
    const m = fundir(previo, { modelos: ["Hilux"] }, { tenant: "toyota", telefono: "75391721" });
    expect(m.uso).toBe("la familia");
    expect(m.nombre).toBe("Roberto Mendoza");
    expect(m.pago).toBe("financiamiento");
  });

  it("lo nuevo pisa a lo viejo cuando de verdad viene", () => {
    const m = fundir(previo, { uso: "el trabajo", pago: "contado" }, { tenant: "toyota", telefono: "75391721" });
    expect(m.uso).toBe("el trabajo");
    expect(m.pago).toBe("contado");
  });

  it("no repite un modelo que ya estaba", () => {
    const m = fundir(previo, { modelos: ["Rav cuatro"] }, { tenant: "toyota", telefono: "75391721" });
    expect(m.modelos).toEqual(["Rav cuatro"]);
  });

  it("recorta la cola: nadie necesita ocho modelos de hace meses", () => {
    const cargado = { ...previo, modelos: ["A", "B", "C", "D"] };
    const m = fundir(cargado, { modelos: ["E"] }, { tenant: "toyota", telefono: "75391721" });
    expect(m.modelos).toHaveLength(4);
    expect(m.modelos[0]).toBe("E");
  });

  it("la cita agendada no se pierde en la llamada siguiente", () => {
    const conCita = { ...previo, agendo: true };
    const m = fundir(conCita, { modelos: ["Yaris"] }, { tenant: "toyota", telefono: "75391721" });
    expect(m.agendo).toBe(true);
  });

  it("la primera llamada de un número desconocido arranca en uno", () => {
    const m = fundir(null, { nombre: "Ana", modelos: ["Raize"] }, { tenant: "toyota", telefono: "75391721" });
    expect(m.llamadas).toBe(1);
    expect(m.nombre).toBe("Ana");
  });
});

describe("el párrafo que recibe el agente", () => {
  it("con un número nuevo le dice explícitamente que no mencione historial", () => {
    const t = contextoParaAgente(null);
    expect(t).toContain("primera vez");
    expect(t).toContain("no menciones");
  });

  it("arma una frase natural, no una ficha de campos", () => {
    const t = contextoParaAgente(
      {
        tenant: "toyota",
        telefono: "75391721",
        nombre: "Roberto Mendoza",
        modelos: ["Rav cuatro"],
        uso: "la familia",
        pago: "financiamiento",
        agendo: false,
        resumen: "Quedó de pensarlo.",
        llamadas: 2,
        ultima: hace(3),
      },
      AHORA,
    );
    expect(t).toContain("Ya llamó 2 veces");
    expect(t).toContain("hace 3 días");
    expect(t).toContain("Roberto Mendoza");
    expect(t).toContain("Rav cuatro");
    expect(t).toContain("para la familia");
    // Y sobre todo: le recuerda que no lo recite.
    expect(t).toContain("no para que lo recites");
    // Nada de sintaxis de base de datos, que es lo que dispara el tono robótico.
    expect(t).not.toMatch(/[:|]\s*(familia|financiamiento)/);
  });

  it("dice el tiempo como lo diría una persona", () => {
    const base: MemoriaLlamada = {
      tenant: "toyota", telefono: "1", nombre: undefined, modelos: [], uso: undefined,
      pago: undefined, agendo: false, resumen: "", llamadas: 1, ultima: hace(0),
    };
    expect(contextoParaAgente({ ...base, ultima: hace(0) }, AHORA)).toContain("hoy mismo");
    expect(contextoParaAgente({ ...base, ultima: hace(1) }, AHORA)).toContain("ayer");
    expect(contextoParaAgente({ ...base, ultima: hace(4) }, AHORA)).toContain("hace 4 días");
    expect(contextoParaAgente({ ...base, ultima: hace(10) }, AHORA)).toContain("hace una semana");
    expect(contextoParaAgente({ ...base, ultima: hace(70) }, AHORA)).toContain("meses");
  });

  it("omite lo que no sabe en vez de inventar un hueco", () => {
    const t = contextoParaAgente(
      {
        tenant: "toyota", telefono: "1", modelos: ["Hilux"], agendo: false,
        resumen: "", llamadas: 1, ultima: hace(2),
      } as MemoriaLlamada,
      AHORA,
    );
    expect(t).toContain("Hilux");
    expect(t).not.toContain("undefined");
    expect(t).not.toContain("Se llama");
    expect(t).not.toContain("La quería para");
  });

  it("con dos modelos nombra los dos, no una lista larga", () => {
    const t = contextoParaAgente(
      {
        tenant: "toyota", telefono: "1", modelos: ["Rav cuatro", "Corolla Cross", "Hilux"],
        agendo: false, resumen: "", llamadas: 3, ultima: hace(5),
      } as MemoriaLlamada,
      AHORA,
    );
    expect(t).toContain("Rav cuatro y Corolla Cross");
    expect(t).not.toContain("Hilux");
  });
});
