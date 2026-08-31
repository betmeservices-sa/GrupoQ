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
const OLGA = "membresias@yalihospitality.com|Yali2026|yaly|atencion|Olga Zelaya";
const JAIME = "jaime@yalihospitality.com|YaliAdmin2026|yaly|admin|Jaime Quintanilla";
const EQUIPO = [VERONICA, OLGA, JAIME].join(",");

async function auth() {
  return import("@/lib/auth-server");
}

describe("cuentas de persona", () => {
  it("entra con su tenant, su rol y su nombre", async () => {
    process.env.USUARIOS = VERONICA;
    const { validarCredenciales } = await auth();

    const a = await validarCredenciales("veronica.viches@yalihospitality.com", "Yali2026");
    expect(a).toEqual({
      tenant: "yaly",
      rol: "atencion",
      nombre: "Verónica Viches",
      fijo: true,
      // Va en la sesion: sin saber QUIEN entro no se le puede dejar cambiar
      // su propia contraseña.
      usuario: "veronica.viches@yalihospitality.com",
      // Cuenta de un solo cliente: no es de la agencia.
      todos: false,
    });
  });

  it("el usuario no distingue mayusculas, la contraseña si", async () => {
    process.env.USUARIOS = VERONICA;
    const { validarCredenciales } = await auth();

    expect(await validarCredenciales("VERONICA.VICHES@YALIHOSPITALITY.COM", "Yali2026")).not.toBeNull();
    expect(await validarCredenciales("veronica.viches@yalihospitality.com", "yali2026")).toBeNull();
  });

  it("su rol es FIJO: no se lo puede cambiar desde el navegador", async () => {
    process.env.USUARIOS = VERONICA;
    const { validarCredenciales } = await auth();
    expect((await validarCredenciales("veronica.viches@yalihospitality.com", "Yali2026"))?.fijo).toBe(true);
  });

  it("una cuenta mal escrita se ignora entera, no entra a medias", async () => {
    // Sin rol, con un tenant que no existe, y con un rol inventado.
    process.env.USUARIOS = [
      "a@x.com|clave|yaly",
      "b@x.com|clave|noexiste|atencion",
      "c@x.com|clave|yaly|jefe_supremo",
    ].join(",");
    const { validarCredenciales } = await auth();
    expect(await validarCredenciales("a@x.com", "clave")).toBeNull();
    expect(await validarCredenciales("b@x.com", "clave")).toBeNull();
    expect(await validarCredenciales("c@x.com", "clave")).toBeNull();
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
    const a = await validarCredenciales("demoagentia", "miagentiayaly");
    expect(a?.tenant).toBe("yaly");
    expect(a?.fijo).toBe(false);
  });
});

describe("el equipo de Yali", () => {
  it("cada uno entra con lo suyo", async () => {
    process.env.USUARIOS = EQUIPO;
    const { validarCredenciales } = await auth();

    const vero = await validarCredenciales("veronica.viches@yalihospitality.com", "Yali2026");
    const olga = await validarCredenciales("membresias@yalihospitality.com", "Yali2026");
    const jaime = await validarCredenciales("jaime@yalihospitality.com", "YaliAdmin2026");

    expect(vero?.rol).toBe("atencion");
    expect(olga?.rol).toBe("atencion");
    expect(olga?.nombre).toBe("Olga Zelaya");
    expect(jaime?.rol).toBe("admin");

    // Los tres del mismo cliente, y ninguno con el rol suelto.
    for (const a of [vero, olga, jaime]) {
      expect(a?.tenant).toBe("yaly");
      expect(a?.fijo).toBe(true);
    }
  });

  it("la contraseña de una no abre la cuenta de la otra", async () => {
    process.env.USUARIOS = EQUIPO;
    const { validarCredenciales } = await auth();
    expect(await validarCredenciales("membresias@yalihospitality.com", "YaliAdmin2026")).toBeNull();
    expect(await validarCredenciales("jaime@yalihospitality.com", "Yali2026")).toBeNull();
  });

  it("solo Jaime puede tocar el Modo IA", () => {
    expect(VE.admin.includes("settings")).toBe(true);
    expect(VE.atencion.includes("settings")).toBe(false);
  });
});

describe("lo que ve el rol de atencion", () => {
  it("atiende, trabaja sus casos y ve como va el hotel", () => {
    // Se abrio el 31 de agosto a pedido de Yali: Veronica y Olga son los ojos
    // de los duenos. Ven el dashboard y prueban a Sofia; tickets e interno ya
    // les tocaban (los casos de pago van a Veronica desde el kickoff, y el
    // chat interno se construyo para ellas).
    expect(VE.atencion).toEqual([
      "bandeja",
      "mis-chats",
      "tickets",
      "interno",
      "comentarios",
      "redes",
      "sofia",
      "dashboard",
    ]);
  });

  it("entra a lo suyo", () => {
    for (const ruta of [
      "/",
      "/mis-chats",
      "/tickets",
      "/interno",
      "/comentarios",
      "/redes",
      "/sofia",
      "/dashboard",
    ]) {
      expect(puedeVerRuta("atencion", ruta), ruta).toBe(true);
    }
  });

  it("NO entra a lo que cambia como se comporta el agente, ni a mano", () => {
    // Esta es la prueba que importa. Que el menu no muestre el modulo es
    // comodidad; lo que cuenta es que la ruta este cerrada. Ajustes, perfil y
    // promociones cambian a Sofia para TODOS: eso sigue siendo de direccion.
    for (const ruta of ["/settings", "/agentes", "/llamadas", "/perfil", "/promociones", "/contactos"]) {
      expect(puedeVerRuta("atencion", ruta), ruta).toBe(false);
    }
  });

  it("las rutas sin modulo no se restringen, o dejaria a todos afuera", () => {
    expect(puedeVerRuta("atencion", "/login")).toBe(true);
  });

  it("no puede tocar el interruptor general de la IA", () => {
    // Es de direccion: apagarlo deja al agente mudo para TODAS las
    // conversaciones del cliente, no solo las de quien lo toca. Quien atiende
    // tiene el interruptor de su propio chat, que es el que le corresponde.
    expect(VE.atencion.includes("settings")).toBe(false);
    expect(VE.admin.includes("settings")).toBe(true);
  });

  it("direccion sigue viendo todo", () => {
    for (const ruta of ["/dashboard", "/settings", "/redes", "/tickets"]) {
      expect(puedeVerRuta("admin", ruta), ruta).toBe(true);
    }
  });
});
