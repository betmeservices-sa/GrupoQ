// El barrido que manda el recordatorio a los 5 minutos.
//
// POR QUÉ EXISTE ESTA PRUEBA. La decisión (decidirRecordatorio) estaba probada
// y bien, y aun así en producción no salió ni un mensaje: el barrido leía
// `ultimoPorConversacion` como si devolviera la lista de conversaciones, y
// devuelve `{ ultimos, cursor }`. Recorría el array entero como UN elemento y
// el cursor como otro, no encontraba `texto` en ninguno, y respondía sin error
// habiendo mirado a nadie. Un barrido que sale limpio sin trabajar es
// indistinguible de uno que sí trabajó, y por eso hay que probar el barrido y
// no solo la decisión.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getSupabase: () => null }));

const enviadas: { to: string; name: string; variables: string[] }[] = [];
vi.mock("@/lib/wa-send", () => ({
  enviarPlantilla: async (to: string, name: string, _idioma: string, variables: string[]) => {
    enviadas.push({ to, name, variables });
    return { ok: true, id: `wamid.${enviadas.length}` };
  },
}));

const { GET } = await import("@/app/api/cron/plantilla-recordatorio/route");
const { addOutbound, addInbound } = await import("@/lib/wa-store");
const { upsertContacto } = await import("@/lib/contacts-store");
const { REQUISITOS } = await import("@/lib/plantilla-tras-llamada");

const SECRETO = "secreto-de-prueba";
const TEL = "50370020001";
const haceMin = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function pedir(qs = "") {
  return GET(
    new Request(`https://demo.miagentia.com/api/cron/plantilla-recordatorio${qs}`, {
      headers: { authorization: `Bearer ${SECRETO}` },
    }),
  );
}

beforeEach(async () => {
  enviadas.length = 0;
  process.env.CRON_SECRET = SECRETO;
  const g = globalThis as unknown as { __wa?: unknown };
  g.__wa = undefined;
  await import("@/lib/wa-store").then((m) => m.clearHistory("grupoq"));
  await upsertContacto({ from: "70020001", tenant: "grupoq", nombre: "Karla", apellido: "Menjívar" });
});

describe("a quién le manda el recordatorio", () => {
  it("al que recibió los requisitos hace 6 minutos y no contestó", async () => {
    await addOutbound({
      waId: "wamid.req",
      to: TEL,
      texto: REQUISITOS.texto("Karla"),
      ts: haceMin(6),
      tenant: "grupoq",
    });

    const d = (await (await pedir()).json()) as { enviados: number; revisadas: number };
    expect(d.revisadas, "no miró ninguna conversación").toBeGreaterThan(0);
    expect(d.enviados).toBe(1);
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0].name).toBe("crediq_continuar_solicitud");
    expect(enviadas[0].variables).toEqual(["Karla"]);
  });

  it("al que CONTESTÓ no le manda nada", async () => {
    await addOutbound({
      waId: "wamid.req",
      to: TEL,
      texto: REQUISITOS.texto("Karla"),
      ts: haceMin(6),
      tenant: "grupoq",
    });
    await addInbound({
      waId: "wamid.in",
      from: TEL,
      texto: "ok, ya se los mando",
      ts: haceMin(1),
      tenant: "grupoq",
    });

    const d = (await (await pedir()).json()) as { enviados: number };
    expect(d.enviados).toBe(0);
    expect(enviadas).toHaveLength(0);
  });

  it("al que lo recibió hace un minuto todavía no", async () => {
    await addOutbound({
      waId: "wamid.req",
      to: TEL,
      texto: REQUISITOS.texto("Karla"),
      ts: haceMin(1),
      tenant: "grupoq",
    });
    const d = (await (await pedir()).json()) as { enviados: number; saltados: Record<string, number> };
    expect(d.enviados).toBe(0);
    expect(Object.keys(d.saltados).join(" ")).toMatch(/pronto/);
  });

  it("a quien nunca recibió los requisitos, ni lo mira", async () => {
    await addOutbound({
      waId: "wamid.x",
      to: TEL,
      texto: "Buenas, le saluda Sofía.",
      ts: haceMin(30),
      tenant: "grupoq",
    });
    const d = (await (await pedir()).json()) as { enviados: number };
    expect(d.enviados).toBe(0);
  });
});

describe("las dos puertas del barrido", () => {
  it("sin el secreto no pasa nadie", async () => {
    const r = await GET(new Request("https://demo.miagentia.com/api/cron/plantilla-recordatorio"));
    expect(r.status).toBe(401);
  });

  it("en seco dice a quién le tocaría y NO manda nada", async () => {
    await addOutbound({
      waId: "wamid.req",
      to: TEL,
      texto: REQUISITOS.texto("Karla"),
      ts: haceMin(6),
      tenant: "grupoq",
    });
    const d = (await (await pedir("?seco=1")).json()) as { seco: boolean; enviados: number; detalle: string[] };
    expect(d.seco).toBe(true);
    expect(d.enviados).toBe(1);
    expect(d.detalle[0]).toContain("[SECO]");
    expect(enviadas, "en seco NO se manda").toHaveLength(0);
  });
});
