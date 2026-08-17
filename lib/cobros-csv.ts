// Lectura del archivo de contactos que sube el banco.
//
// El archivo real nunca viene como uno quiere: separado con punto y coma porque
// salio de un Excel en espanol, con BOM al inicio, con los montos como
// "$1,240.50", con el telefono escrito "7539-1721" y con la misma persona
// repetida tres veces. Todo eso se resuelve aca, y se resuelve en funciones
// puras: el importador de 10,000 filas se prueba sin tocar la red.
//
// Lo que NO hace: adivinar. Si una fila no tiene un numero marcable, no la
// inventa: la manda a la lista de rechazadas con el motivo, y esa lista se le
// muestra al usuario antes de crear la campana.
//
// OJO: este archivo se mantiene en ASCII puro a proposito. Las funciones de
// abajo manipulan acentos y BOM caracter por caracter, y un editor o un script
// que "arregle" la codificacion puede romper una clase de regex sin que se note
// hasta que un encabezado con tilde deja de reconocerse.

import { normalizarDestinoSV } from "./phone";
import { PRODUCTO_NOMBRE, type Deudor, type ProductoCredito } from "./cobros-tipos";

export interface FilaImportada {
  nombre: string;
  telefono: string; // E.164
  documento?: string;
  cuenta?: string;
  producto?: ProductoCredito;
  saldoTotal?: number;
  montoVencido?: number;
  cuotaMensual?: number;
  diasMora?: number;
}

export interface FilaRechazada {
  linea: number; // 1 = primera fila de datos
  motivo: string;
  crudo: string;
}

export interface ResultadoImportacion {
  filas: FilaImportada[];
  rechazadas: FilaRechazada[];
  duplicadas: number;
  columnas: string[];
  // Columnas del archivo que no se reconocieron. Se avisan para que nadie crea
  // que se esta usando una columna que en realidad se ignoro.
  columnasIgnoradas: string[];
  total: number;
}

// Tope duro. Es un demo en memoria: 20,000 filas ya son varios MB por proceso.
export const MAX_FILAS = 20000;

const BOM = 0xfeff;

// -- Partido del texto --

/** Detecta el separador contando cual aparece mas en la primera linea. */
export function detectarSeparador(primeraLinea: string): string {
  const candidatos = [";", ",", "\t", "|"];
  let mejor = ",";
  let max = 0;
  for (const c of candidatos) {
    const n = primeraLinea.split(c).length - 1;
    if (n > max) {
      max = n;
      mejor = c;
    }
  }
  return mejor;
}

/**
 * Parte una linea de CSV respetando comillas dobles ("Ramos, Wendy" es UNA
 * celda) y las comillas escapadas ("" dentro de un campo entrecomillado).
 */
export function partirLinea(linea: string, sep: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let enComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (enComillas) {
      if (ch === '"') {
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        actual += ch;
      }
    } else if (ch === '"') {
      enComillas = true;
    } else if (ch === sep) {
      celdas.push(actual.trim());
      actual = "";
    } else {
      actual += ch;
    }
  }
  celdas.push(actual.trim());
  return celdas;
}

// -- Reconocimiento de columnas --

/**
 * Deja el encabezado comparable: sin acentos, en minusculas y con un solo
 * espacio entre palabras, para que "Dias de mora", "DIAS DE MORA" y
 * "Di<acento>as de mora" caigan todos en la misma llave.
 *
 * El descartado de acentos se hace por punto de codigo y no con una clase de
 * regex a proposito: descomponer en NFD y quedarse solo con ASCII deja las
 * letras base intactas. Hacerlo al reves (borrar lo no alfanumerico primero)
 * convertiria la tilde en un espacio y partiria la palabra en dos.
 */
function normalizar(s: string): string {
  let ascii = "";
  for (const ch of s.normalize("NFD")) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 128) ascii += ch;
  }
  return ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type Campo = keyof FilaImportada;

const ALIAS: Record<Campo, string[]> = {
  nombre: ["nombre", "nombre completo", "cliente", "titular", "deudor", "nombre cliente", "name"],
  telefono: ["telefono", "telefono 1", "celular", "movil", "numero", "tel", "phone", "contacto"],
  documento: ["documento", "dui", "identificacion", "id", "nit", "cedula"],
  cuenta: ["cuenta", "no cuenta", "numero de cuenta", "referencia", "credito", "contrato"],
  producto: ["producto", "tipo de producto", "linea", "tipo credito", "tipo"],
  saldoTotal: ["saldo total", "saldo", "saldo capital", "deuda total", "saldo actual"],
  montoVencido: [
    "monto vencido",
    "vencido",
    "saldo vencido",
    "monto en mora",
    "mora",
    "cuota vencida",
    "monto a pagar",
  ],
  cuotaMensual: ["cuota", "cuota mensual", "pago mensual", "abono mensual"],
  diasMora: ["dias mora", "dias de mora", "dias atraso", "atraso", "dias"],
};

/** Mapea cada campo a su indice de columna, o -1 si no vino en el archivo. */
export function mapearColumnas(encabezado: string[]): Record<Campo, number> {
  const norm = encabezado.map(normalizar);
  const mapa = {} as Record<Campo, number>;
  for (const campo of Object.keys(ALIAS) as Campo[]) {
    const alias = ALIAS[campo];
    // Primero coincidencia exacta; despues "empieza con", que atrapa cosas como
    // "telefono celular" sin confundir "dias" con "dias mora".
    let i = norm.findIndex((h) => alias.includes(h));
    if (i < 0) i = norm.findIndex((h) => alias.some((a) => h.startsWith(a) || a.startsWith(h)));
    mapa[campo] = i;
  }
  return mapa;
}

/** "$1,240.50" -> 1240.5 ; "" -> undefined */
export function aNumero(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const limpio = v.replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  if (!limpio || limpio === "-" || limpio === ".") return undefined;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : undefined;
}

const PRODUCTO_ALIAS: Array<[RegExp, ProductoCredito]> = [
  [/tarjeta|tc\b|credit ?card/i, "tarjeta"],
  [/vivienda|hipotec|casa/i, "vivienda"],
  [/auto|vehic|carro/i, "auto"],
  [/pyme|empresa|comercial|negocio/i, "pyme"],
  [/personal|consumo|efectivo/i, "prestamo_personal"],
];

export function aProducto(v: string | undefined): ProductoCredito | undefined {
  if (!v) return undefined;
  for (const [re, p] of PRODUCTO_ALIAS) if (re.test(v)) return p;
  return undefined;
}

// -- El importador --

export function importarCsv(texto: string): ResultadoImportacion {
  // El BOM de Excel se cuela en el primer encabezado y rompe el reconocimiento.
  const sinBom = texto.charCodeAt(0) === BOM ? texto.slice(1) : texto;
  const lineas = sinBom
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lineas.length === 0) {
    return {
      filas: [],
      rechazadas: [],
      duplicadas: 0,
      columnas: [],
      columnasIgnoradas: [],
      total: 0,
    };
  }

  const sep = detectarSeparador(lineas[0]);
  const encabezado = partirLinea(lineas[0], sep);
  const col = mapearColumnas(encabezado);

  const usadas = new Set(Object.values(col).filter((i) => i >= 0));
  const columnasIgnoradas = encabezado.filter((_, i) => !usadas.has(i));

  const filas: FilaImportada[] = [];
  const rechazadas: FilaRechazada[] = [];
  const vistos = new Set<string>();
  let duplicadas = 0;

  const cuerpo = lineas.slice(1);
  for (let n = 0; n < cuerpo.length; n++) {
    if (filas.length >= MAX_FILAS) {
      rechazadas.push({
        linea: n + 1,
        motivo: `Se alcanzo el tope de ${MAX_FILAS.toLocaleString("en-US")} contactos por archivo.`,
        crudo: cuerpo[n].slice(0, 120),
      });
      break;
    }

    const celdas = partirLinea(cuerpo[n], sep);
    const en = (c: Campo): string | undefined => {
      const i = col[c];
      return i >= 0 ? celdas[i] : undefined;
    };

    const telefono = normalizarDestinoSV(en("telefono") ?? "");
    if (!telefono) {
      rechazadas.push({
        linea: n + 1,
        motivo:
          col.telefono < 0
            ? "El archivo no trae una columna de telefono."
            : "Sin un numero salvadoreno marcable de 8 digitos.",
        crudo: cuerpo[n].slice(0, 120),
      });
      continue;
    }

    if (vistos.has(telefono)) {
      duplicadas += 1;
      continue;
    }
    vistos.add(telefono);

    const nombre = (en("nombre") ?? "").trim();
    filas.push({
      nombre: nombre || "Sin nombre",
      telefono,
      documento: en("documento") || undefined,
      cuenta: en("cuenta") || undefined,
      producto: aProducto(en("producto")),
      saldoTotal: aNumero(en("saldoTotal")),
      montoVencido: aNumero(en("montoVencido")),
      cuotaMensual: aNumero(en("cuotaMensual")),
      diasMora: aNumero(en("diasMora")),
    });
  }

  return {
    filas,
    rechazadas,
    duplicadas,
    columnas: encabezado,
    columnasIgnoradas,
    total: cuerpo.length,
  };
}

/**
 * Convierte una fila del archivo en una ficha de deudor.
 *
 * Lo que el archivo no traiga se deja en cero, NO se estima: una cartera con
 * montos inventados es peor que una cartera incompleta, porque el gestor no
 * puede distinguir el dato bueno del rellenado.
 */
export function deudorDesdeFila(fila: FilaImportada, id: string, ahora: string): Deudor {
  const montoVencido = fila.montoVencido ?? 0;
  const saldoTotal = fila.saldoTotal ?? montoVencido;
  const diasMora = Math.max(0, Math.round(fila.diasMora ?? 0));
  return {
    id,
    nombre: fila.nombre,
    documento: fila.documento ?? "",
    telefono: fila.telefono,
    producto: fila.producto ?? "prestamo_personal",
    cuenta: fila.cuenta ?? "",
    saldoTotal,
    montoVencido,
    cuotaMensual: fila.cuotaMensual ?? 0,
    diasMora,
    estado: "sin_gestionar",
    riesgo: diasMora > 90 ? "alto" : diasMora > 30 ? "medio" : "bajo",
    etiquetas: ["Importado"],
    gestiones: [],
    actualizado: ahora,
    llamable: true,
  };
}

/** Archivo de ejemplo que se descarga desde la pantalla, con el formato exacto. */
export function plantillaCsv(): string {
  const filas = [
    [
      "nombre",
      "telefono",
      "documento",
      "cuenta",
      "producto",
      "saldo total",
      "monto vencido",
      "cuota mensual",
      "dias mora",
    ],
    ["Wendy Carolina Ramos", "7854-1209", "0123****-4", "****4471", PRODUCTO_NOMBRE.tarjeta, "1840.00", "312.50", "156.25", "34"],
    ["Julio Cesar Barahona", "7011-9088", "0298****-1", "****9032", PRODUCTO_NOMBRE.prestamo_personal, "6420.00", "845.00", "422.50", "62"],
    ["Sandra Melgar de Ayala", "7233-8814", "0455****-8", "****1178", PRODUCTO_NOMBRE.auto, "11250.00", "1490.00", "372.50", "18"],
  ];
  return filas.map((f) => f.join(",")).join("\n");
}
