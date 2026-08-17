// La parte de la IA que se puede probar sin gastar un token: cómo se mueve la
// ficha con lo que el modelo devolvió.
//
// Esto es la regla de negocio del módulo. Que "prometió pagar" mueva la cuenta
// a promesa de pago es lo bonito; lo que de verdad importa acá es que "pidió
// que no lo llamen" apague las llamadas y que una promesa con fecha vencida no
// se guarde como vigente.
import { describe, expect, it } from "vitest";
import { aplicarAnalisis, aplicarSinContacto, resultadoDeEndedReason } from "../cobros-ia";
import { resolverDeudor } from "../cobros-cartera";
import type { AnalisisLlamada } from "../cobros-ia";
import type { Deudor } from "../cobros-tipos";

const AHORA = new Date("2026-08-17T15:00:00Z");
const HOY = "2026-08-17";

const BASE: Deudor = {
  id: "d1",
  nombre: "Luis Alberto Menjívar",
  documento: "0134****-7",
  telefono: "+50378541209",
  producto: "tarjeta",
  cuenta: "****4471",
  saldoTotal: 1840.5,
  montoVencido: 312.5,
  cuotaMensual: 156.25,
  diasMora: 34,
  estado: "sin_gestionar",
  riesgo: "medio",
  etiquetas: [],
  gestiones: [],
  actualizado: "2026-08-10T12:00:00Z",
  llamable: true,
};

function analisis(extra: Partial<AnalisisLlamada> = {}): AnalisisLlamada {
  return {
    resultado: "promesa_pago",
    resumen: "Se comprometió a pagar el viernes.",
    sentimiento: "cooperativo",
    riesgo: "bajo",
    ...extra,
  };
}

const ctx = { ahora: AHORA, hoy: HOY, callId: "call-1", campanaId: "camp-1" };

describe("aplicarAnalisis mueve la ficha", () => {
  it("no muta el deudor original", () => {
    const copia = JSON.parse(JSON.stringify(BASE)) as Deudor;
    aplicarAnalisis(BASE, analisis(), ctx);
    expect(BASE).toEqual(copia);
  });

  it("una promesa con fecha futura queda vigente", () => {
    const d = aplicarAnalisis(
      BASE,
      analisis({ promesa: { monto: 312.5, fecha: "2026-08-21" } }),
      ctx,
    );
    expect(d.estado).toBe("promesa_pago");
    expect(d.promesa).toMatchObject({ monto: 312.5, fecha: "2026-08-21", origen: "ia" });
    expect(resolverDeudor(d, HOY).promesaVencida).toBe(false);
  });

  it("una promesa con fecha YA PASADA no se guarda", () => {
    // El modelo puede leer mal un "el quince" cuando ya es diecisiete. Guardarla
    // dejaría el tablero mostrando una promesa que nació incumplida.
    const d = aplicarAnalisis(
      BASE,
      analisis({ promesa: { monto: 312.5, fecha: "2026-08-10" } }),
      ctx,
    );
    expect(d.promesa).toBeUndefined();
  });

  it("apaga las llamadas cuando el cliente pide que no lo llamen", () => {
    const d = aplicarAnalisis(
      BASE,
      analisis({ resultado: "solicita_no_llamar", riesgo: "alto", sentimiento: "molesto" }),
      ctx,
    );
    expect(d.llamable).toBe(false);
    expect(d.estado).toBe("no_contactar");
  });

  it("apaga las llamadas cuando ya pagó o el número es de otra persona", () => {
    for (const r of ["ya_pago", "numero_equivocado"] as const) {
      expect(aplicarAnalisis(BASE, analisis({ resultado: r }), ctx).llamable).toBe(false);
    }
  });

  it("un resultado normal NO apaga las llamadas", () => {
    for (const r of ["no_contesto", "pidio_recontacto", "no_puede_pagar"] as const) {
      expect(aplicarAnalisis(BASE, analisis({ resultado: r }), ctx).llamable).toBe(true);
    }
  });

  it("nunca vuelve a encender una cuenta que ya estaba apagada", () => {
    const apagada: Deudor = { ...BASE, llamable: false };
    expect(aplicarAnalisis(apagada, analisis(), ctx).llamable).toBe(false);
  });

  it("marca para revisar cuando la IA levantó alerta", () => {
    const d = aplicarAnalisis(BASE, analisis({ alerta: { motivo: "El agente amenazó." } }), ctx);
    expect(d.etiquetas).toContain("Revisar");
  });

  it("no duplica la etiqueta Revisar en llamadas sucesivas", () => {
    const uno = aplicarAnalisis(BASE, analisis({ alerta: { motivo: "x" } }), ctx);
    const dos = aplicarAnalisis(uno, analisis({ alerta: { motivo: "y" } }), ctx);
    expect(dos.etiquetas.filter((e) => e === "Revisar")).toHaveLength(1);
  });

  it("guarda la llamada en el historial, arriba y con su transcripción", () => {
    const d = aplicarAnalisis(BASE, analisis(), {
      ...ctx,
      duracionSeg: 148,
      transcript: "Agente: buenos días...",
    });
    expect(d.gestiones).toHaveLength(1);
    expect(d.gestiones[0]).toMatchObject({
      tipo: "llamada",
      autor: "ia",
      resultado: "promesa_pago",
      duracionSeg: 148,
      callId: "call-1",
      campanaId: "camp-1",
    });
    expect(d.gestiones[0].transcript).toContain("buenos días");
  });

  it("deja lo más nuevo primero", () => {
    const uno = aplicarAnalisis(BASE, analisis({ resumen: "primera" }), ctx);
    const dos = aplicarAnalisis(uno, analisis({ resumen: "segunda" }), ctx);
    expect(dos.gestiones[0].resumen).toBe("segunda");
    expect(dos.gestiones).toHaveLength(2);
  });

  it("guarda los datos nuevos que el cliente dio en la llamada", () => {
    const d = aplicarAnalisis(
      BASE,
      analisis({ datosNuevos: { telefonoAlterno: "+50370119088", correo: "luis@correo.com" } }),
      ctx,
    );
    expect(d.telefonoAlterno).toBe("+50370119088");
    expect(d.correo).toBe("luis@correo.com");
  });

  it("pone una próxima acción por defecto cuando la IA no la dio", () => {
    expect(aplicarAnalisis(BASE, analisis({ resultado: "disputa" }), ctx).proximaAccion).toEqual({
      tipo: "escalar_humano",
    });
  });

  it("respeta la próxima acción que sí dio la IA", () => {
    const d = aplicarAnalisis(
      BASE,
      analisis({ proximaAccion: { tipo: "escalar_legal", nota: "Tercera promesa rota." } }),
      ctx,
    );
    expect(d.proximaAccion?.tipo).toBe("escalar_legal");
  });

  it("un resultado sin clasificar no cambia el estado de la cuenta", () => {
    const enGestion: Deudor = { ...BASE, estado: "negociacion" };
    expect(aplicarAnalisis(enGestion, analisis({ resultado: "sin_clasificar" }), ctx).estado).toBe(
      "negociacion",
    );
  });

  it("no deja crecer el historial sin límite", () => {
    let d = BASE;
    for (let i = 0; i < 100; i++) d = aplicarAnalisis(d, analisis({ resumen: `n${i}` }), ctx);
    expect(d.gestiones.length).toBeLessThanOrEqual(80);
    expect(d.gestiones[0].resumen).toBe("n99");
  });
});

describe("las llamadas que no conectaron", () => {
  it("traduce el motivo de corte de la telefonía", () => {
    expect(resultadoDeEndedReason("customer-did-not-answer")).toBe("no_contesto");
    expect(resultadoDeEndedReason("voicemail")).toBe("no_contesto");
    expect(resultadoDeEndedReason("customer-busy")).toBe("no_contesto");
  });

  it("no adivina cuando el cliente SÍ habló", () => {
    // Ahí hay transcripción que leer: el resultado no puede salir del corte.
    expect(resultadoDeEndedReason("customer-ended-call")).toBeNull();
    expect(resultadoDeEndedReason(undefined)).toBeNull();
  });

  it("solo suma el intento, sin tocar riesgo ni promesa", () => {
    const conPromesa: Deudor = {
      ...BASE,
      estado: "promesa_pago",
      riesgo: "bajo",
      promesa: { monto: 312.5, fecha: "2026-08-21", registrada: "2026-08-15T12:00:00Z", origen: "ia" },
    };
    const d = aplicarSinContacto(conPromesa, "no_contesto", { ahora: AHORA, callId: "c2" });
    expect(d.estado).toBe("promesa_pago");
    expect(d.riesgo).toBe("bajo");
    expect(d.promesa).toEqual(conPromesa.promesa);
    expect(d.gestiones[0]).toMatchObject({ resultado: "no_contesto", duracionSeg: 0 });
  });

  it("saca la cuenta de 'sin gestionar' al primer intento", () => {
    expect(aplicarSinContacto(BASE, "no_contesto", { ahora: AHORA }).estado).toBe("en_gestion");
  });
});
