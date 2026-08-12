// De lo que el agente DIJO a los campos del formulario, sin modelo de por medio.
//
// Por qué determinista: el agente está parado en la acera, con una barra de
// señal y sin ganas de corregir. Un extractor de reglas corre en el navegador,
// no cuesta, no se cae si no hay llave y, sobre todo, se puede probar: cada
// frase de estas está en el test. El modelo (ver inmobiliaria-ia.ts) es un
// AGREGADO opcional; esto es el piso.
//
// REGLA DURA: lo que no dijo, no se llena. Nada de suponer que una casa tiene
// dos baños porque tiene tres cuartos. Cada campo guarda el pedazo de frase que
// lo produjo (`dicho`), para que el agente vea de dónde salió y lo pueda
// corregir de un toque.

import type { TipoOperacion, TipoPropiedad } from "./inmobiliaria-tipos";

export interface CampoDicho<T> {
  valor: T;
  dicho: string; // el fragmento del dictado que lo produjo
}

export type CampoAlta =
  | "operacion"
  | "tipo"
  | "precio"
  | "deposito"
  | "plazoMinimoMeses"
  | "zona"
  | "municipio"
  | "habitaciones"
  | "banos"
  | "parqueos"
  | "areaConstruccion"
  | "areaTerreno"
  | "propietarioNombre"
  | "propietarioTelefono";

export interface Extraccion {
  operacion?: CampoDicho<TipoOperacion>;
  tipo?: CampoDicho<TipoPropiedad>;
  precio?: CampoDicho<number>;
  deposito?: CampoDicho<number>;
  plazoMinimoMeses?: CampoDicho<number>;
  zona?: CampoDicho<string>;
  municipio?: CampoDicho<string>;
  habitaciones?: CampoDicho<number>;
  banos?: CampoDicho<number>;
  parqueos?: CampoDicho<number>;
  areaConstruccion?: CampoDicho<number>;
  areaTerreno?: CampoDicho<number>;
  exclusiva?: CampoDicho<boolean>;
  exclusivaEnDias?: CampoDicho<number>;
  propietarioNombre?: CampoDicho<string>;
  propietarioTelefono?: CampoDicho<string>;
  descripcion: string; // el dictado tal cual, que es lo que el agente diría
  faltantes: CampoAlta[]; // lo que hay que preguntarle antes de guardar
  avisos: string[]; // cosas que entendió a medias y conviene revisar
}

export const ETIQUETA_CAMPO: Record<CampoAlta, string> = {
  operacion: "Venta o alquiler",
  tipo: "Tipo",
  precio: "Precio",
  deposito: "Depósito",
  plazoMinimoMeses: "Plazo mínimo",
  zona: "Zona o colonia",
  municipio: "Municipio",
  habitaciones: "Habitaciones",
  banos: "Baños",
  parqueos: "Parqueos",
  areaConstruccion: "Área construida",
  areaTerreno: "Área de terreno",
  propietarioNombre: "Propietario",
  propietarioTelefono: "Teléfono del propietario",
};

// ── Normalización que NO mueve los índices ──
// Se quitan tildes carácter por carácter para que cada posición del texto
// normalizado siga apuntando al mismo lugar del original. Así el `dicho` que se
// le muestra al agente sale del texto que él dictó, con sus tildes y mayúsculas.
export function normalizar(texto: string): string {
  let out = "";
  for (const ch of texto ?? "") {
    const limpio = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    out += limpio.length === ch.length ? limpio.toLowerCase() : ch.toLowerCase();
  }
  return out;
}

// ── Números en palabras ──

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};

const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90,
};

const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
  trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500,
  quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700,
  setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900,
  novecientas: 900,
};

const MILES = new Set(["mil"]);
const MILLONES = new Set(["millon", "millones"]);

function esPalabraNumero(t: string): boolean {
  return t in UNIDADES || t in DECENAS || t in CENTENAS || MILES.has(t) || MILLONES.has(t);
}

// Convierte una tira de palabras a número: "cuatrocientos mil" -> 400000,
// "dos baños y medio" no llega aquí (el "y medio" lo maneja quien pregunta).
export function numeroEnPalabras(texto: string): number | null {
  const tokens = normalizar(texto).match(/[a-z]+/g) ?? [];
  return numeroDeTokens(tokens);
}

function numeroDeTokens(tokens: string[]): number | null {
  let total = 0;
  let parcial = 0;
  let vio = false;
  for (const t of tokens) {
    if (t === "y") continue;
    if (t in UNIDADES) {
      parcial += UNIDADES[t];
      vio = true;
    } else if (t in DECENAS) {
      parcial += DECENAS[t];
      vio = true;
    } else if (t in CENTENAS) {
      parcial += CENTENAS[t];
      vio = true;
    } else if (MILES.has(t)) {
      total += (parcial || 1) * 1000;
      parcial = 0;
      vio = true;
    } else if (MILLONES.has(t)) {
      total += (parcial || 1) * 1_000_000;
      parcial = 0;
      vio = true;
    } else {
      break;
    }
  }
  return vio ? total + parcial : null;
}

// Número escrito con dígitos, con o sin separadores: "400,000", "425.000",
// "76500", "2.5". Los miles se separan con coma o punto según quién escriba, y
// el dictado del teléfono usa cualquiera de los dos.
export function numeroEnDigitos(bruto: string): number | null {
  const s = bruto.replace(/[$\s]/g, "");
  if (!/\d/.test(s)) return null;
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Number(s.replace(",", "."));
  if (/^\d+$/.test(s)) return Number(s);
  return Number(s.replace(/[^\d]/g, "")) || null;
}

// ── Tokenizado con posiciones ──

interface Token {
  t: string; // normalizado
  ini: number;
  fin: number;
}

function tokenizar(norm: string): Token[] {
  const out: Token[] = [];
  const re = /\$?\d[\d.,]*|[a-z]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) {
    out.push({ t: m[0], ini: m.index, fin: m.index + m[0].length });
  }
  return out;
}

// Una cantidad hallada en el dictado, con lo que la rodea.
interface Cantidad {
  valor: number;
  desde: number; // índice de token
  hasta: number; // índice de token (inclusive)
  ini: number;
  fin: number;
  dolar: boolean; // venía con $
  multiplicador: boolean; // dijo "mil" o "millones"
  usada: boolean;
}

function hallarCantidades(tokens: Token[]): Cantidad[] {
  const out: Cantidad[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    let valor: number | null = null;
    let hasta = i;
    let dolar = false;
    let multiplicador = false;

    if (/^\$?\d/.test(tok.t)) {
      dolar = tok.t.startsWith("$");
      valor = numeroEnDigitos(tok.t);
      // "400 mil", "1.2 millones"
      const sig = tokens[i + 1]?.t ?? "";
      if (valor !== null && MILES.has(sig)) {
        valor *= 1000;
        hasta = i + 1;
        multiplicador = true;
      } else if (valor !== null && MILLONES.has(sig)) {
        valor *= 1_000_000;
        hasta = i + 1;
        multiplicador = true;
      }
    } else if (esPalabraNumero(tok.t)) {
      // Toma la tira más larga de palabras de número ("dos mil quinientos").
      let j = i;
      const palabras: string[] = [];
      while (j < tokens.length && (esPalabraNumero(tokens[j].t) || tokens[j].t === "y")) {
        // "y" solo sigue si después viene otro número ("treinta y cinco").
        if (tokens[j].t === "y" && !esPalabraNumero(tokens[j + 1]?.t ?? "")) break;
        palabras.push(tokens[j].t);
        j++;
      }
      valor = numeroDeTokens(palabras);
      hasta = j - 1;
      multiplicador = palabras.some((p) => MILES.has(p) || MILLONES.has(p));
    }

    if (valor !== null) {
      out.push({
        valor,
        desde: i,
        hasta,
        ini: tokens[i].ini,
        fin: tokens[hasta].fin,
        dolar,
        multiplicador,
        usada: false,
      });
      i = hasta + 1;
    } else {
      i++;
    }
  }
  return out;
}

// ── Vocabulario ──

const UNIDAD_HABITACION = /^(habitacion|habitaciones|cuarto|cuartos|dormitorio|dormitorios|recamara|recamaras|hab)$/;
const UNIDAD_BANO = /^(bano|banos)$/;
const UNIDAD_PARQUEO = /^(parqueo|parqueos|cochera|cocheras|garaje|garajes|estacionamiento|estacionamientos)$/;
const UNIDAD_METRO = /^(metro|metros|m2|mts)$/;
const UNIDAD_VARA = /^(vara|varas|v2)$/;
const UNIDAD_MES = /^(mes|meses)$/;
const UNIDAD_ANIO = /^(ano|anos|year)$/;

// Palabras que delatan que una cantidad es dinero. Se buscan en el pedazo de
// frase que viene ANTES del número, así que van sin anclas.
const MARCA_PRECIO = /\b(precio|precios|cuesta|cuestan|vale|valen|piden|pide|pidiendo|venden|vendiendo|vendo|dan|dejan|cotizada|cotizado)\b/;
const MARCA_RENTA = /\b(renta|rentan|rento|alquiler|alquilan|alquilo|mensualidad|mensualidades)\b/;
const MARCA_DEPOSITO = /\b(deposito|depositos)\b/;
const PALABRA_DOLAR = /^(dolar|dolares|usd)$/;

const ZONAS_CONOCIDAS: Array<{ nombre: string; municipio?: string }> = [
  { nombre: "Colonia Escalón", municipio: "San Salvador" },
  { nombre: "Escalón", municipio: "San Salvador" },
  { nombre: "Zona Rosa", municipio: "San Salvador" },
  { nombre: "San Benito", municipio: "San Salvador" },
  { nombre: "Miramonte", municipio: "San Salvador" },
  { nombre: "Colonia Layco", municipio: "San Salvador" },
  { nombre: "Santa Elena", municipio: "Antiguo Cuscatlán" },
  { nombre: "Jardines de Merliot", municipio: "Antiguo Cuscatlán" },
  { nombre: "Merliot", municipio: "Antiguo Cuscatlán" },
  { nombre: "Las Colinas", municipio: "Santa Tecla" },
  { nombre: "Las Delicias", municipio: "Santa Tecla" },
  { nombre: "Paseo El Carmen", municipio: "Santa Tecla" },
  // Lourdes es zona, no municipio: pertenece a Colón. Es conocimiento local,
  // no una suposición sobre lo que dijo el agente.
  { nombre: "Lourdes", municipio: "Colón" },
];

const MUNICIPIOS = [
  "San Salvador", "Santa Tecla", "Antiguo Cuscatlán", "Nuevo Cuscatlán",
  "La Libertad", "Colón", "Zaragoza", "Soyapango", "Mejicanos", "Ilopango",
  "San Marcos", "Apopa", "Ciudad Delgado", "Cuscatancingo", "Ayutuxtepeque",
  "Santa Ana", "San Miguel", "Sonsonate", "Usulután", "Ahuachapán",
  "Chalatenango", "Cojutepeque", "Zacatecoluca", "San Vicente", "Metapán",
  "La Unión", "Comalapa", "Olocuilta", "San Juan Opico", "Quezaltepeque",
];

const PREFIJO_ZONA = /\b(colonia|residencial|reparto|urbanizacion|barrio|condominio|lotificacion|villas|pasaje|km|kilometro)\b/;

// Palabras donde se corta la captura del nombre de una zona o de una persona.
const CORTE = new Set([
  "de", "del", "la", "el", "los", "las", "en", "con", "por", "para", "y", "o",
  "que", "es", "esta", "tiene", "son", "precio", "cuesta", "vale", "piden",
  "casa", "apartamento", "terreno", "local", "alquiler", "venta", "renta",
  "deposito", "dueno", "duena", "propietario", "propietaria", "telefono",
  "habitaciones", "habitacion", "banos", "bano", "metros", "varas", "parqueos",
  "exclusiva", "exclusividad", "contrato", "minimo", "mes", "meses",
]);

// ── Extracción ──

export function extraerDeDictado(texto: string): Extraccion {
  const original = (texto ?? "").trim();
  const norm = normalizar(original);
  const tokens = tokenizar(norm);
  const cantidades = hallarCantidades(tokens);
  const avisos: string[] = [];
  const out: Extraccion = { descripcion: original, faltantes: [], avisos };

  // Lo que se le muestra al agente es su propia frase, sin la coma de la que
  // venía pegada.
  const trozo = (ini: number, fin: number) =>
    original.slice(ini, fin).trim().replace(/^[.,;:]+|[.,;:]+$/g, "");
  const tokenEn = (i: number) => tokens[i]?.t ?? "";

  // Cantidad seguida de una unidad: "tres habitaciones", "150 metros".
  function porUnidad(re: RegExp): Cantidad | null {
    for (const c of cantidades) {
      if (c.usada) continue;
      if (re.test(tokenEn(c.hasta + 1))) return c;
    }
    return null;
  }

  function fijar<T>(campo: keyof Extraccion, valor: T, ini: number, fin: number) {
    (out as unknown as Record<string, unknown>)[campo] = { valor, dicho: trozo(ini, fin) };
  }

  // ── Tipo de propiedad ──
  const TIPOS: Array<[RegExp, TipoPropiedad]> = [
    [/\b(casa|casita|chalet)\b/, "casa"],
    [/\b(apartamento|apartamentos|apto|aptos|departamento|depa)\b/, "apartamento"],
    [/\b(terreno|terrenos|lote|lotes|solar|predio)\b/, "terreno"],
    [/\b(local|locales|bodega)\b/, "local"],
  ];
  for (const [re, tipo] of TIPOS) {
    const m = re.exec(norm);
    if (m) {
      fijar("tipo", tipo, m.index, m.index + m[0].length);
      break;
    }
  }

  // ── Operación ──
  const alquiler = /\b(alquiler|alquilar|alquila|alquilo|renta|rentar|rento|arrendar|arriendo)\b/.exec(norm);
  const venta = /\b(venta|vender|vendo|vende|se vende)\b/.exec(norm);
  if (alquiler && (!venta || alquiler.index < venta.index)) {
    fijar("operacion", "alquiler" as TipoOperacion, alquiler.index, alquiler.index + alquiler[0].length);
  } else if (venta) {
    fijar("operacion", "venta" as TipoOperacion, venta.index, venta.index + venta[0].length);
  }

  // ── Habitaciones, baños, parqueos ──
  const hab = porUnidad(UNIDAD_HABITACION);
  if (hab) {
    hab.usada = true;
    fijar("habitaciones", hab.valor, hab.ini, tokens[hab.hasta + 1].fin);
  }

  const ban = porUnidad(UNIDAD_BANO);
  if (ban) {
    ban.usada = true;
    // "dos baños y medio": el medio baño es real y cuenta.
    const siguiente = tokens[ban.hasta + 2]?.t;
    const luego = tokens[ban.hasta + 3]?.t;
    const medio = siguiente === "y" && luego === "medio";
    const fin = medio ? tokens[ban.hasta + 3].fin : tokens[ban.hasta + 1].fin;
    fijar("banos", ban.valor + (medio ? 0.5 : 0), ban.ini, fin);
  } else {
    // "baño y medio", sin número delante.
    const m = /\bbano y medio\b/.exec(norm);
    if (m) fijar("banos", 1.5, m.index, m.index + m[0].length);
  }

  const par = porUnidad(UNIDAD_PARQUEO);
  if (par) {
    par.usada = true;
    fijar("parqueos", par.valor, par.ini, tokens[par.hasta + 1].fin);
  } else {
    // "con cochera", "tiene garaje": dijo que hay uno.
    const m = /\b(cochera|garaje|parqueo|estacionamiento)\b/.exec(norm);
    if (m) fijar("parqueos", 1, m.index, m.index + m[0].length);
  }

  // ── Áreas ──
  const metros = porUnidad(UNIDAD_METRO);
  if (metros) {
    metros.usada = true;
    const fin = tokens[metros.hasta + 1].fin;
    // "200 metros de terreno": el dato es del terreno aunque la unidad no sea
    // la de la escritura. Se guarda donde va y se avisa, no se convierte a
    // varas por cuenta propia.
    const cola = norm.slice(fin, fin + 22);
    if (/^\s*(cuadrados?\s*)?de\s+terreno/.test(cola)) {
      fijar("areaTerreno", metros.valor, metros.ini, fin);
      avisos.push("Dictó el terreno en metros y el campo va en varas: revisá el número.");
    } else {
      fijar("areaConstruccion", metros.valor, metros.ini, fin);
    }
  }
  const varas = porUnidad(UNIDAD_VARA);
  if (varas) {
    varas.usada = true;
    fijar("areaTerreno", varas.valor, varas.ini, tokens[varas.hasta + 1].fin);
  }

  // ── Plazo del contrato y exclusiva (los dos hablan de meses) ──
  const exclusivaM = /\b(exclusiva|exclusividad)\b/.exec(norm);
  if (exclusivaM) {
    fijar("exclusiva", true, exclusivaM.index, exclusivaM.index + exclusivaM[0].length);
  }

  for (const c of cantidades) {
    if (c.usada) continue;
    const unidad = tokenEn(c.hasta + 1);
    const esMes = UNIDAD_MES.test(unidad);
    const esAnio = UNIDAD_ANIO.test(unidad);
    if (!esMes && !esAnio) continue;
    const meses = esAnio ? c.valor * 12 : c.valor;
    const antes = norm.slice(Math.max(0, c.ini - 34), c.ini);
    const fin = tokens[c.hasta + 1].fin;
    if (/\b(exclusiva|exclusividad)\b[^.]*$/.test(antes)) {
      c.usada = true;
      // Se guarda en días porque así lo mide la cartera.
      fijar("exclusivaEnDias", Math.round(meses * 30), c.ini, fin);
    } else if (/\b(contrato|plazo|minimo|minima)\b[^.]*$/.test(antes)) {
      c.usada = true;
      fijar("plazoMinimoMeses", meses, c.ini, fin);
    }
  }

  // ── Dinero ──
  interface Money {
    c: Cantidad;
    fin: number;
    mensual: boolean;
    deposito: boolean;
    puntaje: number;
  }
  const platas: Money[] = [];
  for (const c of cantidades) {
    if (c.usada) continue;
    const siguiente = tokenEn(c.hasta + 1);
    const unidadDura =
      UNIDAD_HABITACION.test(siguiente) ||
      UNIDAD_BANO.test(siguiente) ||
      UNIDAD_PARQUEO.test(siguiente) ||
      UNIDAD_METRO.test(siguiente) ||
      UNIDAD_VARA.test(siguiente) ||
      UNIDAD_MES.test(siguiente) ||
      UNIDAD_ANIO.test(siguiente);
    if (unidadDura) continue;

    const conDolar = PALABRA_DOLAR.test(siguiente);
    const fin = conDolar ? tokens[c.hasta + 1].fin : c.fin;
    const cola = norm.slice(fin, fin + 26);
    const mensual = /^\s*(dolares?\s*)?(al mes|por mes|mensual(es)?|cada mes)/.test(cola);
    const antes = norm.slice(Math.max(0, c.ini - 30), c.ini);
    const marcaPrecio = MARCA_PRECIO.test(antes);
    const marcaRenta = MARCA_RENTA.test(antes);
    const marcaDeposito = MARCA_DEPOSITO.test(antes);

    // Sin ninguna de estas señales, un número suelto NO es dinero: puede ser el
    // año de construcción o cualquier cosa que dijo de pasada.
    if (!c.dolar && !conDolar && !c.multiplicador && !mensual && !marcaPrecio && !marcaRenta && !marcaDeposito) {
      continue;
    }

    let puntaje = 0;
    if (marcaPrecio) puntaje += 5;
    if (c.dolar || conDolar) puntaje += 3;
    if (c.multiplicador) puntaje += 2;
    if (mensual || marcaRenta) puntaje += 2;
    platas.push({ c, fin, mensual: mensual || marcaRenta, deposito: marcaDeposito, puntaje });
  }

  const dep = platas.find((p) => p.deposito);
  if (dep) {
    dep.c.usada = true;
    fijar("deposito", dep.c.valor, dep.c.ini, dep.fin);
  }
  const precio = platas
    .filter((p) => !p.deposito)
    .sort((a, b) => b.puntaje - a.puntaje || a.c.ini - b.c.ini)[0];
  if (precio) {
    precio.c.usada = true;
    fijar("precio", precio.c.valor, precio.c.ini, precio.fin);
    // "seiscientos cincuenta al mes" dice el precio Y la operación.
    if (precio.mensual && !out.operacion) {
      fijar("operacion", "alquiler" as TipoOperacion, precio.c.ini, precio.fin);
    }
  }

  // ── Dónde queda ──
  // Con límite de palabra o "Colón" se encontraría dentro de "colonia".
  const dondeDice = (nombre: string): number => {
    const n = normalizar(nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return norm.search(new RegExp(`\\b${n}\\b`));
  };
  for (const z of ZONAS_CONOCIDAS) {
    const i = dondeDice(z.nombre);
    if (i === -1) continue;
    fijar("zona", z.nombre, i, i + z.nombre.length);
    if (z.municipio) fijar("municipio", z.municipio, i, i + z.nombre.length);
    break;
  }
  for (const m of MUNICIPIOS) {
    const i = dondeDice(m);
    if (i === -1) continue;
    // El municipio dicho de frente le gana al que se dedujo de la zona.
    fijar("municipio", m, i, i + m.length);
    break;
  }
  if (!out.zona) {
    const pref = PREFIJO_ZONA.exec(norm);
    if (pref) {
      const desde = pref.index + pref[0].length;
      const nombre = capturarNombre(original, norm, desde, 3, true);
      if (nombre) {
        const prefijo = pref[0].charAt(0).toUpperCase() + pref[0].slice(1);
        fijar("zona", `${prefijo} ${nombre.texto}`, pref.index, nombre.fin);
      }
    }
  }

  // ── Propietario ──
  const duenio =
    /\b(?:el|la)\s+(?:dueno|duena|propietario|propietaria)\s+(?:es|se llama)\s+/.exec(norm) ??
    /\b(?:es de|pertenece a)\s+(?:don|dona|senor|senora|sr|sra)?\s*/.exec(norm);
  if (duenio) {
    const desde = duenio.index + duenio[0].length;
    const nombre = capturarNombre(original, norm, desde, 4, true);
    if (nombre) fijar("propietarioNombre", nombre.texto, desde, nombre.fin);
  }
  const tel = /(?:\+?503[\s-]?)?\b([267]\d{3})[\s-]?(\d{4})\b/.exec(norm);
  if (tel) {
    fijar("propietarioTelefono", `+503 ${tel[1]} ${tel[2]}`, tel.index, tel.index + tel[0].length);
  }

  out.faltantes = faltantesDe(out);
  return out;
}

// Toma hasta `max` palabras desde una posición, cortando en las palabras que
// nunca son parte de un nombre. Devuelve el texto ORIGINAL (con tildes), no el
// normalizado.
function capturarNombre(
  original: string,
  norm: string,
  desde: number,
  max: number,
  persona = false,
): { texto: string; fin: number } | null {
  const re = /[a-z]+/g;
  re.lastIndex = desde;
  const palabras: Array<{ ini: number; fin: number }> = [];
  let m: RegExpExecArray | null;
  while (palabras.length < max && (m = re.exec(norm))) {
    // Solo palabras seguidas: si hay un signo de puntuación de por medio, corta.
    const hueco = norm.slice(palabras.length ? palabras[palabras.length - 1].fin : desde, m.index);
    if (/[.,;:!?]/.test(hueco)) break;
    if (CORTE.has(m[0])) {
      if (palabras.length === 0 && (m[0] === "de" || m[0] === "la" || m[0] === "el")) continue;
      break;
    }
    palabras.push({ ini: m.index, fin: m.index + m[0].length });
  }
  if (palabras.length === 0) return null;
  const fin = palabras[palabras.length - 1].fin;
  const bruto = original.slice(palabras[0].ini, fin).trim();
  if (bruto.length < 3) return null;
  const texto = persona
    ? bruto
        .split(/\s+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ")
    : bruto;
  return { texto, fin };
}

// Lo que hay que preguntarle antes de guardar, según lo que sí entendió. Se
// calcula con lo que la propiedad NECESITA: a un terreno no se le reclaman
// baños.
export function faltantesDe(e: Extraccion): CampoAlta[] {
  const tipo = e.tipo?.valor;
  const faltan: CampoAlta[] = [];
  const pedir = (campo: CampoAlta, hay: unknown) => {
    if (hay === undefined || hay === null) faltan.push(campo);
  };
  pedir("operacion", e.operacion);
  pedir("tipo", e.tipo);
  pedir("precio", e.precio);
  pedir("zona", e.zona);
  pedir("municipio", e.municipio);
  if (tipo === "casa" || tipo === "apartamento") {
    pedir("habitaciones", e.habitaciones);
    pedir("banos", e.banos);
    pedir("areaConstruccion", e.areaConstruccion);
  }
  if (tipo === "terreno") pedir("areaTerreno", e.areaTerreno);
  if (tipo === "local") pedir("areaConstruccion", e.areaConstruccion);
  if (e.operacion?.valor === "alquiler") {
    pedir("deposito", e.deposito);
    pedir("plazoMinimoMeses", e.plazoMinimoMeses);
  }
  pedir("propietarioNombre", e.propietarioNombre);
  pedir("propietarioTelefono", e.propietarioTelefono);
  return faltan;
}
