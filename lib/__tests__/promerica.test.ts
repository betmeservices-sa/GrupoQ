// El tenant de Banco Promerica: que esté bien enchufado al demo multi-tenant y
// que su cartera semilla sea coherente. Un dato de cartera incoherente (una
// promesa sin fecha, una cuenta llamable que ya pidió que no la llamen) se ve
// bien en pantalla y arruina la demostración en vivo.
import { describe, expect, it } from "vitest";
import { DEMO_LOGINS, TENANTS, isTenantId, resolveTenantByLogin } from "@/lib/tenants";
import { assistantIdDeTenant, soloDelTenant, veModuloVoz } from "@/lib/tenants/voz";
import { DEUDORES_SEMILLA, HOY_DEMO } from "@/lib/cobros-datos";
import { resumirCartera } from "@/lib/cobros-cartera";
import { tramoDe } from "@/lib/cobros-tipos";

describe("tenant promerica", () => {
  it("la contraseña miagentiacobros entra al banco", () => {
    expect(resolveTenantByLogin("demoagentia", "miagentiacobros")).toBe("promerica");
  });

  it("usa el mismo usuario que los demás clientes", () => {
    const usuarios = new Set(
      DEMO_LOGINS.filter((l) => l.usuario === "demoagentia").map((l) => l.tenant),
    );
    expect(usuarios.has("promerica")).toBe(true);
  });

  it("no le roba la contraseña a ninguno de los otros seis", () => {
    expect(resolveTenantByLogin("demoagentia", "demoh")).toBe("hospital");
    expect(resolveTenantByLogin("demoagentia", "demoi")).toBe("grupoq");
    expect(resolveTenantByLogin("demoagentia", "demoj")).toBe("excel");
    expect(resolveTenantByLogin("demoagentia", "demok")).toBe("miagentia");
    expect(resolveTenantByLogin("demoagentia", "miagentiahotel")).toBe("hotel");
    expect(resolveTenantByLogin("demoagentia", "miagentiabienes")).toBe("inmobiliaria");
  });

  it("cada contraseña resuelve a un solo cliente", () => {
    const porClave = new Map<string, string>();
    for (const l of DEMO_LOGINS.filter((x) => x.usuario === "demoagentia")) {
      expect(porClave.has(l.password)).toBe(false);
      porClave.set(l.password, l.tenant);
    }
  });

  it("queda registrado como tenant válido", () => {
    expect(isTenantId("promerica")).toBe(true);
    expect(TENANTS.promerica.id).toBe("promerica");
    expect(TENANTS.promerica.brand.nombre).toBe("Banco Promerica");
    expect(TENANTS.promerica.seed.staff.length).toBeGreaterThan(0);
    expect(TENANTS.promerica.tags.length).toBeGreaterThan(0);
  });

  it("pinta su logo propio, no un logotipo en imagen", () => {
    expect(TENANTS.promerica.brand.logoComponent).toBe("promerica");
    expect(TENANTS.promerica.brand.logoSrc).toBeUndefined();
  });

  it("las tarjetas del dashboard apuntan a métricas que sí existen en el seed", () => {
    const labels = new Set(TENANTS.promerica.seed.metrics.map((m) => m.label));
    for (const card of TENANTS.promerica.dashboard) {
      if (card.kind === "metric") expect(labels.has(card.metricLabel!)).toBe(true);
    }
  });

  it("su departamento por defecto existe en el seed", () => {
    const ids = new Set(TENANTS.promerica.seed.departments.map((d) => d.id));
    expect(ids.has(TENANTS.promerica.defaultDepartment)).toBe(true);
  });
});

describe("el módulo de voz del banco", () => {
  it("tiene agente propio y por eso ve el módulo", () => {
    expect(assistantIdDeTenant("promerica")).not.toBeNull();
    expect(veModuloVoz("promerica")).toBe(true);
  });

  it("solo ve SUS llamadas, no las de los otros clientes de la cuenta", () => {
    const mio = assistantIdDeTenant("promerica")!;
    const llamadas = [{ assistantId: mio }, { assistantId: "de-otro-cliente" }, {}];
    expect(soloDelTenant(llamadas, "promerica")).toEqual([{ assistantId: mio }]);
  });

  it("su agente no es el de ningún otro tenant", () => {
    const otros = (["hospital", "grupoq", "excel", "hotel", "inmobiliaria"] as const)
      .map(assistantIdDeTenant)
      .filter(Boolean);
    expect(otros).not.toContain(assistantIdDeTenant("promerica"));
  });
});

describe("la cartera semilla", () => {
  it("no repite ids ni teléfonos", () => {
    const ids = new Set(DEUDORES_SEMILLA.map((d) => d.id));
    const tels = new Set(DEUDORES_SEMILLA.map((d) => d.telefono));
    expect(ids.size).toBe(DEUDORES_SEMILLA.length);
    expect(tels.size).toBe(DEUDORES_SEMILLA.length);
  });

  it("todos los teléfonos son marcables en El Salvador", () => {
    for (const d of DEUDORES_SEMILLA) {
      expect(d.telefono).toMatch(/^\+503[267]\d{7}$/);
    }
  });

  it("el vencido nunca es mayor que el saldo total", () => {
    for (const d of DEUDORES_SEMILLA) {
      expect(d.montoVencido).toBeLessThanOrEqual(d.saldoTotal);
    }
  });

  it("las cuentas apagadas están apagadas por una razón", () => {
    const razones = ["pagado", "no_contactar", "ilocalizable", "legal"];
    for (const d of DEUDORES_SEMILLA.filter((x) => !x.llamable)) {
      expect(razones).toContain(d.estado);
    }
  });

  it("nadie que pidió no ser llamado quedó llamable", () => {
    for (const d of DEUDORES_SEMILLA.filter((x) => x.estado === "no_contactar")) {
      expect(d.llamable).toBe(false);
    }
  });

  it("cubre los cuatro tramos de mora, para que el tablero no se vea plano", () => {
    const tramos = new Set(DEUDORES_SEMILLA.map((d) => tramoDe(d.diasMora)));
    expect(tramos).toContain("1_30");
    expect(tramos).toContain("31_60");
    expect(tramos).toContain("61_90");
    expect(tramos).toContain("90_mas");
  });

  it("trae al menos una promesa vigente y una incumplida", () => {
    const resumen = resumirCartera(DEUDORES_SEMILLA, HOY_DEMO);
    expect(resumen.promesasVigentes).toBeGreaterThan(0);
    expect(resumen.montoPrometido).toBeGreaterThan(0);
    expect(resumen.promesasVencidas).toBeGreaterThan(0);
  });

  it("una promesa vencida no cuenta como vigente ni suma al monto prometido", () => {
    const r = resumirCartera(DEUDORES_SEMILLA, HOY_DEMO);
    const conPromesa = DEUDORES_SEMILLA.filter((d) => d.promesa && d.promesa.cumplida !== true);
    // Cada promesa viva cae en exactamente uno de los dos contadores.
    expect(r.promesasVigentes + r.promesasVencidas).toBe(conPromesa.length);
    const soloVigentes = conPromesa
      .filter((d) => d.promesa!.fecha >= HOY_DEMO)
      .reduce((s, d) => s + d.promesa!.monto, 0);
    expect(r.montoPrometido).toBeCloseTo(soloVigentes, 2);
  });

  it("hay transcripciones reales para poder demostrar el análisis con IA", () => {
    const conTranscript = DEUDORES_SEMILLA.filter((d) =>
      d.gestiones.some((g) => (g.transcript ?? "").length > 100),
    );
    expect(conTranscript.length).toBeGreaterThanOrEqual(2);
  });

  it("el resumen cuadra con la suma de los tramos", () => {
    const r = resumirCartera(DEUDORES_SEMILLA, HOY_DEMO);
    const porTramo = Object.values(r.porTramo).reduce((s, t) => s + t.cuentas, 0);
    expect(porTramo).toBe(r.cuentas);
    expect(r.cuentas).toBe(DEUDORES_SEMILLA.length);
  });
});

it("tramoDe reparte los días como los reparte el banco", () => {
  expect(tramoDe(0)).toBe("al_dia");
  expect(tramoDe(1)).toBe("1_30");
  expect(tramoDe(30)).toBe("1_30");
  expect(tramoDe(31)).toBe("31_60");
  expect(tramoDe(90)).toBe("61_90");
  expect(tramoDe(91)).toBe("90_mas");
});
