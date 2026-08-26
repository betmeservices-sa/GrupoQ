"use client";

// Achica una imagen antes de mandarla.
//
// Una foto sacada con el teléfono pesa entre 3 y 8 MB. Mandarla tal cual al
// chat interno significa guardar eso en la base por cada mensaje, y que quien
// la reciba se baje 8 MB para ver una captura de pantalla.
//
// Achicada a 1280 px y en JPEG, esa misma foto queda en unos 200 KB y en
// pantalla se ve igual: nadie mira una captura de una reserva a tamaño real.

const LADO_MAX = 1280;
const CALIDAD = 0.72;

export interface ImagenLista {
  /** La imagen en un formato que se puede guardar y mostrar directo. */
  datos: string;
  /** Cuánto pesa ya achicada, en bytes aproximados. */
  peso: number;
}

/**
 * Devuelve la imagen achicada, o null si el archivo no es una imagen o no se
 * pudo leer.
 *
 * Devolver null en vez de tirar un error es a propósito: que alguien elija un
 * archivo raro no puede romperle el chat.
 */
export async function achicarImagen(file: File): Promise<ImagenLista | null> {
  if (!file.type.startsWith("image/")) return null;

  try {
    const bitmap = await crearBitmap(file);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return null;
    // Fondo blanco: un PNG con transparencia pasado a JPEG deja las zonas
    // transparentes en negro, y una captura de pantalla queda ilegible.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    const datos = lienzo.toDataURL("image/jpeg", CALIDAD);
    return { datos, peso: Math.round((datos.length * 3) / 4) };
  } catch {
    return null;
  }
}

function crearBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  // Respaldo para navegadores viejos.
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("no se pudo leer la imagen"));
    };
    img.src = url;
  });
}
