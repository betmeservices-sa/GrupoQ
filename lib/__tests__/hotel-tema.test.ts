// El hotel es el ÚNICO tenant en tema claro. Estos tests leen globals.css para
// que nadie rompa esa frontera sin enterarse: si alguien mueve los colores
// compartidos o le pone tema claro a otro cliente, aquí se cae.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CSS = fs.readFileSync(
  path.resolve(__dirname, "../../app/globals.css"),
  "utf8",
);

// Devuelve el contenido del ÚLTIMO bloque que declara EXACTAMENTE ese selector
// (el que gana cuando hay varios con la misma especificidad).
function bloque(selector: string): string {
  const escapado = selector.replace(/[[\]="]/g, "\\$&");
  const partes = CSS.split(new RegExp(`(?:^|\\n)\\s*${escapado}\\s*\\{`));
  if (partes.length < 2) return "";
  return partes[partes.length - 1].split("}")[0];
}

function variable(cuerpo: string, nombre: string): string | null {
  const m = cuerpo.match(new RegExp(`--${nombre}\\s*:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

// Luminancia relativa y contraste segun WCAG 2.1.
function luminancia(hex: string): number {
  const v = hex.replace("#", "");
  const canal = (i: number) => {
    const c = parseInt(v.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("tema del hotel", () => {
  const hotel = bloque('[data-tenant="hotel"]');

  it("define su propio bloque con superficies claras", () => {
    expect(hotel).not.toBe("");
    expect(variable(hotel, "surface")).toBe("#f5f3ee");
    expect(variable(hotel, "card")).toBe("#fcfcfb");
    expect(variable(hotel, "border")).toBe("#e3e1d9");
    expect(variable(hotel, "text")).toBe("#22302b");
  });

  it("gana sobre la marca unificada, o el hotel se pintaría violeta", () => {
    const posHotel = CSS.lastIndexOf('[data-tenant="hotel"]');
    const posUnificada = CSS.indexOf("[data-tenant] {");
    expect(posUnificada).toBeGreaterThan(-1);
    expect(posHotel).toBeGreaterThan(posUnificada);
  });

  it("usa el jade y el ámbar del hotel, no el violeta del demo", () => {
    expect(variable(hotel, "brand-blue")).toBe("#0e8062");
    expect(variable(hotel, "brand-accent")).toBe("#8f5314");
  });

  // Contraste AA (4.5:1) para texto normal sobre las dos superficies claras.
  it("el texto cumple el contraste mínimo sobre el fondo y sobre la tarjeta", () => {
    const fondo = variable(hotel, "surface")!;
    const tarjeta = variable(hotel, "card")!;
    for (const superficie of [fondo, tarjeta]) {
      expect(contraste(variable(hotel, "text")!, superficie)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(variable(hotel, "text-2")!, superficie)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(variable(hotel, "text-3")!, superficie)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(variable(hotel, "brand-blue-dark")!, superficie)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(variable(hotel, "brand-accent")!, superficie)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("el texto blanco sobre el color de marca sigue siendo legible", () => {
    expect(contraste("#ffffff", variable(hotel, "brand-blue")!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("los demás clientes siguen oscuros", () => {
  it("el tema compartido no se movió", () => {
    const raiz = bloque(":root");
    expect(variable(raiz, "surface")).toBe("#05050a");
    expect(variable(raiz, "card")).toBe("#0d0d18");
    expect(variable(raiz, "text")).toBe("#f4f4f8");
  });

  it("ningún otro tenant redefine las superficies", () => {
    for (const t of ["hospital", "grupoq", "excel", "miagentia"]) {
      const cuerpo = bloque(`[data-tenant="${t}"]`);
      expect(variable(cuerpo, "surface")).toBeNull();
      expect(variable(cuerpo, "card")).toBeNull();
      expect(variable(cuerpo, "text")).toBeNull();
    }
  });

  it("la marca unificada violeta sigue existiendo para los demás", () => {
    const unificada = bloque("[data-tenant]");
    expect(variable(unificada, "brand-blue")).toBe("#7c3aed");
  });
});
