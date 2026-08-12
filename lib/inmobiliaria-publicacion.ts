// Publicación asistida: arma el anuncio de una propiedad de la cartera.
//
// FRONTERA: el texto y el ORDEN de las fotos se generan; las FOTOS no. Nunca se
// crea ni se retoca la imagen de una propiedad, solo se compone encima de las
// que ya están en la ficha (precio, zona y datos sobre la foto principal).
// Publicar una casa con fotos inventadas es publicidad falsa, y además el
// comprador lo descubre en la primera visita.
//
// Todo lo de aquí es puro: entra una propiedad, sale el anuncio. La composición
// de la imagen se hace en el navegador con canvas (ver app/publicacion).

import { dinero, fechaLarga, metros, plazo, precioDe, varas } from "./inmobiliaria-formato";
import {
  OPERACION_EN,
  TIPO_NOMBRE,
  type Ambiente,
  type Anuncio,
  type Foto,
  type Propiedad,
  type TipoPropiedad,
} from "./inmobiliaria-tipos";

// En qué orden se ven las fotos de cada tipo de propiedad. La primera es la que
// decide el clic, así que no puede quedar el baño arriba solo porque el agente
// la subió primero.
const PRIORIDAD: Record<TipoPropiedad, Ambiente[]> = {
  casa: ["fachada", "sala", "cocina", "patio", "habitacion", "bano", "plano"],
  apartamento: ["sala", "cocina", "habitacion", "bano", "patio", "fachada", "plano"],
  terreno: ["terreno", "patio", "plano", "fachada"],
  local: ["local", "plano", "bano", "fachada"],
};

const EXPLICACION: Record<TipoPropiedad, string> = {
  casa: "La fachada abre el carrusel porque es la foto que decide el clic; después los espacios sociales y de último los privados.",
  apartamento:
    "Abre la sala: en un apartamento la fachada del edificio no vende, y el plano se deja para el final.",
  terreno:
    "Abre la vista del terreno y el plano va de último, cuando el interesado ya quiere medidas.",
  local: "Abre el frente sobre la calle, que es lo que le importa a quien va a poner un negocio.",
};

// Ordena sin perder ninguna: lo que no está en la tabla se va al final,
// respetando el orden en que el agente las cargó.
export function ordenarFotos(fotos: Foto[], tipo: TipoPropiedad): Foto[] {
  const prioridad = PRIORIDAD[tipo];
  const peso = (f: Foto) => {
    const i = prioridad.indexOf(f.ambiente);
    return i === -1 ? prioridad.length : i;
  };
  return fotos
    .map((foto, i) => ({ foto, i }))
    .sort((a, b) => peso(a.foto) - peso(b.foto) || a.i - b.i)
    .map((x) => x.foto);
}

export function tituloDe(p: Propiedad): string {
  const base = `${TIPO_NOMBRE[p.tipo]} ${OPERACION_EN[p.operacion]} en ${p.zona}, ${p.municipio}`;
  if (p.tipo === "terreno") return `${base}, ${varas(p.areaTerreno)}`;
  if (p.tipo === "local") return `${base}, ${metros(p.areaConstruccion)}`;
  return `${base}, ${p.habitaciones} habitaciones`;
}

// Las dos condiciones que decide si alguien puede alquilar o no, y que si no van
// en el anuncio se preguntan cincuenta veces por WhatsApp.
export function condicionesDeAlquiler(p: Propiedad): string[] {
  if (p.operacion !== "alquiler") return [];
  const out: string[] = [];
  if (p.deposito && p.deposito > 0) out.push(`Depósito: ${dinero(p.deposito)}`);
  if (p.plazoMinimoMeses && p.plazoMinimoMeses > 0) {
    out.push(`Contrato mínimo: ${plazo(p.plazoMinimoMeses)}`);
  }
  return out;
}

// Los datos duros en una línea, con la unidad que se usa en la escritura.
export function fichaEnLinea(p: Propiedad): string[] {
  const datos: string[] = [];
  if (p.habitaciones > 0) {
    datos.push(`${p.habitaciones} ${p.habitaciones === 1 ? "habitación" : "habitaciones"}`);
  }
  if (p.banos > 0) datos.push(`${p.banos} ${p.banos === 1 ? "baño" : "baños"}`);
  if (p.parqueos > 0) datos.push(`${p.parqueos} ${p.parqueos === 1 ? "parqueo" : "parqueos"}`);
  if (p.areaConstruccion > 0) datos.push(`${metros(p.areaConstruccion)} de construcción`);
  if (p.areaTerreno > 0) datos.push(`${varas(p.areaTerreno)} de terreno`);
  return datos;
}

export function descripcionDe(p: Propiedad): string {
  const partes: string[] = [p.resumen, "", fichaEnLinea(p).join(" · ")];
  if (p.caracteristicas.length > 0) {
    partes.push("", ...p.caracteristicas.map((c) => `• ${c}`));
  }
  if (p.anio) partes.push("", `Año de construcción: ${p.anio}.`);
  const condiciones = condicionesDeAlquiler(p);
  if (condiciones.length > 0) partes.push("", ...condiciones.map((c) => `• ${c}`));
  partes.push(
    "",
    p.operacion === "alquiler"
      ? `Renta: ${precioDe(p)}. Código ${p.codigo}.`
      : `Precio: ${dinero(p.precio)}. Código ${p.codigo}.`,
    "Escríbenos por WhatsApp y coordinamos la visita.",
  );
  return partes.join("\n");
}

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

// Los portales piden el departamento, no el municipio. Casi toda la cartera del
// área metropolitana cae en La Libertad aunque la gente diga "Santa Tecla".
const DEPARTAMENTO: Record<string, string> = {
  "San Salvador": "San Salvador",
  "Santa Tecla": "La Libertad",
  "Antiguo Cuscatlán": "La Libertad",
  "Nuevo Cuscatlán": "La Libertad",
  "La Libertad": "La Libertad",
  Colón: "La Libertad",
};

export function departamentoDe(municipio: string): string {
  return DEPARTAMENTO[municipio] ?? municipio;
}

function etiqueta(s: string): string {
  return `#${sinAcentos(s).replace(/[^a-zA-Z0-9]/g, "")}`;
}

export function hashtagsDe(p: Propiedad): string[] {
  const venta: Record<TipoPropiedad, string> = {
    casa: "#CasaEnVenta",
    apartamento: "#ApartamentoEnVenta",
    terreno: "#TerrenoEnVenta",
    local: "#LocalComercial",
  };
  // Quien busca alquiler no busca con las mismas palabras que quien compra.
  const alquiler: Record<TipoPropiedad, string> = {
    casa: "#CasaEnAlquiler",
    apartamento: "#ApartamentoEnAlquiler",
    terreno: "#TerrenoEnAlquiler",
    local: "#LocalEnAlquiler",
  };
  const tipo = p.operacion === "alquiler" ? alquiler : venta;
  return [
    "#BienesRaicesSV",
    tipo[p.tipo],
    etiqueta(p.municipio),
    etiqueta(p.zona),
    "#ElSalvador",
    "#Terrazul",
  ];
}

// Versión para pegar en Encuentra24. El portal se llena a mano: aquí solo se
// deja el texto con los campos en el mismo orden en que los pide el formulario.
export function encuentra24De(p: Propiedad): string {
  const monto = `US$ ${Math.round(p.precio).toLocaleString("en-US")}`;
  const filas: Array<[string, string]> = [
    ["Título", tituloDe(p)],
    ["Tipo", `${TIPO_NOMBRE[p.tipo]} ${OPERACION_EN[p.operacion]}`],
    [p.operacion === "alquiler" ? "Renta mensual" : "Precio", monto],
    ["Departamento", departamentoDe(p.municipio)],
    ["Ubicación", `${p.zona}, ${p.municipio}`],
  ];
  if (p.operacion === "alquiler") {
    if (p.deposito && p.deposito > 0) {
      filas.push(["Depósito", `US$ ${Math.round(p.deposito).toLocaleString("en-US")}`]);
    }
    if (p.plazoMinimoMeses && p.plazoMinimoMeses > 0) {
      filas.push(["Contrato mínimo", `${p.plazoMinimoMeses} meses`]);
    }
  }
  if (p.habitaciones > 0) filas.push(["Habitaciones", String(p.habitaciones)]);
  if (p.banos > 0) filas.push(["Baños", String(p.banos)]);
  if (p.parqueos > 0) filas.push(["Parqueos", String(p.parqueos)]);
  if (p.areaConstruccion > 0) filas.push(["Área construida", metros(p.areaConstruccion)]);
  if (p.areaTerreno > 0) filas.push(["Área de terreno", varas(p.areaTerreno)]);
  if (p.anio) filas.push(["Año", String(p.anio)]);
  filas.push(["Código", p.codigo]);

  return [
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    "Descripción:",
    descripcionDe(p),
  ].join("\n");
}

// Los datos que se estampan sobre la foto: pocos y grandes, los que deciden si
// alguien se detiene.
export function datosDePortada(p: Propiedad): string[] {
  if (p.tipo === "terreno") return [varas(p.areaTerreno)];
  if (p.tipo === "local") {
    const d = [metros(p.areaConstruccion)];
    if (p.parqueos > 0) d.push(`${p.parqueos} parqueos`);
    return d;
  }
  const d = [`${p.habitaciones} hab`, `${p.banos} baños`];
  if (p.areaConstruccion > 0) d.push(metros(p.areaConstruccion));
  return d;
}

export function armarAnuncio(p: Propiedad): Anuncio {
  const carrusel = ordenarFotos(p.fotos, p.tipo);

  const bloqueo =
    p.estado === "vendida"
      ? p.operacion === "alquiler"
        ? `${p.codigo} ya está alquilada. Publicarla trae interesados por algo que ya no existe y quema el anuncio.`
        : `${p.codigo} está vendida. Publicarla trae interesados por algo que ya no existe y quema el anuncio.`
      : null;

  const avisos: string[] = [];
  if (p.estado === "apartada") {
    avisos.push(
      p.operacion === "alquiler"
        ? "Está reservada: si se publica, hay que decirlo en el anuncio y no agendar visitas nuevas sin avisar al propietario."
        : "Está apartada: si se publica, hay que decirlo en el anuncio y no agendar visitas nuevas sin avisar al propietario.",
    );
  }
  if (p.exclusivaVencida && p.exclusivaHasta) {
    avisos.push(
      `La exclusiva venció el ${fechaLarga(p.exclusivaHasta)}. Renovarla antes de invertir en pauta.`,
    );
  } else if (p.exclusivaPorVencer && p.exclusivaHasta) {
    avisos.push(
      `La exclusiva vence el ${fechaLarga(p.exclusivaHasta)}, en ${p.diasDeExclusiva} días.`,
    );
  }

  return {
    titulo: tituloDe(p),
    descripcion: descripcionDe(p),
    hashtags: hashtagsDe(p),
    encuentra24: encuentra24De(p),
    carrusel,
    ordenExplicado: EXPLICACION[p.tipo],
    portada: {
      precio: precioDe(p),
      etiqueta: `${TIPO_NOMBRE[p.tipo]} ${OPERACION_EN[p.operacion]}`,
      zona: `${p.zona}, ${p.municipio}`,
      tipo: TIPO_NOMBRE[p.tipo],
      codigo: p.codigo,
      datos: datosDePortada(p),
      foto: carrusel[0] ?? null,
    },
    bloqueo,
    advertencia: avisos.length > 0 ? avisos.join(" ") : null,
  };
}
