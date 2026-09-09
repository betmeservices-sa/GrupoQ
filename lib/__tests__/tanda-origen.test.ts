// Con qué guion sale cada tanda del CSV.
//
// Importa porque el error no se ve: la llamada sale igual, suena igual y queda
// registrada igual. Lo único que cambia es que a alguien que ya dejó su
// solicitud a medias se le habla como si no lo conociéramos, y eso el tablero
// no lo va a mostrar nunca.

import { describe, expect, it } from "vitest";
import { ETIQUETA_ORIGEN, assistantDeTanda, esOrigenTanda } from "@/lib/tenants/voz";
import { TENANTS } from "@/lib/tenants";

describe("el agente que sale a marcar", () => {
  it("primer contacto sale con el de solicitudes", () => {
    expect(assistantDeTanda("grupoq", "primer_contacto")).toBe(TENANTS.grupoq.voz?.assistantIdCampanas);
  });

  it("reactivación sale con el suyo, que NO es el mismo", () => {
    const reactivacion = assistantDeTanda("grupoq", "reactivacion");
    expect(reactivacion).toBe(TENANTS.grupoq.voz?.assistantIdReactivacion);
    expect(reactivacion).toBeTruthy();
    expect(reactivacion).not.toBe(assistantDeTanda("grupoq", "primer_contacto"));
  });

  it("los dos agentes están declarados como del cliente, o no se les deja marcar", async () => {
    // `esDelTenant` es lo que autoriza la llamada. Un agente que existe en Vapi
    // pero no está en la lista del cliente devuelve 400 y la tanda no sale.
    const { esDelTenant } = await import("@/lib/tenants/voz");
    expect(esDelTenant(assistantDeTanda("grupoq", "primer_contacto"), "grupoq")).toBe(true);
    expect(esDelTenant(assistantDeTanda("grupoq", "reactivacion"), "grupoq")).toBe(true);
  });

  it("un cliente sin agente de reactivación NO cae en el de primer contacto", () => {
    // Preferimos no llamar antes que llamar con el guion equivocado: el error
    // sería invisible y se lo comería el cliente al teléfono.
    const conVoz = (Object.keys(TENANTS) as (keyof typeof TENANTS)[]).filter(
      (t) => TENANTS[t].voz && !TENANTS[t].voz?.assistantIdReactivacion,
    );
    for (const t of conVoz) {
      expect(assistantDeTanda(t, "reactivacion"), t).toBeNull();
    }
  });
});

describe("lo que viene del navegador", () => {
  it("solo se aceptan los dos orígenes", () => {
    expect(esOrigenTanda("primer_contacto")).toBe(true);
    expect(esOrigenTanda("reactivacion")).toBe(true);
    for (const x of ["", "otro", "Reactivacion", null, undefined, 1, {}]) {
      expect(esOrigenTanda(x), JSON.stringify(x)).toBe(false);
    }
  });

  it("cada origen tiene su nombre para el historial del caso", () => {
    expect(ETIQUETA_ORIGEN.primer_contacto).toBe("primer contacto");
    expect(ETIQUETA_ORIGEN.reactivacion).toBe("reactivación de crédito");
  });
});
