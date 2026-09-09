// El sembrador rellenando lo que le falta a las fichas que ya estaban.
//
// POR QUÉ IMPORTA. El sembrador solo corre con la tabla vacía. Cuando se agregó
// la columna `monto` y después `canal`, las fichas ya sembradas se quedaron en
// nulo: en el demo desplegado el embudo mostraba cero plata y las barras por
// vendedor salían todas grises, con el código correcto. Nadie lo vio hasta que
// alguien miró la base.
//
// Estas pruebas fijan las tres cosas que no puede hacer al rellenar: inventar
// en fichas que no son del demo, pisar lo que una persona marcó a mano, y
// tocar una ficha que ya está completa.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Solicitud } from "@/lib/ventas-pipeline";

// Sin Supabase el store guarda en memoria, que es donde corre esto.
vi.mock("@/lib/supabase", () => ({ getSupabase: () => null }));

const TENANT = "grupoq";
/** Una del demo que en el archivo trae canal y monto. */
const DEL_DEMO = "50370020001";

/**
 * Módulos frescos por prueba.
 *
 * El store guarda en un Map de módulo, así que sin esto la primera prueba deja
 * sembrado el demo entero y las siguientes ya no arrancan de cero.
 */
async function limpio() {
  vi.resetModules();
  const [{ sembrarVentasSiVacio }, store] = await Promise.all([
    import("@/lib/ventas-seed"),
    import("@/lib/ventas-store"),
  ]);
  return { sembrar: sembrarVentasSiVacio, ...store };
}

function base(telefono: string): Solicitud {
  const ahora = new Date().toISOString();
  return {
    tenant: TENANT,
    telefono,
    nombre: "Quien sea",
    expediente: {},
    vendedor: null,
    creado: ahora,
    contactado: null,
    pedidos: null,
    completado: null,
    asignado: null,
    tomado: null,
    cerrado: null,
    resultado: null,
    motivoCierre: null,
    avisado: null,
    escalado: null,
    actualizado: ahora,
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("rellenar lo que quedó en nulo", () => {
  it("le pone monto y canal a una ficha del demo que no los tenía", async () => {
    const { sembrar, guardarSolicitud, leerSolicitud } = await limpio();
    await guardarSolicitud({ ...base(DEL_DEMO), monto: null, canal: null });
    await sembrar(TENANT);
    const s = await leerSolicitud(TENANT, DEL_DEMO);
    expect(s?.monto).toBe(18500);
    expect(s?.canal).toBe("instagram");
  });

  it("NO pisa lo que alguien marcó a mano", async () => {
    // Si el vendedor dijo que ese lead vino por WhatsApp, gana el vendedor.
    const { sembrar, guardarSolicitud, leerSolicitud } = await limpio();
    await guardarSolicitud({ ...base(DEL_DEMO), monto: 999, canal: "whatsapp" });
    await sembrar(TENANT);
    const s = await leerSolicitud(TENANT, DEL_DEMO);
    expect(s?.monto).toBe(999);
    expect(s?.canal).toBe("whatsapp");
  });

  it("no le inventa nada a una ficha que no es del demo", async () => {
    // Un lead real, de una persona real. Acá no se rellena.
    const { sembrar, guardarSolicitud, leerSolicitud } = await limpio();
    await guardarSolicitud({ ...base("50378889999"), monto: null, canal: null });
    await sembrar(TENANT);
    const s = await leerSolicitud(TENANT, "50378889999");
    expect(s?.monto ?? null).toBeNull();
    expect(s?.canal ?? null).toBeNull();
  });

  it("con la tabla vacía siembra, y lo sembrado ya trae canal", async () => {
    const { sembrar, listarSolicitudes } = await limpio();
    expect(await sembrar(TENANT)).toBeGreaterThan(0);
    const todas = await listarSolicitudes(TENANT);
    expect(todas.filter((s) => s.canal).length).toBeGreaterThan(0);
    // Y quedan algunas sin canal a propósito: es lo que sale como "Sin marcar"
    // en la barra, la señal de que hay fichas por llenar.
    expect(todas.filter((s) => !s.canal).length).toBeGreaterThan(0);
  });
});
