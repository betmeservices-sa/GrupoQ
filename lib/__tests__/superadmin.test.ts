// Cuenta de la agencia: tenant "*" en USUARIOS, entra a todos los clientes.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearSesion, leerSesion } from "../session";
import { cuentaDeUsuario } from "../usuarios";

const ENV_ORIGINAL = { ...process.env };
beforeEach(() => {
  process.env.SESSION_SECRET = "un-secreto-de-prueba-suficientemente-largo";
  (process.env as Record<string, string>).NODE_ENV = "test";
});
afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

describe("cuenta de la agencia", () => {
  it("tenant * se lee como 'todos' y aterriza en miagentia", () => {
    process.env.USUARIOS = "admin@miagentia.com|clave-larga|*|admin|MiAgentIA|";
    const c = cuentaDeUsuario("admin@miagentia.com");
    expect(c).not.toBeNull();
    expect(c!.todos).toBe(true);
    expect(c!.tenant).toBe("miagentia");
    expect(c!.rol).toBe("admin");
  });

  it("una cuenta normal no es de todos", () => {
    process.env.USUARIOS = "vero@yali.com|clave-larga|yaly|atencion|Verónica|s2";
    expect(cuentaDeUsuario("vero@yali.com")!.todos).toBe(false);
  });

  it("la sesión lleva la marca dentro de la firma y se lee de vuelta", async () => {
    const s = await crearSesion("miagentia", "admin", true, "admin@miagentia.com", true);
    const leida = await leerSesion(s!.valor);
    expect(leida).toMatchObject({ tenant: "miagentia", rol: "admin", fijo: true, todos: true });
    // La marca no se puede subir a mano: cambiar el "2" rompe la firma.
    const partes = s!.valor.split(".");
    const persona = await crearSesion("miagentia", "admin", true, "admin@miagentia.com", false);
    const partesPersona = persona!.valor.split(".");
    partesPersona[2] = "2";
    expect(partes[2]).toBe("2");
    expect(await leerSesion(partesPersona.join("."))).toBeNull();
  });

  it("una cuenta de persona sigue siendo fija y no de todos", async () => {
    const s = await crearSesion("yaly", "atencion", true, "vero@yali.com");
    expect(await leerSesion(s!.valor)).toMatchObject({ fijo: true, todos: false });
  });
});
