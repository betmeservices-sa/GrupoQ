import { beforeEach, describe, expect, it, vi } from "vitest";

// Sin base: el módulo trabaja en memoria, que es lo que se prueba acá.
vi.mock("../supabase", () => ({ getSupabase: () => null }));
import { _vaciarAccesos, actividadDeUsuarios, estaActivo, listarAccesos, registrarAcceso, tocarActividad } from "../accesos";

beforeEach(() => _vaciarAccesos());

describe("accesos", () => {
  it("un inicio de sesión queda en el log y deja a la persona activa", async () => {
    await registrarAcceso({ tenant: "yaly", usuario: "vero@yali.com", nombre: "Verónica", rol: "atencion", todos: false, host: "hub.miagentia.com", ip: "1.2.3.4", agente: "Chrome" });
    const log = await listarAccesos();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ usuario: "vero@yali.com", tenant: "yaly", host: "hub.miagentia.com" });
    const act = await actividadDeUsuarios();
    expect(act[0].usuario).toBe("vero@yali.com");
    expect(estaActivo(act[0].ultimoVisto)).toBe(true);
  });

  it("la actividad se escribe a lo sumo una vez por minuto por usuario", async () => {
    await tocarActividad({ usuario: "a@x.com", tenant: "yaly" });
    const primera = (await actividadDeUsuarios())[0].ultimoVisto;
    await tocarActividad({ usuario: "a@x.com", tenant: "yaly" });
    expect((await actividadDeUsuarios())[0].ultimoVisto).toBe(primera);
    await tocarActividad({ usuario: "a@x.com", tenant: "yaly" }, true);
    expect((await actividadDeUsuarios())).toHaveLength(1);
  });

  it("activo = tocó el panel hace menos de tres minutos", () => {
    const ahora = Date.parse("2026-08-27T20:00:00Z");
    expect(estaActivo("2026-08-27T19:58:30Z", ahora)).toBe(true);
    expect(estaActivo("2026-08-27T19:50:00Z", ahora)).toBe(false);
    expect(estaActivo(null, ahora)).toBe(false);
  });

  it("el log se filtra por cliente", async () => {
    await registrarAcceso({ tenant: "yaly", usuario: "a@x.com", nombre: null, rol: null, todos: false, host: null, ip: null, agente: null });
    await registrarAcceso({ tenant: "hotel", usuario: "b@x.com", nombre: null, rol: null, todos: false, host: null, ip: null, agente: null });
    expect((await listarAccesos({ tenant: "yaly" })).map((a) => a.usuario)).toEqual(["a@x.com"]);
  });
});
