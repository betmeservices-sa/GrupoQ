// El filtro de datos clínicos de la memoria del hospital.
//
// La memoria del concesionario guarda todo lo que se habló, y está bien: es
// información comercial. La del hospital NO puede hacer lo mismo. Lo que se
// conversa ahí es salud, y guardarlo convierte una libreta de recepción en un
// expediente clínico paralelo: sin consentimiento, sin las protecciones que un
// expediente tiene, y en una tabla que lee la app entera.
//
// Estas pruebas cuidan que lo administrativo pase y lo clínico no. El filtro
// vive en la ruta, así que se replica su expresión acá: si alguien la cambia
// allá sin cambiarla acá, estas pruebas dejan de proteger, y por eso el caso
// "cuida que sigan sincronizadas" compara contra el archivo real.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RUTA = path.join(process.cwd(), "app/api/webhooks/vapi/gineco/route.ts");

/** La misma expresión que usa la ruta, leída del archivo para no divergir. */
function clinicoDeLaRuta(): RegExp {
  const src = fs.readFileSync(RUTA, "utf8");
  const m = src.match(/const CLINICO\s*=\s*([\s\S]*?);\n/);
  if (!m) throw new Error("no se encontró la expresión CLINICO en la ruta");
  const cuerpo = m[1].trim().replace(/^\/|\/i$/g, "");
  return new RegExp(cuerpo, "i");
}

const CLINICO = clinicoDeLaRuta();

describe("lo clínico NO se guarda", () => {
  const frases = [
    "Llamó porque está sangrando y tiene siete meses de embarazo",
    "Consultó por los resultados de su papanicolaou",
    "Preguntó por el precio de la colposcopía",
    "Quería saber si el ultrasonido ya está listo",
    "Reportó dolor abdominal fuerte",
    "Preguntó por su tratamiento de fertilidad",
    "Consultó sobre anticonceptivos",
    "Vino por una cesárea el mes pasado",
    "Preguntó por el resultado de la biopsia",
    "Tuvo una pérdida y quiere control",
    "Consultó por un quiste",
    "Preguntó cuándo le toca la regla después del parto",
  ];
  for (const f of frases) {
    it(`descarta: "${f.slice(0, 42)}..."`, () => {
      expect(CLINICO.test(f)).toBe(true);
    });
  }
});

describe("lo administrativo SÍ se guarda", () => {
  const frases = [
    "Llamó para agendar una cita y pidió que le devolvieran la llamada",
    "Preguntó por el horario de los sábados",
    "Consultó si atienden con su seguro",
    "Pidió hablar con alguien de facturación",
    "Quería saber dónde queda el hospital y si hay parqueo",
    "Reagendó su cita para la próxima semana",
    "Dejó su número para que la contacten",
  ];
  for (const f of frases) {
    it(`deja pasar: "${f.slice(0, 42)}..."`, () => {
      expect(CLINICO.test(f)).toBe(false);
    });
  }
});

describe("el filtro y la ruta no pueden separarse", () => {
  it("la ruta sigue aplicando el filtro al resumen y a las áreas", () => {
    const src = fs.readFileSync(RUTA, "utf8");
    // Si alguien quita cualquiera de estas dos, entra dato clínico sin que
    // ninguna prueba se queje. Por eso se verifica el código, no solo la regex.
    expect(src).toContain("sinDatosDeSalud(d.resumen)");
    expect(src).toContain("CLINICO.test(a)");
  });

  it("no guarda uso ni forma de pago: en un hospital eso no aplica", () => {
    const src = fs.readFileSync(RUTA, "utf8");
    expect(src).toMatch(/uso:\s*undefined/);
    expect(src).toMatch(/pago:\s*undefined/);
  });
});
