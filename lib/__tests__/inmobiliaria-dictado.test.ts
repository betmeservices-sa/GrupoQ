// El extractor de la nota de voz. Es el que corre HOY (la llave del modelo está
// sin saldo), así que va cubierto frase por frase, incluidas las que dicen a
// medias: lo que no se entendió se queda vacío y se pide.
import { describe, it, expect } from "vitest";
import {
  extraerDeDictado,
  normalizar,
  numeroEnDigitos,
  numeroEnPalabras,
  type Extraccion,
} from "@/lib/inmobiliaria-dictado";

const v = <T>(c: { valor: T } | undefined): T | undefined => c?.valor;

describe("números como los dice la gente", () => {
  it("números en palabras, del uno al millón", () => {
    expect(numeroEnPalabras("tres")).toBe(3);
    expect(numeroEnPalabras("quince")).toBe(15);
    expect(numeroEnPalabras("veinticinco")).toBe(25);
    expect(numeroEnPalabras("treinta y cinco")).toBe(35);
    expect(numeroEnPalabras("ciento cincuenta")).toBe(150);
    expect(numeroEnPalabras("doscientas veinte")).toBe(220);
    expect(numeroEnPalabras("cuatrocientos mil")).toBe(400000);
    expect(numeroEnPalabras("dos mil quinientos")).toBe(2500);
    expect(numeroEnPalabras("un millón doscientos mil")).toBe(1200000);
    expect(numeroEnPalabras("seiscientos cincuenta")).toBe(650);
    expect(numeroEnPalabras("casa")).toBeNull();
  });

  it("números con dígitos, con punto, con coma y con nada", () => {
    expect(numeroEnDigitos("400,000")).toBe(400000);
    expect(numeroEnDigitos("425.000")).toBe(425000);
    expect(numeroEnDigitos("$76,500")).toBe(76500);
    expect(numeroEnDigitos("172500")).toBe(172500);
    expect(numeroEnDigitos("2.5")).toBe(2.5);
    expect(numeroEnDigitos("1,200,000")).toBe(1200000);
  });

  it("las tildes se van sin mover las posiciones, para poder citar lo dicho", () => {
    const original = "Casa en Antiguo Cuscatlán";
    const norm = normalizar(original);
    expect(norm).toBe("casa en antiguo cuscatlan");
    expect(norm.length).toBe(original.length);
    expect(original.slice(norm.indexOf("cuscatlan"))).toBe("Cuscatlán");
  });
});

describe("la frase de siempre, parado frente a la casa", () => {
  const e = extraerDeDictado(
    "Casa de tres habitaciones, dos baños, en Santa Tecla, cuatrocientos mil",
  );

  it("saca tipo, habitaciones, baños, municipio y precio", () => {
    expect(v(e.tipo)).toBe("casa");
    expect(v(e.habitaciones)).toBe(3);
    expect(v(e.banos)).toBe(2);
    expect(v(e.municipio)).toBe("Santa Tecla");
    expect(v(e.precio)).toBe(400000);
  });

  it("guarda de dónde salió cada dato, para poder corregirlo", () => {
    expect(e.habitaciones?.dicho).toContain("tres habitaciones");
    expect(e.precio?.dicho).toContain("cuatrocientos mil");
  });

  it("no inventa lo que no dijo y lo deja pedido", () => {
    expect(e.operacion).toBeUndefined();
    expect(e.zona).toBeUndefined();
    expect(e.parqueos).toBeUndefined();
    expect(e.propietarioNombre).toBeUndefined();
    expect(e.faltantes).toContain("operacion");
    expect(e.faltantes).toContain("zona");
    expect(e.faltantes).toContain("areaConstruccion");
    expect(e.faltantes).toContain("propietarioTelefono");
  });

  it("el dictado completo queda como descripción, con las palabras del agente", () => {
    expect(e.descripcion).toBe(
      "Casa de tres habitaciones, dos baños, en Santa Tecla, cuatrocientos mil",
    );
  });
});

describe("alquiler dictado", () => {
  const e = extraerDeDictado(
    "Apartamento en alquiler en Colonia Escalón, dos habitaciones, un baño, 92 metros, seiscientos cincuenta dólares al mes, depósito de 650, contrato mínimo de un año",
  );

  it("entiende que es alquiler y que el precio es mensual", () => {
    expect(v(e.operacion)).toBe("alquiler");
    expect(v(e.precio)).toBe(650);
  });

  it("saca depósito y plazo, que son las dos preguntas de todo el que alquila", () => {
    expect(v(e.deposito)).toBe(650);
    expect(v(e.plazoMinimoMeses)).toBe(12);
  });

  it("no confunde el área con el dinero", () => {
    expect(v(e.areaConstruccion)).toBe(92);
    expect(v(e.habitaciones)).toBe(2);
    expect(v(e.banos)).toBe(1);
    expect(v(e.zona)).toBe("Colonia Escalón");
    expect(v(e.municipio)).toBe("San Salvador");
  });

  it("con todo dicho, ya no pide precio ni depósito", () => {
    expect(e.faltantes).not.toContain("precio");
    expect(e.faltantes).not.toContain("deposito");
    expect(e.faltantes).not.toContain("plazoMinimoMeses");
  });
});

describe("el alquiler se deduce del al mes, no de un rótulo", () => {
  it("seiscientos al mes es alquiler aunque no diga la palabra", () => {
    const e = extraerDeDictado("Apartamento de una habitación en Escalón, 525 al mes");
    expect(v(e.operacion)).toBe("alquiler");
    expect(v(e.precio)).toBe(525);
  });

  it("mensuales cuenta igual", () => {
    const e = extraerDeDictado("Casa en Lourdes, cuatrocientos veinticinco dólares mensuales");
    expect(v(e.operacion)).toBe("alquiler");
    expect(v(e.precio)).toBe(425);
    expect(v(e.zona)).toBe("Lourdes");
    expect(v(e.municipio)).toBe("Colón");
  });
});

describe("medias palabras y trampas", () => {
  it("dos baños y medio son dos y medio, no dos", () => {
    expect(v(extraerDeDictado("casa con dos baños y medio").banos)).toBe(2.5);
    expect(v(extraerDeDictado("apartamento con baño y medio").banos)).toBe(1.5);
  });

  it("los sinónimos del cuarto y del parqueo cuentan igual", () => {
    expect(v(extraerDeDictado("casa de 4 cuartos").habitaciones)).toBe(4);
    expect(v(extraerDeDictado("apartamento de dos dormitorios").habitaciones)).toBe(2);
    expect(v(extraerDeDictado("casa con dos cocheras").parqueos)).toBe(2);
    expect(v(extraerDeDictado("casa con garaje").parqueos)).toBe(1);
  });

  it("el precio con símbolo y con separadores", () => {
    expect(v(extraerDeDictado("casa en Santa Tecla, precio $172,500").precio)).toBe(172500);
    expect(v(extraerDeDictado("casa en Santa Tecla, piden 425.000").precio)).toBe(425000);
    expect(v(extraerDeDictado("casa en Santa Tecla, 92 mil dólares").precio)).toBe(92000);
  });

  it("un número sin contexto de dinero NO se toma como precio", () => {
    const e = extraerDeDictado("Casa construida en 2015 en Santa Tecla");
    expect(e.precio).toBeUndefined();
    expect(e.faltantes).toContain("precio");
  });

  it("las habitaciones no se leen como dinero", () => {
    const e = extraerDeDictado("Casa de tres habitaciones y dos baños");
    expect(e.precio).toBeUndefined();
    expect(v(e.habitaciones)).toBe(3);
    expect(v(e.banos)).toBe(2);
  });

  it("terreno en varas, construcción en metros", () => {
    const e = extraerDeDictado("Terreno de ochocientas cincuenta varas en La Libertad");
    expect(v(e.tipo)).toBe("terreno");
    expect(v(e.areaTerreno)).toBe(850);
    expect(e.areaConstruccion).toBeUndefined();
    expect(e.faltantes).not.toContain("areaTerreno");
  });

  it("si dicta el terreno en metros lo guarda y avisa, no lo convierte solo", () => {
    const e = extraerDeDictado("Terreno de 200 metros de terreno en Colón");
    expect(v(e.areaTerreno)).toBe(200);
    expect(e.avisos.join(" ")).toContain("varas");
  });

  it("saca el teléfono del propietario cuando lo dicta", () => {
    const e = extraerDeDictado("Casa en Santa Tecla, el dueño es Ricardo Alvarenga, 7412 8890");
    expect(v(e.propietarioNombre)).toBe("Ricardo Alvarenga");
    expect(v(e.propietarioTelefono)).toBe("+503 7412 8890");
  });

  it("la exclusiva se guarda en días, que es como la mide la cartera", () => {
    const e = extraerDeDictado("Casa en Santa Tecla en exclusiva por tres meses");
    expect(v(e.exclusiva)).toBe(true);
    expect(v(e.exclusivaEnDias)).toBe(90);
  });

  it("una zona nueva se captura con su prefijo", () => {
    const e = extraerDeDictado("Casa en residencial Altos del Bosque, Nuevo Cuscatlán");
    expect(v(e.zona)).toContain("Altos");
    expect(v(e.municipio)).toBe("Nuevo Cuscatlán");
  });

  it("un dictado vacío no rompe nada y lo pide todo", () => {
    const e = extraerDeDictado("");
    expect(e.descripcion).toBe("");
    expect(e.faltantes.length).toBeGreaterThan(4);
  });
});

describe("lo que falta según el tipo", () => {
  it("a un terreno no se le reclaman baños", () => {
    const e = extraerDeDictado("Terreno de 500 varas en La Libertad, cien mil dólares");
    expect(e.faltantes).not.toContain("banos");
    expect(e.faltantes).not.toContain("habitaciones");
  });

  it("a una casa sí", () => {
    const e: Extraccion = extraerDeDictado("Casa en La Libertad, cien mil dólares");
    expect(e.faltantes).toContain("banos");
    expect(e.faltantes).toContain("habitaciones");
  });
});
