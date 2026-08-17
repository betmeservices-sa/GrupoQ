// Promerica es el tercer tenant en tema claro y el primero con la marca REAL
// de un banco. Estos tests leen globals.css para que nadie baje el contraste ni
// le pise el bloque a otro tenant sin enterarse, y para dejar clavado que los
// verdes son los del design system de Promerica y no unos parecidos.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CSS = fs.readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

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

describe("tema de Banco Promerica", () => {
  const p = bloque('[data-tenant="promerica"]');

  it("usa los verdes del design system del banco", () => {
    expect(p).not.toBe("");
    // Verde Primario 70 y 80 de promerica.com.sv.
    expect(variable(p, "brand-blue")).toBe("#00693c");
    expect(variable(p, "brand-blue-dark")).toBe("#003f24");
  });

  it("va en claro, con su propia superficie", () => {
    expect(variable(p, "surface")).toBe("#f1f5f2");
    expect(variable(p, "card")).toBe("#ffffff");
    expect(variable(p, "text")).toBe("#13251c");
  });

  it("usa la tipografía del banco", () => {
    expect(variable(p, "font-app")).toContain("Nunito Sans");
    expect(CSS).toContain("family=Nunito+Sans");
  });

  it("gana sobre la marca unificada, o se pintaría violeta", () => {
    const pos = CSS.lastIndexOf('[data-tenant="promerica"]');
    const posUnificada = CSS.indexOf("[data-tenant] {");
    expect(posUnificada).toBeGreaterThan(-1);
    expect(pos).toBeGreaterThan(posUnificada);
  });

  it("no repite la paleta del hotel ni la de Terrazul", () => {
    for (const otro of ["hotel", "inmobiliaria"]) {
      const cuerpo = bloque(`[data-tenant="${otro}"]`);
      expect(variable(p, "brand-blue")).not.toBe(variable(cuerpo, "brand-blue"));
      expect(variable(p, "surface")).not.toBe(variable(cuerpo, "surface"));
    }
    expect(variable(p, "brand-blue")).not.toBe("#7c3aed");
  });

  // Contraste AA (4.5:1) para texto normal sobre las dos superficies claras.
  it("el texto cumple el contraste mínimo sobre el fondo y sobre la tarjeta", () => {
    const fondo = variable(p, "surface")!;
    const tarjeta = variable(p, "card")!;
    for (const superficie of [fondo, tarjeta]) {
      for (const tinta of [
        "text",
        "text-2",
        "text-3",
        "brand-blue",
        "brand-blue-dark",
        "brand-accent",
        "brand-green",
        "brand-red",
      ]) {
        expect(contraste(variable(p, tinta)!, superficie)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("el texto blanco sobre los colores de estado sigue siendo legible", () => {
    for (const tinta of ["brand-blue", "brand-green", "brand-red", "brand-accent"]) {
      expect(contraste("#ffffff", variable(p, tinta)!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // El lima de la marca (#69BE28) da 2.3:1 sobre blanco: sirve de relleno y en
  // la estrella del logo, nunca de color de texto. Este test existe para que
  // nadie lo promueva a --brand-blue "porque es más Promerica".
  it("no usa el verde lima como color de texto", () => {
    for (const tinta of ["brand-blue", "brand-blue-dark", "brand-green", "brand-accent", "text", "text-2", "text-3"]) {
      expect(variable(p, tinta)?.toLowerCase()).not.toBe("#69be28");
    }
  });
});
