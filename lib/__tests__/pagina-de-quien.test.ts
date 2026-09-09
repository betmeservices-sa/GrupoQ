// Que una página de un cliente no se le pueda colgar a otro.
//
// EL INCIDENTE QUE ESTO FIJA (9 de septiembre de 2026): alguien abrió "Conectar
// Facebook e Instagram" con la sesión en MiAgentIA y marcó las páginas de Yali.
// Quedaron colgadas de dos clientes, la baranda que mira el tenant dejó de
// aplicar, y el agente del demo le escribió a una persona real de Sunzal Beach
// Club ofreciéndole agentes de IA.

import { describe, expect, it } from "vitest";
import { dueno, enDisputa, repartirPaginas } from "@/lib/pagina-de-quien";

const YALI = { tenant: "yaly", connectedAt: "2026-08-25T15:43:07.235Z" };
const AGENCIA = { tenant: "miagentia", connectedAt: "2026-09-09T23:34:48.465Z" };

describe("quién manda cuando dos clientes se disputan la página", () => {
  it("el que la conectó primero", () => {
    // Es el caso exacto del incidente: Yali la tenía desde agosto y la agencia
    // se la colgó encima en septiembre.
    expect(dueno([AGENCIA, YALI])?.tenant).toBe("yaly");
    expect(dueno([YALI, AGENCIA])?.tenant).toBe("yaly");
  });

  it("una sola, esa", () => {
    expect(dueno([YALI])?.tenant).toBe("yaly");
  });

  it("ninguna, null", () => {
    expect(dueno([])).toBeNull();
  });

  it("sin fecha no gana: una fila vieja sin dato no puede desbancar a la que sí la tiene", () => {
    expect(dueno([{ tenant: "sin-fecha" }, YALI])?.tenant).toBe("yaly");
    expect(dueno([YALI, { tenant: "sin-fecha" }])?.tenant).toBe("yaly");
  });

  it("todas sin fecha: la primera, que al menos es estable", () => {
    expect(dueno([{ tenant: "a" }, { tenant: "b" }])?.tenant).toBe("a");
  });
});

describe("cuándo hay que gritar", () => {
  it("dos clientes distintos es disputa", () => {
    expect(enDisputa([YALI, AGENCIA])).toBe(true);
  });

  it("la MISMA página del MISMO cliente en dos esquemas es normal", () => {
    // Pasa hoy con Yali: sus páginas están en el esquema del demo y en el suyo.
    // Gritar por eso sería ruido en cada mensaje que entra.
    expect(enDisputa([YALI, { tenant: "yaly", connectedAt: "2026-08-27T20:03:35.875Z" }])).toBe(false);
  });

  it("una sola no es disputa, y ninguna tampoco", () => {
    expect(enDisputa([YALI])).toBe(false);
    expect(enDisputa([])).toBe(false);
  });
});

describe("qué se conecta y qué se rechaza", () => {
  const PAGINAS = [
    { id: "1267828133070405", name: "Miagentia" },
    { id: "108604138639295", name: "YALI Hotel & Resort" },
    { id: "102312199319604", name: "Playa Linda" },
  ];
  const DE = (id: string) => (id === "108604138639295" || id === "102312199319604" ? "yaly" : null);

  it("las de otro cliente NO se conectan", () => {
    const r = repartirPaginas(PAGINAS, "miagentia", DE);
    expect(r.propias.map((p) => p.name)).toEqual(["Miagentia"]);
    expect(r.ajenas.map((a) => `${a.pagina.name} es de ${a.de}`)).toEqual([
      "YALI Hotel & Resort es de yaly",
      "Playa Linda es de yaly",
    ]);
  });

  it("reconectar las PROPIAS sigue funcionando", () => {
    // Reconectar es lo normal cuando vence un token. Si esto se rompiera, la
    // baranda dejaría a los clientes sin poder arreglar su propia conexión.
    const r = repartirPaginas(PAGINAS, "yaly", DE);
    expect(r.propias.map((p) => p.name)).toEqual([
      "Miagentia",
      "YALI Hotel & Resort",
      "Playa Linda",
    ]);
    expect(r.ajenas).toHaveLength(0);
  });

  it("una página libre la puede tomar cualquiera", () => {
    const r = repartirPaginas([{ id: "999", name: "Nueva" }], "excel", () => null);
    expect(r.propias).toHaveLength(1);
  });

  it("si TODAS son ajenas, no queda ninguna que conectar", () => {
    const r = repartirPaginas(PAGINAS.slice(1), "miagentia", DE);
    expect(r.propias).toHaveLength(0);
    expect(r.ajenas).toHaveLength(2);
  });
});
