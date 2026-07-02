import { describe, expect, it, beforeEach } from "vitest";

// Forzamos la ruta FAKE (sin credenciales) borrando los env antes de cada test.
// Las funciones leen process.env en cada llamada, así que esto basta.
beforeEach(() => {
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_WABA_ID;
});

import {
  contarVariables,
  nombreValido,
  crearTemplate,
  listarTemplates,
  eliminarTemplate,
} from "../wa-templates";

describe("contarVariables", () => {
  it("cuenta el índice más alto de {{n}}", () => {
    expect(contarVariables("Hola {{1}}, su cita es el {{2}} a las {{3}}")).toBe(3);
  });
  it("devuelve 0 cuando no hay variables", () => {
    expect(contarVariables("Texto sin variables")).toBe(0);
  });
  it("usa el índice máximo, no la cantidad de apariciones", () => {
    expect(contarVariables("{{1}} y otra vez {{1}}")).toBe(1);
  });
});

describe("nombreValido", () => {
  it("acepta minúsculas, números y guion bajo", () => {
    expect(nombreValido("recordatorio_cita_2")).toBe(true);
  });
  it("rechaza mayúsculas y espacios", () => {
    expect(nombreValido("Recordatorio Cita")).toBe(false);
  });
  it("rechaza guiones medios", () => {
    expect(nombreValido("con-guion")).toBe(false);
  });
});

describe("flujo demo de plantillas (sin credenciales)", () => {
  it("lista en modo demo", async () => {
    const r = await listarTemplates();
    expect(r.ok).toBe(true);
    expect(r.demo).toBe(true);
    expect(r.templates.length).toBeGreaterThan(0);
  });

  it("crea -> aparece en la lista como PENDING -> se elimina", async () => {
    const creada = await crearTemplate({
      name: "prueba_demo",
      language: "es",
      category: "UTILITY",
      body: "Hola {{1}}, confirme su cita.",
      ejemplos: ["Ana"],
    });
    expect(creada.ok).toBe(true);
    expect(creada.demo).toBe(true);
    expect(creada.template?.status).toBe("PENDING");

    const tras = await listarTemplates();
    expect(tras.templates.some((t) => t.name === "prueba_demo")).toBe(true);

    await eliminarTemplate("prueba_demo");
    const fin = await listarTemplates();
    expect(fin.templates.some((t) => t.name === "prueba_demo")).toBe(false);
  });

  it("rechaza nombre inválido", async () => {
    const r = await crearTemplate({
      name: "Nombre Invalido",
      language: "es",
      category: "UTILITY",
      body: "Hola",
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza si faltan ejemplos para las variables", async () => {
    const r = await crearTemplate({
      name: "faltan_ejemplos",
      language: "es",
      category: "UTILITY",
      body: "Hola {{1}}, su cita es el {{2}}",
      ejemplos: ["Ana"],
    });
    expect(r.ok).toBe(false);
  });
});
