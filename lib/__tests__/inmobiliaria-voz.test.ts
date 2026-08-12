// La bola de nieve del dictado, que es lo que le salió al agente en su teléfono:
//
//   es una / es una casa / es una casa de / es una casa de 600 / ...
//
// Todos los eventos de acá están armados a mano, tal como los manda
// SpeechRecognition (y como los manda MAL en Android, que reenvía la frase que
// crece y encima la marca como definitiva).
import { describe, it, expect } from "vitest";
import { crearAcumulador, fusionar, unirFrases, type EventoVoz } from "@/lib/inmobiliaria-voz";
import { extraerDeDictado } from "@/lib/inmobiliaria-dictado";

const FRASE =
  "es una casa de 600 varas cuadradas con cinco cuartos, tres baños completos, tiene piscina, cochera para cinco vehículos, está en una zona de alta plusvalía, tiene centros comerciales cerca como Super Selectos";

// Un evento del motor: por cada tramo, lo que se oyó y si ya es definitivo.
function evento(resultIndex: number, tramos: Array<[string, boolean]>): EventoVoz {
  return {
    resultIndex,
    results: tramos.map(([transcript, isFinal]) =>
      Object.assign([{ transcript }], { isFinal }),
    ),
  };
}

// La frase como la va soltando el motor: una palabra más en cada evento.
function creciendo(frase: string): string[] {
  const palabras = frase.split(" ");
  return palabras.map((_, i) => palabras.slice(0, i + 1).join(" "));
}

function cuenta(texto: string, aguja: string): number {
  return texto.split(aguja).length - 1;
}

describe("los parciales no se acumulan", () => {
  it("la frase que crece queda UNA sola vez, no pegada veinte veces", () => {
    const a = crearAcumulador();
    let texto = "";
    const partes = creciendo(FRASE);
    partes.forEach((parte, i) => {
      texto = a.recibir(evento(0, [[parte, i === partes.length - 1]]));
    });

    expect(texto).toBe(FRASE);
    expect(cuenta(texto, "es una casa")).toBe(1);
    expect(cuenta(texto, "cinco cuartos")).toBe(1);
    expect(cuenta(texto, "Super Selectos")).toBe(1);
  });

  it("Android manda cada parcial ya marcado como definitivo y tampoco se duplica", () => {
    const a = crearAcumulador();
    let texto = "";
    for (const parte of creciendo(FRASE)) {
      texto = a.recibir(evento(0, [[parte, true]]));
    }
    expect(texto).toBe(FRASE);
    expect(cuenta(texto, "es una casa")).toBe(1);
  });

  it("y si además le da un índice nuevo a cada reenvío, sigue quedando una vez", () => {
    // La variante fea: cada reenvío entra como un resultado APARTE y definitivo,
    // así que la lista guarda "es", "es una", "es una casa"... todas juntas.
    const a = crearAcumulador();
    const partes = creciendo(FRASE);
    let texto = "";
    partes.forEach((_, i) => {
      const hasta = partes.slice(0, i + 1).map((p) => [p, true] as [string, boolean]);
      texto = a.recibir(evento(i, hasta));
    });
    expect(texto).toBe(FRASE);
    expect(cuenta(texto, "es una casa")).toBe(1);
  });

  it("el provisional se reemplaza: mientras habla se ve, y al cerrar no se repite", () => {
    const a = crearAcumulador();
    a.recibir(evento(0, [["casa de tres", false]]));
    expect(a.texto()).toBe("casa de tres");
    a.recibir(evento(0, [["casa de tres cuartos", false]]));
    expect(a.texto()).toBe("casa de tres cuartos");
    const texto = a.recibir(evento(0, [["casa de tres cuartos", true]]));
    expect(texto).toBe("casa de tres cuartos");
    expect(cuenta(texto, "casa")).toBe(1);
  });

  it("frases distintas sí se suman, en el orden en que las dijo", () => {
    const a = crearAcumulador();
    a.recibir(evento(0, [["casa en Santa Tecla", true]]));
    const texto = a.recibir(
      evento(1, [
        ["casa en Santa Tecla", true],
        ["tres cuartos y dos baños", true],
      ]),
    );
    expect(texto).toBe("casa en Santa Tecla tres cuartos y dos baños");
  });
});

describe("los reinicios del motor en el teléfono", () => {
  it("al reanudar sigue desde lo dicho, sin borrarlo ni duplicarlo", () => {
    const a = crearAcumulador();
    a.recibir(evento(0, [["es una casa de 600 varas cuadradas", true]]));
    // El motor se corta solo a los pocos segundos: se cierra el tramo.
    expect(a.cerrar()).toBe("es una casa de 600 varas cuadradas");

    // Vuelve a arrancar y empieza de nuevo en el índice 0.
    a.recibir(evento(0, [["con cinco cuartos", false]]));
    const texto = a.recibir(evento(0, [["con cinco cuartos y tres baños", true]]));

    expect(texto).toBe("es una casa de 600 varas cuadradas con cinco cuartos y tres baños");
    expect(cuenta(texto, "es una casa")).toBe(1);
    expect(cuenta(texto, "cinco cuartos")).toBe(1);
  });

  it("si el motor reanuda repitiendo la última frase, no la escribe dos veces", () => {
    const a = crearAcumulador();
    a.recibir(evento(0, [["tiene piscina", false]]));
    a.cerrar(); // se corta antes de darla por definitiva
    const texto = a.recibir(evento(0, [["tiene piscina y jardín", true]]));
    expect(texto).toBe("tiene piscina y jardín");
    expect(cuenta(texto, "piscina")).toBe(1);
  });

  it("veinte reinicios seguidos no inflan el texto", () => {
    const a = crearAcumulador();
    for (let i = 0; i < 20; i++) {
      a.recibir(evento(0, [["es una casa de 600 varas", true]]));
      a.cerrar();
    }
    expect(a.texto()).toBe("es una casa de 600 varas");
  });

  it("lo escrito a mano es el punto de partida y no se pierde", () => {
    const a = crearAcumulador();
    a.fijar("Casa en Las Colinas");
    const texto = a.recibir(evento(0, [["tres cuartos", true]]));
    expect(texto).toBe("Casa en Las Colinas tres cuartos");
  });

  it("el motor que manda vacíos o resultados raros no rompe nada", () => {
    const a = crearAcumulador();
    expect(a.recibir({ results: [], resultIndex: 0 })).toBe("");
    expect(a.recibir(evento(0, [["   ", true]]))).toBe("");
    expect(a.recibir({ results: [], resultIndex: NaN })).toBe("");
    expect(a.texto()).toBe("");
  });
});

describe("el texto que le queda al extractor", () => {
  it("después de la bola de nieve, los campos salen bien", () => {
    const a = crearAcumulador();
    let texto = "";
    // Dictado real: crece, se corta a la mitad, reanuda y termina.
    const mitad = FRASE.slice(0, FRASE.indexOf("tiene piscina")).trim();
    for (const parte of creciendo(mitad)) texto = a.recibir(evento(0, [[parte, false]]));
    a.recibir(evento(0, [[mitad, true]]));
    a.cerrar();
    const resto = FRASE.slice(FRASE.indexOf("tiene piscina"));
    for (const parte of creciendo(resto)) texto = a.recibir(evento(0, [[parte, true]]));
    texto = a.cerrar();

    expect(cuenta(texto, "es una casa")).toBe(1);
    const e = extraerDeDictado(texto);
    expect(e.tipo?.valor).toBe("casa");
    expect(e.areaTerreno?.valor).toBe(600);
    expect(e.habitaciones?.valor).toBe(5);
    expect(e.banos?.valor).toBe(3);
    expect(e.parqueos?.valor).toBe(5);
  });
});

describe("juntar tramos", () => {
  it("el tramo que continúa al anterior lo reemplaza", () => {
    expect(unirFrases(["es una", "es una casa", "es una casa de 600"])).toBe("es una casa de 600");
  });

  it("lo que ya está al final no se repite", () => {
    expect(unirFrases(["casa en Santa Tecla", "Santa Tecla"])).toBe("casa en Santa Tecla");
  });

  it("dos frases distintas se pegan con un espacio", () => {
    expect(unirFrases(["tiene piscina", "y garaje"])).toBe("tiene piscina y garaje");
  });

  it("no se come una palabra que empieza igual", () => {
    // "es un" no es el comienzo de "es una casa": son frases distintas.
    expect(fusionar(["es un", "es una casa"])).toEqual(["es un", "es una casa"]);
  });

  it("los vacíos y los espacios de más se van", () => {
    expect(unirFrases([" ", "casa  de   tres", undefined, null, ""])).toBe("casa de tres");
  });

  it("la puntuación del motor no hace que se repita", () => {
    expect(unirFrases(["Es una casa.", "es una casa"])).toBe("Es una casa.");
  });
});
