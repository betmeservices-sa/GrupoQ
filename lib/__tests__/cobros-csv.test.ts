// El importador es la puerta de entrada de la cartera del banco: si acá se
// cuela un dato mal leído, se acaba llamando a la persona equivocada con el
// monto de otra. Estos tests cubren los archivos reales que llegan, no el CSV
// ideal: punto y coma de Excel en español, BOM, tildes, montos con símbolo,
// teléfonos con guion y filas repetidas.
import { describe, expect, it } from "vitest";
import {
  aNumero,
  aProducto,
  detectarSeparador,
  deudorDesdeFila,
  importarCsv,
  mapearColumnas,
  partirLinea,
  plantillaCsv,
} from "../cobros-csv";

describe("partir el texto", () => {
  it("detecta el punto y coma del Excel en español", () => {
    expect(detectarSeparador("nombre;telefono;monto")).toBe(";");
    expect(detectarSeparador("nombre,telefono,monto")).toBe(",");
    expect(detectarSeparador("nombre\ttelefono\tmonto")).toBe("\t");
  });

  it("respeta las comas dentro de comillas", () => {
    expect(partirLinea('"Ramos, Wendy Carolina",7854-1209', ",")).toEqual([
      "Ramos, Wendy Carolina",
      "7854-1209",
    ]);
  });

  it("entiende las comillas escapadas", () => {
    expect(partirLinea('"Dijo ""si"" al plan",100', ",")).toEqual(['Dijo "si" al plan', "100"]);
  });
});

describe("reconocer columnas", () => {
  it("encuentra los campos aunque el encabezado venga con tildes y mayúsculas", () => {
    const col = mapearColumnas(["Nombre Completo", "TELÉFONO", "Días de mora", "Monto Vencido"]);
    expect(col.nombre).toBe(0);
    expect(col.telefono).toBe(1);
    expect(col.diasMora).toBe(2);
    expect(col.montoVencido).toBe(3);
  });

  it("no confunde 'saldo total' con 'saldo vencido'", () => {
    const col = mapearColumnas(["saldo total", "saldo vencido"]);
    expect(col.saldoTotal).toBe(0);
    expect(col.montoVencido).toBe(1);
  });

  it("marca en -1 lo que el archivo no trae", () => {
    expect(mapearColumnas(["nombre", "telefono"]).cuenta).toBe(-1);
  });
});

describe("limpiar valores", () => {
  it("lee los montos como los escribe el banco", () => {
    expect(aNumero("$1,240.50")).toBe(1240.5);
    expect(aNumero("312.50")).toBe(312.5);
    expect(aNumero("")).toBeUndefined();
    expect(aNumero("-")).toBeUndefined();
  });

  it("reconoce el producto por como lo escriben", () => {
    expect(aProducto("Tarjeta de crédito")).toBe("tarjeta");
    expect(aProducto("CREDITO VEHICULAR")).toBe("auto");
    expect(aProducto("Préstamo personal")).toBe("prestamo_personal");
    expect(aProducto("cualquier cosa")).toBeUndefined();
  });
});

describe("importar un archivo", () => {
  it("lee un archivo con punto y coma, BOM y montos con símbolo", () => {
    const csv =
      "﻿Nombre;Teléfono;Monto vencido;Días de mora\n" +
      "Wendy Carolina Ramos;7854-1209;$312.50;34\n" +
      "Julio Barahona;7011-9088;$845.00;62\n";
    const r = importarCsv(csv);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({
      nombre: "Wendy Carolina Ramos",
      telefono: "+50378541209",
      montoVencido: 312.5,
      diasMora: 34,
    });
  });

  it("normaliza el teléfono a E.164 escríbase como se escriba", () => {
    const csv =
      "nombre,telefono\n" +
      "A,7854 1209\n" +
      "B,+503 7011-9088\n" +
      "C,50372338814\n";
    expect(importarCsv(csv).filas.map((f) => f.telefono)).toEqual([
      "+50378541209",
      "+50370119088",
      "+50372338814",
    ]);
  });

  it("rechaza la fila sin número marcable en vez de inventarlo", () => {
    const csv = "nombre,telefono\nSin número,\nMal número,123\nBueno,7854-1209\n";
    const r = importarCsv(csv);
    expect(r.filas).toHaveLength(1);
    expect(r.rechazadas).toHaveLength(2);
    expect(r.rechazadas[0].motivo).toContain("marcable");
    expect(r.rechazadas[0].linea).toBe(1);
  });

  it("llama una sola vez a quien viene repetido", () => {
    const csv = "nombre,telefono\nA,7854-1209\nA de nuevo,7854 1209\nB,7011-9088\n";
    const r = importarCsv(csv);
    expect(r.filas).toHaveLength(2);
    expect(r.duplicadas).toBe(1);
  });

  it("avisa qué columnas ignoró, para que nadie crea que las usó", () => {
    const csv = "nombre,telefono,sucursal,ejecutivo\nA,7854-1209,San Miguel,Karla\n";
    expect(importarCsv(csv).columnasIgnoradas).toEqual(["sucursal", "ejecutivo"]);
  });

  it("dice claro cuando el archivo no trae columna de teléfono", () => {
    const r = importarCsv("nombre,monto\nA,100\n");
    expect(r.filas).toHaveLength(0);
    expect(r.rechazadas[0].motivo).toContain("no trae una columna");
  });

  it("aguanta una base de 10,000 filas", () => {
    const filas = ["nombre,telefono,monto vencido,dias mora"];
    for (let i = 0; i < 10_000; i++) {
      // Números salvadoreños válidos y distintos entre sí.
      const local = 70_000_000 + i;
      filas.push(`Cliente ${i},${local},${(100 + i).toFixed(2)},${i % 180}`);
    }
    const r = importarCsv(filas.join("\n"));
    expect(r.filas).toHaveLength(10_000);
    expect(r.duplicadas).toBe(0);
    expect(r.rechazadas).toHaveLength(0);
  });

  it("no explota con un archivo vacío", () => {
    expect(importarCsv("").filas).toHaveLength(0);
    expect(importarCsv("   \n  \n").filas).toHaveLength(0);
  });

  it("la plantilla que se descarga se puede volver a importar", () => {
    const r = importarCsv(plantillaCsv());
    expect(r.filas).toHaveLength(3);
    expect(r.rechazadas).toHaveLength(0);
    expect(r.columnasIgnoradas).toHaveLength(0);
    expect(r.filas[0].producto).toBe("tarjeta");
  });
});

describe("convertir la fila en ficha", () => {
  const ahora = "2026-08-17T12:00:00.000Z";

  it("deja en cero lo que el archivo no trajo, sin estimarlo", () => {
    const d = deudorDesdeFila({ nombre: "A", telefono: "+50378541209" }, "x1", ahora);
    expect(d.montoVencido).toBe(0);
    expect(d.saldoTotal).toBe(0);
    expect(d.cuotaMensual).toBe(0);
    expect(d.documento).toBe("");
  });

  it("nace llamable, sin gestionar y etiquetada como importada", () => {
    const d = deudorDesdeFila({ nombre: "A", telefono: "+50378541209" }, "x1", ahora);
    expect(d.llamable).toBe(true);
    expect(d.estado).toBe("sin_gestionar");
    expect(d.gestiones).toHaveLength(0);
    expect(d.etiquetas).toContain("Importado");
  });

  it("deriva el riesgo de los días de mora", () => {
    const bajo = deudorDesdeFila({ nombre: "A", telefono: "+50378541209", diasMora: 10 }, "1", ahora);
    const medio = deudorDesdeFila({ nombre: "B", telefono: "+50378541209", diasMora: 45 }, "2", ahora);
    const alto = deudorDesdeFila({ nombre: "C", telefono: "+50378541209", diasMora: 120 }, "3", ahora);
    expect([bajo.riesgo, medio.riesgo, alto.riesgo]).toEqual(["bajo", "medio", "alto"]);
  });

  it("si solo viene el vencido, el saldo total no queda menor que él", () => {
    const d = deudorDesdeFila({ nombre: "A", telefono: "+50378541209", montoVencido: 500 }, "1", ahora);
    expect(d.saldoTotal).toBe(500);
  });
});
