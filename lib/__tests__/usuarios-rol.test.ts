// Cuentas de persona y el rol que traen.
//
// Se prueba con ganas porque acá el modo de fallar no es una pantalla fea: es
// que alguien vea la bandeja de otro cliente, o que quien solo debía contestar
// mensajes entre al tablero de métricas.
//
// La regla que se está protegiendo: el rol de una cuenta de persona lo decide
// el servidor y viaja firmado. El "ver como" del navegador es de demo y no
// puede tocarlo.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { puedeVerRuta, VE } from "@/lib/modulos";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL };
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

const VERONICA =
  "veronica.viches@yalihospitality.com|Yali2026|yaly|atencion|Verónica Viches";

async function auth() {
  return import("@/lib/auth-server");
}

describe("cuentas de persona", () => {
  it("entra con su tenant, su rol y su nombre", async () => {
    process.env.USUARIOS = VERONICA;
    const { validarCredenciales } = await auth();

    const a = validarCredenciales("veronica.viches@yalihospitality.com", "Yali2026");
    expect(a).toEqual({
      tenant: "yaly",
      rol: "atencion",
      nombre: "Verónica Viches",
      fijo: true,
    });
  });

  it("el usuario no distingue mayusculas, la contraseña si", async () => {
    process.env.USUARIOS = VERONICA;
    const { validarCredenciales } = await auth();

    expect(validarCredenciales("VERONICA.VICHES@YALIHOSPITALITY.COM", "Yali2026")).not.toBeNull();
    expect(validarCredenciales("veronica.viches@yalihospitality.com", "yali2026")).toBeNull();
  });

  it("su rol es FIJO: no se lo puede cambiar desde el navegador", async () => {
    process.env.USUARIOS = VERONICA;
    const { validarCredenciales } = await auth();
    expect(validarCredenciales("veronica.viches@yalihospitality.com", "Yali2026")?.fijo).toBe(true);
  });

  it("una cuenta mal escrita se ignora entera, no entra a medias", async () => {
    // Sin rol, con un tenant que no existe, y con un rol inventado.
    process.env.USUARIOS = [
      "a@x.com|clave|yaly",
      "b@x.com|clave|noexiste|atencion",
      "c@x.com|clave|yaly|jefe_supremo",
    ].join(",");
    const { validarCredenciales } = await auth();
    expect(validarCredenciales("a@x.com", "clave")).toBeNull();
    expect(validarCredenciales("b@x.com", "clave")).toBeNull();
    expect(validarCredenciales("c@x.com", "clave")).toBeNull();
  });

  it("sin la variable no hay ninguna cuenta escrita en el codigo", async () => {
    delete process.env.USUARIOS;
    const { cuentas } = await import("@/lib/usuarios");
    // El repo es publico: una cuenta real aca queda publicada con su clave.
    expect(cuentas()).toEqual([]);
  });

  it("los logins de demo siguen entrando, y con el rol suelto", async () => {
    delete process.env.USUARIOS;
    delete process.env.LOGIN_PASSWORDS;
    const { validarCredenciales } = await auth();
    const a = validarCredenciales("demoagentia", "miagentiayaly");
    expect(a?.tenant).toBe("yaly");
    expect(a?.fijo).toBe(false);
  });
});

describe("lo que ve el rol de atencion", () => {
  it("contesta mensajes y redes, y nada mas", () => {
    expect(VE.atencion).toEqual(["bandeja", "mis-chats", "comentarios", "redes"]);
  });

  it("entra a lo suyo", () => {
    for (const ruta of ["/", "/mis-chats", "/comentarios", "/redes"]) {
      expect(puedeVerRuta("atencion", ruta), ruta).toBe(true);
    }
  });

  it("NO entra a lo del negocio, ni escribiendo la direccion a mano", () => {
    // Esta es la prueba que importa. Que el menu no muestre el modulo es
    // comodidad; lo que cuenta es que la ruta este cerrada.
    for (const ruta of [
      "/dashboard",
      "/settings",
      "/agentes",
      "/llamadas",
      "/perfil",
      "/promociones",
      "/tickets",
      "/contactos",
      "/interno",
    ]) {
      expect(puedeVerRuta("atencion", ruta), ruta).toBe(false);
    }
  });

  it("las rutas sin modulo no se restringen, o dejaria a todos afuera", () => {
    expect(puedeVerRuta("atencion", "/login")).toBe(true);
  });

  it("direccion sigue viendo todo", () => {
    for (const ruta of ["/dashboard", "/settings", "/redes", "/tickets"]) {
      expect(puedeVerRuta("admin", ruta), ruta).toBe(true);
    }
  });
});
