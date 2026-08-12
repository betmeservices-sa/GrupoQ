// Composición del arte del anuncio, en el navegador y sobre la foto REAL.
//
// FRONTERA (la misma de inmobiliaria-publicacion): la imagen no se genera ni se
// retoca. Se recorta al formato de la red y se le estampa encima el precio, la
// zona y los datos duros de la ficha. Publicar una casa con fotos inventadas es
// publicidad falsa, y el comprador lo descubre en la primera visita.
//
// Vive aparte de las pantallas porque lo usan dos: la de Publicación y el alta
// desde el teléfono, que publica sin pasar por ninguna otra pantalla.

import { AMBIENTE_NOMBRE, type Anuncio, type Foto, type FormatoRed } from "./inmobiliaria-tipos";

export interface PiezaAnuncio {
  canvas: HTMLCanvasElement;
  anuncio: Anuncio;
  marca: string;
  formato: FormatoRed;
  foto: Foto;
  portada: boolean; // la primera lleva precio y datos; las demás, solo la firma
}

export function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function redondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Devuelve el alto de la pastilla, para alinear lo que vaya a su lado.
export function pill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  texto: string,
  fuente: string,
  colores: { fondo: string; texto: string; espaciado?: number },
): number {
  ctx.font = fuente;
  ctx.letterSpacing = `${colores.espaciado ?? 0}px`;
  const alto = Number(fuente.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 30) * 2;
  const ancho = ctx.measureText(texto).width + alto * 0.8;
  ctx.fillStyle = colores.fondo;
  redondeado(ctx, x, y, ancho, alto, alto / 2);
  ctx.fill();
  ctx.fillStyle = colores.texto;
  ctx.textBaseline = "middle";
  ctx.fillText(texto, x + alto * 0.4, y + alto / 2);
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "0px";
  return alto;
}

export async function dibujarPieza({
  canvas,
  anuncio,
  marca,
  formato,
  foto,
  portada,
}: PiezaAnuncio): Promise<void> {
  const { ancho: W, alto: H } = formato;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx || !foto) return;

  await document.fonts?.ready.catch(() => undefined);
  const img = await cargarImagen(foto.src);

  // Recorte "cover": la foto llena el formato sin deformarse.
  const escala = Math.max(W / img.width, H / img.height);
  const w = img.width * escala;
  const h = img.height * escala;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);

  const fuente = (peso: number, px: number) =>
    `${peso} ${px}px 'Plus Jakarta Sans', system-ui, sans-serif`;

  if (!portada) {
    // Slides del carrusel: una marca discreta, la foto manda.
    pill(ctx, 0.045 * W, H - 0.045 * W - 54, AMBIENTE_NOMBRE[foto.ambiente], fuente(700, 30), {
      fondo: "rgba(255,255,255,0.92)",
      texto: "#16233a",
    });
    ctx.font = fuente(700, 26);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 10;
    ctx.fillText(`${marca}  ·  ${anuncio.portada.codigo}`, W - 0.045 * W, H - 0.045 * W - 14);
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
    return;
  }

  // Velo inferior para que el precio se lea sobre cualquier foto.
  const velo = ctx.createLinearGradient(0, H * 0.4, 0, H);
  velo.addColorStop(0, "rgba(9,20,34,0)");
  velo.addColorStop(0.55, "rgba(9,20,34,0.72)");
  velo.addColorStop(1, "rgba(9,20,34,0.94)");
  ctx.fillStyle = velo;
  ctx.fillRect(0, H * 0.4, W, H * 0.6);

  const m = 0.062 * W;

  // Etiqueta y firma, arriba, lejos del bloque de precio.
  const altoPill = pill(ctx, m, m, anuncio.portada.etiqueta.toUpperCase(), fuente(800, 0.026 * W), {
    fondo: "#12507e",
    texto: "#ffffff",
    espaciado: 2,
  });
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = fuente(700, 0.026 * W);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(9,20,34,0.55)";
  ctx.shadowBlur = 12;
  ctx.fillText(`${marca}  ·  ${anuncio.portada.codigo}`, W - m, m + altoPill / 2);
  ctx.shadowBlur = 0;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Precio.
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = fuente(800, 0.115 * W);
  const yPrecio = H - m - 0.145 * W;
  ctx.fillText(anuncio.portada.precio, m, yPrecio);

  // Zona.
  ctx.font = fuente(600, 0.038 * W);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fillText(anuncio.portada.zona, m, yPrecio + 0.052 * W);

  // Datos duros.
  ctx.font = fuente(700, 0.03 * W);
  let x = m;
  const yDatos = H - m - 0.028 * W;
  for (const dato of anuncio.portada.datos) {
    const ancho = ctx.measureText(dato).width + 0.044 * W;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    redondeado(ctx, x, yDatos - 0.038 * W, ancho, 0.055 * W, 0.028 * W);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(dato, x + 0.022 * W, yDatos);
    x += ancho + 0.018 * W;
  }
}

// Todas las piezas del carrusel como data URL, listas para mandar a publicar.
export async function componerCarrusel(opciones: {
  anuncio: Anuncio;
  marca: string;
  formato: FormatoRed;
  fotos: Foto[];
}): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < opciones.fotos.length; i++) {
    const canvas = document.createElement("canvas");
    await dibujarPieza({
      canvas,
      anuncio: opciones.anuncio,
      marca: opciones.marca,
      formato: opciones.formato,
      foto: opciones.fotos[i],
      portada: i === 0,
    });
    out.push(canvas.toDataURL("image/jpeg", 0.9));
  }
  return out;
}
