import { describe, expect, it } from "vitest";
import {
  categoriaOutcome,
  costoPorMinuto,
  derivar,
  hablaSeg,
  prefijoSV,
  resumirLlamadas,
  ringSeg,
} from "../calls-metrics";
import type { CallRecord } from "../data/types";

// Fixtures reales de la cuenta Vapi de BetMe (2026-07-21).
const exitosa: CallRecord = {
  id: "019f8173",
  direccion: "outbound",
  numeroCliente: "+50375391721",
  creada: "2026-07-20T21:34:42.486Z",
  inicio: "2026-07-20T21:34:50.486Z",
  fin: "2026-07-20T21:35:29.586Z",
  duracionSeg: 39,
  costo: 0.0492,
  estadoFinal: "customer-ended-call",
};

// SIP 480: nunca contesto, sin inicio ni fin, costo 0.
const carrier: CallRecord = {
  id: "019f85a6",
  direccion: "outbound",
  numeroCliente: "+50361611519",
  creada: "2026-07-21T17:08:26.814Z",
  duracionSeg: 0,
  costo: 0,
  estadoFinal: "call.in-progress.error-providerfault-outbound-sip-480-temporarily-unavailable",
};

const transferida: CallRecord = {
  id: "019f86a4",
  direccion: "outbound",
  numeroCliente: "+50375391721",
  creada: "2026-07-21T21:46:15.269Z",
  inicio: "2026-07-21T21:46:22.606Z",
  fin: "2026-07-21T21:46:48.516Z",
  duracionSeg: 26,
  costo: 0.0339,
  estadoFinal: "assistant-forwarded-call",
};

const sinAudio: CallRecord = {
  id: "019f85c6",
  direccion: "outbound",
  numeroCliente: "+50322520218",
  creada: "2026-07-21T17:43:35.984Z",
  inicio: "2026-07-21T17:43:51.103Z",
  fin: "2026-07-21T17:44:06.114Z",
  duracionSeg: 15,
  costo: 0.0154,
  estadoFinal: "call.in-progress.error-assistant-did-not-receive-customer-audio",
};

describe("ringSeg", () => {
  it("calcula los segundos entre creada y contestada", () => {
    expect(ringSeg(exitosa)).toBe(8);
  });

  it("devuelve null si la llamada nunca fue contestada", () => {
    expect(ringSeg(carrier)).toBeNull();
  });

  it("devuelve null si falta creada", () => {
    expect(ringSeg({ ...exitosa, creada: undefined })).toBeNull();
  });
});

describe("hablaSeg", () => {
  it("calcula los segundos entre contestada y fin", () => {
    expect(hablaSeg(transferida)).toBe(26);
  });

  it("devuelve 0 si nunca contestaron", () => {
    expect(hablaSeg(carrier)).toBe(0);
  });
});

describe("costoPorMinuto", () => {
  it("calcula el costo por minuto sobre el tiempo de habla", () => {
    // 0.0339 USD / (26/60 min) = 0.0782...
    expect(costoPorMinuto(transferida)).toBeCloseTo(0.0782, 3);
  });

  it("devuelve null cuando no hubo habla, sin dividir por cero", () => {
    expect(costoPorMinuto(carrier)).toBeNull();
  });
});

describe("categoriaOutcome", () => {
  it("clasifica customer-ended-call como exitosa", () => {
    expect(categoriaOutcome("customer-ended-call")).toBe("exitosa");
  });

  it("clasifica el SIP 480 como falla de carrier", () => {
    expect(categoriaOutcome(carrier.estadoFinal)).toBe("falla_carrier");
  });

  it("clasifica assistant-forwarded-call como transferida", () => {
    expect(categoriaOutcome("assistant-forwarded-call")).toBe("transferida");
  });

  it("clasifica la falta de audio del cliente como sin_audio", () => {
    expect(categoriaOutcome(sinAudio.estadoFinal)).toBe("sin_audio");
  });

  it("clasifica pipeline-error como falla de plataforma", () => {
    expect(categoriaOutcome("pipeline-error-eleven-labs-voice-failed")).toBe("falla_plataforma");
  });

  it("devuelve otro para un motivo desconocido", () => {
    expect(categoriaOutcome("motivo-que-vapi-invento-manana")).toBe("otro");
  });

  it("devuelve otro cuando no hay motivo", () => {
    expect(categoriaOutcome(undefined)).toBe("otro");
  });
});

describe("prefijoSV", () => {
  it("extrae el primer digito despues del codigo de pais", () => {
    expect(prefijoSV("+50361611519")).toBe("6");
    expect(prefijoSV("+50375391721")).toBe("7");
    expect(prefijoSV("+50322520218")).toBe("2");
  });

  it("devuelve null si no es un numero salvadoreno", () => {
    expect(prefijoSV("+12025550123")).toBeNull();
    expect(prefijoSV(undefined)).toBeNull();
  });
});

describe("derivar", () => {
  it("arma el bloque derivado completo de una llamada", () => {
    const d = derivar(exitosa);
    expect(d.ringSeg).toBe(8);
    expect(d.hablaSeg).toBe(39);
    expect(d.costoPorMinuto).toBeCloseTo(0.0757, 3);
    expect(d.outcome).toBe("exitosa");
  });
});

describe("resumirLlamadas", () => {
  const todas = [exitosa, carrier, transferida, sinAudio];

  it("cuenta totales y conectadas", () => {
    const m = resumirLlamadas(todas);
    expect(m.total).toBe(4);
    expect(m.conectadas).toBe(3);
    expect(m.tasaConexion).toBeCloseTo(0.75, 4);
  });

  it("agrupa por outcome", () => {
    const m = resumirLlamadas(todas);
    expect(m.porOutcome.exitosa).toBe(1);
    expect(m.porOutcome.falla_carrier).toBe(1);
    expect(m.porOutcome.transferida).toBe(1);
    expect(m.porOutcome.sin_audio).toBe(1);
  });

  it("agrupa por prefijo y expone la tasa de conexion de cada uno", () => {
    const m = resumirLlamadas(todas);
    const seis = m.porPrefijo.find((p) => p.prefijo === "6");
    const siete = m.porPrefijo.find((p) => p.prefijo === "7");
    expect(seis).toEqual({ prefijo: "6", total: 1, conectadas: 0, tasa: 0 });
    expect(siete).toEqual({ prefijo: "7", total: 2, conectadas: 2, tasa: 1 });
  });

  it("suma el costo total de Vapi", () => {
    const m = resumirLlamadas(todas);
    expect(m.costoTotal).toBeCloseTo(0.0985, 4);
  });

  it("calcula costo de carrier y costo real con la tarifa dada", () => {
    // 39 + 26 + 15 = 80 seg de habla = 1.3333 min. A 0.03 USD/min = 0.04
    const m = resumirLlamadas(todas, 0.03);
    expect(m.costoCarrier).toBeCloseTo(0.04, 3);
    expect(m.costoReal).toBeCloseTo(0.1385, 3);
  });

  it("deja el costo de carrier en cero si no hay tarifa configurada", () => {
    const m = resumirLlamadas(todas);
    expect(m.costoCarrier).toBe(0);
    expect(m.costoReal).toBeCloseTo(m.costoTotal, 6);
  });

  it("no rompe con una lista vacia", () => {
    const m = resumirLlamadas([]);
    expect(m.total).toBe(0);
    expect(m.tasaConexion).toBe(0);
    expect(m.costoPorMinutoPromedio).toBeNull();
    expect(m.ringPromedioSeg).toBeNull();
  });
});
