// Lo que la llamada de Sofía deja escrito en el caso del embudo.
//
// Esto es lo que faltaba: el monto se decía por teléfono y se quedaba en la
// memoria del agente, así que el tablero mostraba leads en cero dólares de
// gente que sí había dicho cuánto quería. Lo que más se cuida acá es que NO
// pise lo que alguien puso a mano: un monto corregido por el vendedor vale más
// que lo que entendió el agente.
//
// El store cae a memoria cuando no hay Supabase (el caso de las pruebas), así
// que esto ejercita el camino completo: crear el caso, escribirlo y leerlo.

import { describe, expect, it } from "vitest";
import { anotarLlamadaEnSolicitud, anotarMontoDelChat } from "@/lib/ventas-llamada";
import { guardarSolicitud, leerSolicitud, asegurarSolicitud, eventosDe } from "@/lib/ventas-store";

const TENANT = "grupoq";

// Un teléfono distinto por prueba: el store en memoria no se limpia entre una
// y otra, y un caso pegado haría pasar (o fallar) a la siguiente por su cuenta.
let n = 0;
const telefono = () => `7000${String(++n).padStart(4, "0")}`;

describe("lo que la llamada anota en el caso", () => {
  it("guarda el monto que se dijo en palabras y el vehículo", async () => {
    const t = telefono();
    const r = await anotarLlamadaEnSolicitud({
      tenant: TENANT,
      telefono: t,
      nombre: "Karla Menjívar",
      vehiculo: "Hilux 2020",
      montoTexto: "como unos quince mil",
    });

    expect(r.monto).toBe(15000);
    const caso = await leerSolicitud(TENANT, t);
    expect(caso?.monto).toBe(15000);
    expect(caso?.vehiculo).toBe("Hilux 2020");
    expect(r.resumen).toContain("$15,000");
  });

  it("crea el caso si la persona nunca pasó por el CSV", async () => {
    const t = telefono();
    expect(await leerSolicitud(TENANT, t)).toBeNull();
    await anotarLlamadaEnSolicitud({ tenant: TENANT, telefono: t, nombre: "Nuevo", montoTexto: "diez mil" });
    expect((await leerSolicitud(TENANT, t))?.nombre).toBe("Nuevo");
  });

  it("marca el contacto y le pone dueño, o el caso no lo ve nadie", async () => {
    const t = telefono();
    await anotarLlamadaEnSolicitud({ tenant: TENANT, telefono: t, nombre: "Sin dueño", montoTexto: "ocho mil" });
    const caso = await leerSolicitud(TENANT, t);
    expect(caso?.contactado).not.toBeNull();
    expect(caso?.vendedor).toBeTruthy();
  });

  it("NO pisa el monto que alguien puso a mano", async () => {
    const t = telefono();
    const base = await asegurarSolicitud(TENANT, t, { nombre: "Ya tenía" });
    await guardarSolicitud({ ...base, monto: 9000, vehiculo: "Raize" });

    await anotarLlamadaEnSolicitud({
      tenant: TENANT,
      telefono: t,
      montoTexto: "veinte mil",
      vehiculo: "Corolla",
    });

    const caso = await leerSolicitud(TENANT, t);
    expect(caso?.monto).toBe(9000);
    expect(caso?.vehiculo).toBe("Raize");
  });

  it("una llamada sin monto no inventa ninguno", async () => {
    const t = telefono();
    const r = await anotarLlamadaEnSolicitud({ tenant: TENANT, telefono: t, montoTexto: "no sabe todavia" });
    expect(r.monto).toBeNull();
    expect((await leerSolicitud(TENANT, t))?.monto ?? null).toBeNull();
    expect(r.resumen).toContain("no dejó monto");
  });

  it("deja el rastro en el historial del caso", async () => {
    const t = telefono();
    await anotarLlamadaEnSolicitud({ tenant: TENANT, telefono: t, montoTexto: "doce mil", actor: "llamada" });
    const eventos = await eventosDe(TENANT, t);
    expect(eventos.some((e) => e.tipo === "monto" && (e.detalle ?? "").includes("$12,000"))).toBe(true);
  });

  it("el canal NO se adivina desde una llamada", async () => {
    // De dónde vino el lead (WhatsApp, Instagram, Facebook, orgánico) no se
    // puede saber por teléfono, y marcarlo mal ensucia las barras por canal.
    const t = telefono();
    await anotarLlamadaEnSolicitud({ tenant: TENANT, telefono: t, montoTexto: "quince mil" });
    expect((await leerSolicitud(TENANT, t))?.canal ?? null).toBeNull();
  });
});

describe("lo que el lead dice por escrito", () => {
  it("guarda el monto, aunque el chat llegue con código de país", async () => {
    const t = telefono();
    await asegurarSolicitud(TENANT, t, { nombre: "Escribió" });
    const r = await anotarMontoDelChat({
      tenant: TENANT,
      telefono: `503${t}`,
      texto: "ando buscando financiamiento de 15 mil",
    });
    expect(r).toContain("$15,000");
    expect((await leerSolicitud(TENANT, t))?.monto).toBe(15000);
  });

  it("NO mete al embudo a quien todavía no está", async () => {
    // Al número del demo le escribe cualquiera. Un mensaje suelto no es motivo
    // para crear un caso: para eso están el CSV y la llamada.
    const t = telefono();
    const r = await anotarMontoDelChat({
      tenant: TENANT,
      telefono: `503${t}`,
      texto: "quiero financiar 12 mil",
    });
    expect(r).toBeNull();
    expect(await leerSolicitud(TENANT, t)).toBeNull();
  });

  it("no pisa el monto que ya estaba", async () => {
    const t = telefono();
    const base = await asegurarSolicitud(TENANT, t, { nombre: "Ya tenía" });
    await guardarSolicitud({ ...base, monto: 9000 });
    await anotarMontoDelChat({
      tenant: TENANT,
      telefono: `503${t}`,
      texto: "busco un credito de 20 mil",
    });
    expect((await leerSolicitud(TENANT, t))?.monto).toBe(9000);
  });

  it("un mensaje que no habla de plata no toca nada", async () => {
    const t = telefono();
    await asegurarSolicitud(TENANT, t, { nombre: "Fecha" });
    const r = await anotarMontoDelChat({
      tenant: TENANT,
      telefono: `503${t}`,
      texto: "nos vemos el 15 de octubre a las 3",
    });
    expect(r).toBeNull();
    expect((await leerSolicitud(TENANT, t))?.monto ?? null).toBeNull();
  });

  it("deja el rastro, y se ve que vino del chat", async () => {
    const t = telefono();
    await asegurarSolicitud(TENANT, t, { nombre: "Rastro" });
    await anotarMontoDelChat({
      tenant: TENANT,
      telefono: `503${t}`,
      texto: "necesito financiar 18 mil dolares",
    });
    const eventos = await eventosDe(TENANT, t);
    expect(eventos.some((e) => e.tipo === "monto" && e.actor === "chat")).toBe(true);
  });
});
