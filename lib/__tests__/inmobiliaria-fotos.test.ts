// El selector de fotos, probado con imágenes fabricadas: un damero (nítido),
// un degradado (movido), un cuadro casi negro (oscura) y uno casi blanco
// (quemada). Si alguien afloja un umbral, aquí se cae.
import { describe, it, expect } from "vitest";
import {
  aGris,
  elegirFotos,
  juzgarFoto,
  medirGris,
  medirImageData,
  type MedidaFoto,
} from "@/lib/inmobiliaria-fotos";

// Fabrica una imagen RGBA de ancho x alto con la función que se le pase.
function imagen(ancho: number, alto: number, valor: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      const v = Math.max(0, Math.min(255, Math.round(valor(x, y))));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return data;
}

const LADO = 64;
const damero = imagen(LADO, LADO, (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0 ? 60 : 200);
const degradado = imagen(LADO, LADO, (x) => 40 + (x / LADO) * 170);
const casiNegra = imagen(LADO, LADO, (x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? 2 : 18));
const casiBlanca = imagen(LADO, LADO, (x, y) => (((x >> 2) + (y >> 2)) % 2 === 0 ? 250 : 254));

const grande = { ancho: 1600, alto: 1200 };
const medir = (src: string, data: Uint8ClampedArray, tam = grande) =>
  medirImageData(src, data, LADO, LADO, tam);

describe("medidas del pixel", () => {
  it("el gris pesa el verde más que el azul", () => {
    const rgba = new Uint8ClampedArray([0, 255, 0, 255, 0, 0, 255, 255]);
    const gris = aGris(rgba);
    expect(Math.round(gris[0])).toBe(150);
    expect(Math.round(gris[1])).toBe(29);
  });

  it("una foto con bordes tiene mucha más nitidez que un degradado", () => {
    const nitida = medirGris(aGris(damero), LADO, LADO);
    const movida = medirGris(aGris(degradado), LADO, LADO);
    expect(nitida.nitidez).toBeGreaterThan(100);
    expect(movida.nitidez).toBeLessThan(1);
  });

  it("cuenta las sombras y lo quemado", () => {
    expect(medirGris(aGris(casiNegra), LADO, LADO).sombras).toBeGreaterThan(0.9);
    expect(medirGris(aGris(casiBlanca), LADO, LADO).quemado).toBeGreaterThan(0.9);
    expect(medirGris(aGris(damero), LADO, LADO).sombras).toBe(0);
  });
});

describe("qué foto entra al anuncio", () => {
  it("la nítida y bien expuesta entra", () => {
    const j = juzgarFoto(medir("/buena.jpg", damero));
    expect(j.entra).toBe(true);
    expect(j.motivo).toBeNull();
    expect(j.puntaje).toBeGreaterThan(60);
  });

  it("la movida se descarta y se dice por qué", () => {
    const j = juzgarFoto(medir("/movida.jpg", degradado));
    expect(j.entra).toBe(false);
    expect(j.motivo).toMatch(/movida|desenfocada/i);
  });

  it("la oscura se descarta aunque tenga bordes", () => {
    const j = juzgarFoto(medir("/oscura.jpg", casiNegra));
    expect(j.entra).toBe(false);
    expect(j.motivo).toMatch(/oscura/i);
  });

  it("la quemada por el sol también", () => {
    const j = juzgarFoto(medir("/quemada.jpg", casiBlanca));
    expect(j.entra).toBe(false);
    expect(j.motivo).toMatch(/quemada/i);
  });

  it("una foto chica no sirve para el feed", () => {
    const j = juzgarFoto(medir("/chica.jpg", damero, { ancho: 640, alto: 480 }));
    expect(j.entra).toBe(false);
    expect(j.motivo).toContain("640x480");
  });

  it("una panorámica se cae por el recorte del feed", () => {
    const j = juzgarFoto(medir("/pano.jpg", damero, { ancho: 4000, alto: 1000 }));
    expect(j.entra).toBe(false);
    expect(j.motivo).toMatch(/alargada/i);
  });
});

describe("selección del carrusel", () => {
  const medidas: MedidaFoto[] = [
    medir("/1-buena.jpg", damero),
    medir("/2-movida.jpg", degradado),
    medir("/3-oscura.jpg", casiNegra),
    medir("/4-buena.jpg", damero, { ancho: 1080, alto: 810 }),
  ];

  it("deja fuera las malas y explica cada descarte", () => {
    const s = elegirFotos(medidas);
    expect(s.entran.map((j) => j.medida.src)).toEqual(["/1-buena.jpg", "/4-buena.jpg"]);
    expect(s.fuera).toHaveLength(2);
    for (const f of s.fuera) expect(f.motivo).toBeTruthy();
  });

  it("la de más resolución gana el desempate", () => {
    const s = elegirFotos(medidas);
    expect(s.entran[0].medida.src).toBe("/1-buena.jpg");
    expect(s.entran[0].puntaje).toBeGreaterThanOrEqual(s.entran[1].puntaje);
  });

  it("no manda al feed más de las que caben", () => {
    const muchas = Array.from({ length: 14 }, (_, i) => medir(`/f${i}.jpg`, damero));
    const s = elegirFotos(muchas, 10);
    expect(s.entran).toHaveLength(10);
    expect(s.fuera).toHaveLength(4);
    expect(s.fuera[0].motivo).toContain("10");
  });

  it("si todas están mal, no entra ninguna: se vuelven a tomar", () => {
    const s = elegirFotos([medir("/a.jpg", degradado), medir("/b.jpg", casiNegra)]);
    expect(s.entran).toHaveLength(0);
    expect(s.fuera).toHaveLength(2);
  });
});
