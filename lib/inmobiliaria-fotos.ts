// Qué fotos entran al anuncio, decidido con números y no con un modelo.
//
// Por qué determinista: el agente acaba de tomar diez fotos con una mano, media
// contra el sol y una caminando. Hay que descartar las que están movidas u
// oscuras ANTES de publicar, y hay que poder decirle POR QUÉ se cayó cada una.
// Un modelo diría "esta se ve mejor" sin poder justificarlo, costaría llave y
// no se podría probar. Esto son cuatro medidas del pixel, se calculan en el
// navegador en milisegundos y están cubiertas por tests.
//
// Las cuatro medidas y por qué:
//   1. Resolución: por debajo de 800 px de lado largo el feed la escala hacia
//      arriba y se ve deshecha (Instagram sirve a 1080).
//   2. Nitidez: varianza del laplaciano, el detector de desenfoque de siempre.
//      Una foto movida pierde los bordes y su laplaciano se aplana.
//   3. Luz: brillo medio más cuánto se fue a negro y cuánto se quemó. Interior
//      a contraluz (medio cuadro en sombra) o patio al mediodía (cielo blanco)
//      no venden nada.
//   4. Encuadre: una panorámica o una tira vertical se destroza en el recorte
//      4:5 de Instagram, así que pierde puntos.
//
// Lo que este módulo NO hace: ordenar el carrusel. Eso lo decide el AMBIENTE
// (ver inmobiliaria-publicacion): la fachada abre aunque la foto de la cocina
// tenga mejor puntaje.

export interface MedidaFoto {
  src: string;
  ancho: number; // el original, no el reducido con el que se midió
  alto: number;
  nitidez: number; // varianza del laplaciano
  luz: number; // brillo medio 0..255
  sombras: number; // fracción de píxeles casi negros
  quemado: number; // fracción de píxeles casi blancos
}

export interface JuicioFoto {
  medida: MedidaFoto;
  puntaje: number; // 0..100
  entra: boolean;
  motivo: string | null; // por qué se cayó, en palabras del agente
  notas: string[]; // lo que le suma o le resta, para poder explicarlo
}

// Umbrales. Están sueltos a propósito: sirven para tirar la basura evidente, no
// para hacer de jurado de fotografía.
export const MIN_LADO = 800;
export const NITIDEZ_MIN = 8;
export const LUZ_MIN = 45;
export const LUZ_MAX = 215;
export const SOMBRAS_MAX = 0.5;
export const QUEMADO_MAX = 0.28;
export const RATIO_MIN = 0.5; // más angosta que esto es una tira vertical
export const RATIO_MAX = 2.2; // más ancha que esto es una panorámica

// Gris perceptual (Rec. 601). El ojo pesa el verde más que el azul, y el
// desenfoque se nota en la luminancia, no en el color.
export function aGris(rgba: Uint8ClampedArray | number[]): Float32Array {
  const n = rgba.length / 4;
  const gris = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    gris[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return gris;
}

// Varianza del laplaciano + estadísticas de luz, sobre la imagen en gris.
export function medirGris(
  gris: Float32Array,
  ancho: number,
  alto: number,
): Pick<MedidaFoto, "nitidez" | "luz" | "sombras" | "quemado"> {
  let suma = 0;
  let sombras = 0;
  let quemado = 0;
  for (let i = 0; i < gris.length; i++) {
    suma += gris[i];
    if (gris[i] <= 24) sombras++;
    if (gris[i] >= 246) quemado++;
  }
  const luz = gris.length ? suma / gris.length : 0;

  // Laplaciano de 4 vecinos, ignorando el borde.
  let sumaL = 0;
  let sumaL2 = 0;
  let cuenta = 0;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      const l =
        gris[i - 1] + gris[i + 1] + gris[i - ancho] + gris[i + ancho] - 4 * gris[i];
      sumaL += l;
      sumaL2 += l * l;
      cuenta++;
    }
  }
  const media = cuenta ? sumaL / cuenta : 0;
  const nitidez = cuenta ? sumaL2 / cuenta - media * media : 0;
  return {
    nitidez,
    luz,
    sombras: gris.length ? sombras / gris.length : 0,
    quemado: gris.length ? quemado / gris.length : 0,
  };
}

export function medirImageData(
  src: string,
  rgba: Uint8ClampedArray | number[],
  anchoMuestra: number,
  altoMuestra: number,
  original?: { ancho: number; alto: number },
): MedidaFoto {
  const medidas = medirGris(aGris(rgba), anchoMuestra, altoMuestra);
  return {
    src,
    ancho: original?.ancho ?? anchoMuestra,
    alto: original?.alto ?? altoMuestra,
    ...medidas,
  };
}

export function juzgarFoto(m: MedidaFoto): JuicioFoto {
  const ladoLargo = Math.max(m.ancho, m.alto);
  const ratio = m.alto > 0 ? m.ancho / m.alto : 1;
  const notas: string[] = [];
  let motivo: string | null = null;

  // Orden de los descartes: primero lo que no tiene arreglo (la foto es chica),
  // después lo que se arregla volviéndola a tomar.
  if (ladoLargo < MIN_LADO) {
    motivo = `Muy chica (${m.ancho}x${m.alto}). En el feed se va a ver deshecha.`;
  } else if (m.nitidez < NITIDEZ_MIN) {
    motivo = "Movida o desenfocada. Volvé a tomarla apoyando el codo.";
  } else if (m.luz < LUZ_MIN || m.sombras > SOMBRAS_MAX) {
    motivo = "Oscura. Prendé la luz o esperá a que entre el sol.";
  } else if (m.luz > LUZ_MAX || m.quemado > QUEMADO_MAX) {
    motivo = "Quemada por el sol. Tomala de espaldas a la luz.";
  } else if (ratio < RATIO_MIN || ratio > RATIO_MAX) {
    motivo = "Muy alargada. El recorte del feed se come casi todo.";
  }

  // Puntaje 0..100 para ordenar las que sí entran. Pesa más la nitidez, que es
  // lo primero que se nota al pasar el dedo.
  const pNitidez = Math.min(1, m.nitidez / 60) * 45;
  const pLuz = (1 - Math.min(1, Math.abs(m.luz - 128) / 128)) * 25;
  const pResolucion = Math.min(1, ladoLargo / 1600) * 20;
  const pEncuadre = ratio >= 0.7 && ratio <= 1.6 ? 10 : 4;
  const puntaje = Math.round(pNitidez + pLuz + pResolucion + pEncuadre);

  if (m.nitidez >= 60) notas.push("Bien nítida");
  if (m.luz >= 90 && m.luz <= 170) notas.push("Buena luz");
  if (ladoLargo >= 1600) notas.push("Resolución de sobra");

  return { medida: m, puntaje, entra: motivo === null, motivo, notas };
}

// Instagram no acepta más de 10 en un carrusel, y nadie pasa de la sexta.
export const MAX_CARRUSEL = 10;

export interface Seleccion {
  entran: JuicioFoto[]; // ordenadas por puntaje, mejor primero
  fuera: JuicioFoto[];
}

export function elegirFotos(medidas: MedidaFoto[], max = MAX_CARRUSEL): Seleccion {
  const juicios = medidas.map(juzgarFoto);
  const buenas = juicios
    .filter((j) => j.entra)
    .sort((a, b) => b.puntaje - a.puntaje);
  const sobran = buenas.slice(max).map((j) => ({
    ...j,
    entra: false,
    motivo: `Sobra: el carrusel llega hasta ${max} fotos.`,
  }));
  return {
    entran: buenas.slice(0, max),
    fuera: [...juicios.filter((j) => !j.entra), ...sobran],
  };
}
