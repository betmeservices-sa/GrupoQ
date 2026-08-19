// El tema de Yali Hospitality es blanco y azul, con el azul del logotipo del
// hotel. Estas pruebas leen globals.css para que nadie le mueva la marca sin
// enterarse: si alguien cambia el azul, baja el contraste o deja que gane el
// violeta del demo, aquí se cae.
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

describe("tema de Yali Hospitality", () => {
  const yali = bloque('[data-tenant="yaly"]');

  it("usa el azul del logotipo del hotel, no el violeta del demo", () => {
    expect(yali).not.toBe("");
    expect(variable(yali, "brand-blue")).toBe("#1c415d");
    expect(variable(yali, "brand-accent")).toBe("#8a5f36");
  });

  it("va en claro: fondo casi blanco y tarjeta blanca", () => {
    expect(variable(yali, "surface")).toBe("#f4f6f8");
    expect(variable(yali, "card")).toBe("#ffffff");
  });

  it("gana sobre la marca unificada, o el dashboard se pintaría violeta", () => {
    const posYali = CSS.lastIndexOf('[data-tenant="yaly"]');
    const posUnificada = CSS.indexOf("[data-tenant] {");
    expect(posUnificada).toBeGreaterThan(-1);
    expect(posYali).toBeGreaterThan(posUnificada);
  });

  it("el texto cumple el contraste mínimo sobre el fondo y sobre la tarjeta", () => {
    const fondo = variable(yali, "surface")!;
    const tarjeta = variable(yali, "card")!;
    for (const superficie of [fondo, tarjeta]) {
      for (const v of ["text", "text-2", "text-3", "brand-blue-dark", "brand-accent"]) {
        expect(contraste(variable(yali, v)!, superficie), `${v} sobre ${superficie}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("el texto blanco sobre el azul de marca sigue siendo legible", () => {
    expect(contraste("#ffffff", variable(yali, "brand-blue")!)).toBeGreaterThanOrEqual(4.5);
  });
});
