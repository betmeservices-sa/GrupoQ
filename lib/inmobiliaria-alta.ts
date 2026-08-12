// Alta de una propiedad desde el teléfono, parado frente a la casa.
//
// Puro a propósito: valida y arma la ficha, no guarda nada. Quien guarda es
// inmobiliaria-store. Así el formulario del teléfono, la ruta de API y los tests
// usan exactamente las mismas reglas, y no hay una validación en la pantalla y
// otra distinta en el servidor.

import { OPERACIONES, type Ambiente, type Foto, type PropiedadSemilla, type TipoOperacion, type TipoPropiedad } from "./inmobiliaria-tipos";

// Lo que el agente llena (o dicta) parado en la acera. Todo lo que no dijo se
// queda vacío: nada se rellena por él.
export interface AltaPropiedad {
  operacion: TipoOperacion;
  tipo: TipoPropiedad;
  precio: number; // venta: total. alquiler: renta MENSUAL.
  deposito?: number;
  plazoMinimoMeses?: number;
  zona: string;
  municipio: string;
  habitaciones: number;
  banos: number;
  parqueos: number;
  areaConstruccion: number; // m²
  areaTerreno: number; // v²
  descripcion: string;
  propietario: { nombre: string; telefono: string };
  exclusiva: boolean;
  exclusivaEnDias?: number;
  fotos: Foto[];
}

export interface ProblemaAlta {
  campo: keyof AltaPropiedad | "fotos" | "propietario";
  problema: string;
}

const TIPOS: TipoPropiedad[] = ["casa", "apartamento", "terreno", "local"];

// Un teléfono salvadoreño de verdad: 8 dígitos y empieza en 2 (fijo), 6 o 7
// (celular). Se valida sobre los dígitos, sin importar cómo lo escribió.
export function telefonoValido(t: string): boolean {
  const d = (t || "").replace(/\D/g, "").replace(/^503/, "");
  return /^[267]\d{7}$/.test(d);
}

export function normalizarTelefono(t: string): string {
  const d = (t || "").replace(/\D/g, "").replace(/^503/, "");
  return d.length === 8 ? `+503 ${d.slice(0, 4)} ${d.slice(4)}` : (t || "").trim();
}

// Devuelve TODOS los problemas juntos, no el primero: en el teléfono nadie
// quiere descubrir de a uno lo que le falta.
export function validarAlta(a: Partial<AltaPropiedad>): ProblemaAlta[] {
  const malos: ProblemaAlta[] = [];
  const push = (campo: ProblemaAlta["campo"], problema: string) => malos.push({ campo, problema });

  if (!a.operacion || !OPERACIONES.includes(a.operacion)) push("operacion", "Falta decir si es venta o alquiler");
  if (!a.tipo || !TIPOS.includes(a.tipo)) push("tipo", "Falta el tipo de propiedad");

  if (!a.precio || a.precio <= 0) {
    push("precio", a.operacion === "alquiler" ? "Falta la renta mensual" : "Falta el precio");
  } else if (a.operacion === "alquiler" && a.precio > 20000) {
    // Una renta de cinco cifras casi siempre es el precio de venta mal metido.
    push("precio", "Esa renta se ve como precio de venta. Confirmalo.");
  }

  if (!a.zona?.trim()) push("zona", "Falta la zona o colonia");
  if (!a.municipio?.trim()) push("municipio", "Falta el municipio");

  if (a.tipo === "casa" || a.tipo === "apartamento") {
    if (!a.habitaciones || a.habitaciones < 1) push("habitaciones", "Falta cuántas habitaciones tiene");
    if (!a.banos || a.banos < 1) push("banos", "Falta cuántos baños tiene");
    if (!a.areaConstruccion || a.areaConstruccion <= 0) push("areaConstruccion", "Falta el área de construcción");
  }
  if (a.tipo === "terreno" && (!a.areaTerreno || a.areaTerreno <= 0)) {
    push("areaTerreno", "Falta el área del terreno");
  }
  if (a.tipo === "local" && (!a.areaConstruccion || a.areaConstruccion <= 0)) {
    push("areaConstruccion", "Falta el área del local");
  }

  if (!a.propietario?.nombre?.trim()) push("propietario", "Falta el nombre del propietario");
  if (!telefonoValido(a.propietario?.telefono ?? "")) push("propietario", "El teléfono del propietario no se ve completo");

  if (!a.fotos || a.fotos.length === 0) push("fotos", "Falta al menos una foto");

  if (a.exclusiva && (!a.exclusivaEnDias || a.exclusivaEnDias <= 0)) {
    push("exclusivaEnDias", "Falta hasta cuándo va la exclusiva");
  }
  return malos;
}

// El siguiente código de la casa. Sigue la serie que ya usa el agente al hablar
// (TZ-101, TZ-102...) en vez de inventar un id que nadie va a poder decir por
// teléfono.
export function siguienteCodigo(existentes: string[], prefijo = "TZ"): string {
  const numeros = existentes
    .map((c) => new RegExp(`^${prefijo}-(\\d+)$`, "i").exec(c.trim()))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  const siguiente = numeros.length ? Math.max(...numeros) + 1 : 101;
  return `${prefijo}-${siguiente}`;
}

// El título se arma con los datos que dio, no con adjetivos: "Casa de 3
// habitaciones en Las Colinas, Santa Tecla". Si el agente quiere otro, lo edita
// en la publicación.
export function tituloDesdeAlta(a: AltaPropiedad): string {
  const nombre: Record<TipoPropiedad, string> = {
    casa: "Casa",
    apartamento: "Apartamento",
    terreno: "Terreno",
    local: "Local comercial",
  };
  const donde = `${a.zona}, ${a.municipio}`;
  if (a.tipo === "terreno" || a.tipo === "local") return `${nombre[a.tipo]} en ${donde}`;
  const hab = a.habitaciones > 0 ? ` de ${a.habitaciones} ${a.habitaciones === 1 ? "habitación" : "habitaciones"}` : "";
  return `${nombre[a.tipo]}${hab} en ${donde}`;
}

// Frase de respaldo cuando no dictó descripción: SOLO repite los datos duros que
// él mismo cargó. No es un texto de venta, es la ficha en una línea; inventarle
// "acogedora" o "con mucha luz" a una casa que nadie vio sería mentir.
export function resumenDesdeAlta(a: AltaPropiedad): string {
  const dicho = a.descripcion.trim();
  if (dicho) return dicho;
  return `${tituloDesdeAlta(a)}.`;
}

export function propiedadDesdeAlta(
  a: AltaPropiedad,
  ids: { id: string; codigo: string },
): PropiedadSemilla {
  return {
    id: ids.id,
    codigo: ids.codigo,
    operacion: a.operacion,
    tipo: a.tipo,
    titulo: tituloDesdeAlta(a),
    zona: a.zona.trim(),
    municipio: a.municipio.trim(),
    precio: Math.round(a.precio),
    deposito: a.operacion === "alquiler" && a.deposito ? Math.round(a.deposito) : undefined,
    plazoMinimoMeses:
      a.operacion === "alquiler" && a.plazoMinimoMeses ? Math.round(a.plazoMinimoMeses) : undefined,
    estado: "disponible",
    // Entra SIN publicar. Se marca publicada cuando de verdad salió el post, no
    // cuando se guardó la ficha: si no, la alerta de "publicada sin estar"
    // empieza a mentir desde el primer día.
    publicada: false,
    habitaciones: Math.max(0, Math.round(a.habitaciones || 0)),
    banos: Math.max(0, a.banos || 0),
    parqueos: Math.max(0, Math.round(a.parqueos || 0)),
    areaConstruccion: Math.max(0, Math.round(a.areaConstruccion || 0)),
    areaTerreno: Math.max(0, Math.round(a.areaTerreno || 0)),
    propietario: {
      nombre: a.propietario.nombre.trim(),
      telefono: normalizarTelefono(a.propietario.telefono),
    },
    exclusiva: Boolean(a.exclusiva),
    exclusivaEnDias: a.exclusiva ? a.exclusivaEnDias : undefined,
    caracteristicas: [],
    resumen: resumenDesdeAlta(a),
    fotos: a.fotos,
  };
}

// Ambientes que ofrece el selector de cada foto, en el orden en que se camina
// una casa. El que no se elige queda como "fachada" solo si es la primera.
export const AMBIENTES_ALTA: Ambiente[] = [
  "fachada",
  "sala",
  "cocina",
  "habitacion",
  "bano",
  "patio",
  "terreno",
  "local",
  "plano",
];
