// Terrazul es el segundo tenant en tema claro y el único en claro FRÍO. Estos
// tests leen globals.css para que nadie rompa esa frontera sin enterarse: si
// alguien mueve los colores compartidos, le pisa el bloque al hotel o baja el
// contraste por debajo de AA, aquí se cae.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CSS = fs.readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

// Devuelve el contenido del ÚLTIMO bloque que declara EXACTAMENTE ese selector.
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

describe("tema de la inmobiliaria", () => {
  const inmo = bloque('[data-tenant="inmobiliaria"]');

  it("define su propio bloque con superficies claras y frías", () => {
    expect(inmo).not.toBe("");
    expect(variable(inmo, "surface")).toBe("#eef2f7");
    expect(variable(inmo, "card")).toBe("#ffffff");
    expect(variable(inmo, "border")).toBe("#d8e0ea");
    expect(variable(inmo, "text")).toBe("#16233a");
  });

  it("gana sobre la marca unificada, o se pintaría violeta", () => {
    const pos = CSS.lastIndexOf('[data-tenant="inmobiliaria"]');
    const posUnificada = CSS.indexOf("[data-tenant] {");
    expect(posUnificada).toBeGreaterThan(-1);
    expect(pos).toBeGreaterThan(posUnificada);
  });

  it("no repite la paleta del hotel ni el violeta del demo", () => {
    const hotel = bloque('[data-tenant="hotel"]');
    expect(variable(inmo, "brand-blue")).toBe("#12507e");
    expect(variable(inmo, "brand-accent")).toBe("#9a4d15");
    expect(variable(inmo, "brand-blue")).not.toBe(variable(hotel, "brand-blue"));
    expect(variable(inmo, "surface")).not.toBe(variable(hotel, "surface"));
    expect(variable(inmo, "brand-blue")).not.toBe("#7c3aed");
  });

  // Contraste AA (4.5:1) para texto normal sobre las dos superficies claras.
  it("el texto cumple el contraste mínimo sobre el fondo y sobre la tarjeta", () => {
    const fondo = variable(inmo, "surface")!;
    const tarjeta = variable(inmo, "card")!;
    for (const superficie of [fondo, tarjeta]) {
      for (const tinta of ["text", "text-2", "text-3", "brand-blue", "brand-blue-dark", "brand-accent", "brand-green", "brand-red"]) {
        expect(contraste(variable(inmo, tinta)!, superficie)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("el texto blanco sobre los colores de estado sigue siendo legible", () => {
    for (const tinta of ["brand-blue", "brand-green", "brand-red", "brand-accent"]) {
      expect(contraste("#ffffff", variable(inmo, tinta)!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("los tenants oscuros no se movieron", () => {
  it("el tema compartido sigue igual", () => {
    const raiz = bloque(":root");
    expect(variable(raiz, "surface")).toBe("#05050a");
    expect(variable(raiz, "card")).toBe("#0d0d18");
  });

  it("ninguno de los cuatro oscuros redefine las superficies", () => {
    for (const t of ["hospital", "grupoq", "excel", "miagentia"]) {
      const cuerpo = bloque(`[data-tenant="${t}"]`);
      expect(variable(cuerpo, "surface")).toBeNull();
      expect(variable(cuerpo, "card")).toBeNull();
      expect(variable(cuerpo, "text")).toBeNull();
    }
  });

  it("el bloque del hotel sigue después del unificado y antes del de Terrazul", () => {
    const unificada = CSS.indexOf("[data-tenant] {");
    const hotel = CSS.lastIndexOf('[data-tenant="hotel"]');
    const inmo = CSS.lastIndexOf('[data-tenant="inmobiliaria"]');
    expect(hotel).toBeGreaterThan(unificada);
    expect(inmo).toBeGreaterThan(unificada);
  });
});
