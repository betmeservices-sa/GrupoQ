/**
 * Ancho y alto leídos del encabezado del archivo, sin decodificar la imagen.
 *
 * Lo usan los dos scripts de medición. Vive aparte porque la primera versión
 * tenía un bug feo: con WebP y con algunos JPEG devolvía cosas como
 * 65536x4292542531, y esas filas ensuciaban los promedios sin que se notara.
 */

export interface Medidas {
  w: number;
  h: number;
}

/**
 * Descarta lo imposible. Anthropic ya no acepta nada arriba de 8000x8000, así
 * que el corte es generoso a propósito: sirve para atrapar parseos rotos, no
 * para validar contra la API.
 */
function plausible(m: Medidas | null): Medidas | null {
  if (!m) return null;
  const { w, h } = m;
  if (!Number.isInteger(w) || !Number.isInteger(h)) return null;
  if (w < 4 || h < 4 || w > 30000 || h > 30000) return null;
  // Una tira de 65000:1 no es una captura, es un encabezado mal leído.
  if (Math.max(w, h) / Math.min(w, h) > 50) return null;
  return m;
}

export function medidasDeImagen(buf: Buffer, mime: string): Medidas | null {
  try {
    if (mime === "image/png" && buf.length > 24 && buf.toString("ascii", 12, 16) === "IHDR") {
      return plausible({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
    }

    if (mime === "image/jpeg") {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marca = buf[i + 1];
        // SOF0..SOF15 llevan las medidas; C4, C8 y CC no son de imagen.
        if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
          return plausible({ h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) });
        }
        const largo = buf.readUInt16BE(i + 2);
        if (largo < 2) break; // corrupto: seguir daría un bucle infinito
        i += 2 + largo;
      }
      return null;
    }

    if (mime === "image/gif" && buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
      return plausible({ w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) });
    }

    // WebP viene en tres variantes y cada una guarda las medidas en otro lado.
    if (mime === "image/webp" && buf.length > 30 && buf.toString("ascii", 8, 12) === "WEBP") {
      const tipo = buf.toString("ascii", 12, 16);
      if (tipo === "VP8X") {
        return plausible({
          w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
          h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
        });
      }
      if (tipo === "VP8 ") {
        return plausible({ w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff });
      }
      if (tipo === "VP8L") {
        const b = buf.readUInt32LE(21);
        return plausible({ w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 });
      }
    }
  } catch {
    /* encabezado ilegible: se reporta sin medidas */
  }
  return null;
}
