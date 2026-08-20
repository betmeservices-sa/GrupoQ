// Qué hacer cuando una tabla todavía no existe.
//
// REGRESIÓN REAL (2026-08-19): la primera versión encendía un booleano para
// siempre. Se corrió la migración en producción y la app siguió guardando en
// memoria, porque cada instancia que ya había visto el error no volvía a
// intentar nunca. Había que redesplegar para algo que ya estaba arreglado.
import { describe, it, expect, vi, afterEach } from "vitest";
import { columnaFaltante, latchDeTabla, tablaFaltante } from "@/lib/tabla-faltante";

afterEach(() => {
  vi.useRealTimers();
});

describe("reconocer el error de tabla que no existe", () => {
  it("caza el código de Postgres y el de PostgREST", () => {
    expect(tablaFaltante({ code: "42P01" })).toBe(true);
    expect(tablaFaltante({ code: "PGRST205" })).toBe(true);
  });

  it("caza también el mensaje, que es lo que llega por la API REST", () => {
    expect(tablaFaltante({ message: 'relation "public.promos" does not exist' })).toBe(true);
    expect(tablaFaltante({ message: "Could not find the table in the schema cache" })).toBe(true);
  });

  // Lo importante es lo que NO caza: si un error de permisos o de red se
  // confundiera con "no existe", el panel diría que no hay promociones cuando
  // sí las hay, y el agente dejaría de ofrecerlas.
  it("no confunde otros errores", () => {
    expect(tablaFaltante({ code: "42501", message: "permission denied" })).toBe(false);
    expect(tablaFaltante({ message: "fetch failed" })).toBe(false);
    expect(tablaFaltante(null)).toBe(false);
    expect(tablaFaltante(undefined)).toBe(false);
  });
});

describe("la espera se apaga sola", () => {
  it("arranca apagada", () => {
    expect(latchDeTabla().activo()).toBe(false);
  });

  it("se enciende al marcar y se apaga cuando pasa el tiempo", () => {
    vi.useFakeTimers();
    const latch = latchDeTabla(3);
    latch.marcar();
    expect(latch.activo()).toBe(true);

    vi.advanceTimersByTime(2 * 60_000);
    expect(latch.activo(), "a los 2 minutos sigue esperando").toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(latch.activo(), "pasados los 3 minutos reintenta solo").toBe(false);
  });

  it("marcar de nuevo reinicia la espera", () => {
    vi.useFakeTimers();
    const latch = latchDeTabla(3);
    latch.marcar();
    vi.advanceTimersByTime(2 * 60_000);
    latch.marcar();
    vi.advanceTimersByTime(2 * 60_000);
    expect(latch.activo()).toBe(true);
  });
});

// REGRESIÓN REAL: se desplegó un SELECT con una columna nueva antes de correr
// su migración, y el panel de consumo quedó en CERO en producción, en silencio.
// El dueño habría visto que su agente no gastó nada, que es peor que un error.
describe("reconocer que falta una COLUMNA, no la tabla entera", () => {
  it("caza el código de Postgres y el de PostgREST", () => {
    expect(columnaFaltante({ code: "42703" })).toBe(true);
    expect(columnaFaltante({ code: "PGRST204" })).toBe(true);
  });

  it("caza el mensaje", () => {
    expect(columnaFaltante({ message: 'column ai_uso_tokens.tipo does not exist' })).toBe(true);
    expect(columnaFaltante({ message: "Could not find the 'tipo' column" })).toBe(true);
  });

  it("no confunde una tabla que falta con una columna que falta", () => {
    expect(columnaFaltante({ code: "42P01" })).toBe(false);
    expect(tablaFaltante({ code: "42703" })).toBe(false);
  });

  it("no confunde otros errores", () => {
    expect(columnaFaltante({ code: "42501", message: "permission denied" })).toBe(false);
    expect(columnaFaltante(null)).toBe(false);
  });
});
