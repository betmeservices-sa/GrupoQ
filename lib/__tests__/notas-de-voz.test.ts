// Una nota de voz la atiende una persona, siempre.
//
// Antes se pasaban a texto con Gemini y el agente contestaba sobre esa
// transcripción. El problema no fue que fallara: fue que cuando fallaba a
// medias nadie se enteraba. Una fecha mal oída, un nombre cambiado, un "no" que
// se oyó como "dos", y el agente contestaba con total seguridad sobre algo que
// el huésped no dijo.
//
// Estas pruebas cuidan que no vuelva por la puerta de atrás: ni un guion que
// prometa escuchar, ni un interruptor que lo encienda de nuevo.

import { describe, it, expect } from "vitest";
import { TENANTS } from "@/lib/tenants";
import { captionDeMedia } from "@/lib/format";

describe("las notas de voz no las escucha el agente", () => {
  it("ningún guion promete escucharlas ni entenderlas", () => {
    for (const t of Object.values(TENANTS)) {
      expect(t.ai.systemPrompt, t.id).not.toMatch(/pasadas a texto/i);
      expect(t.ai.systemPrompt, t.id).not.toMatch(/transcri/i);
    }
  });

  it("el de Yali lo dice con todas sus letras", () => {
    // Los demás clientes nunca escucharon audios, así que su guion no habla del
    // tema. El de Yali sí lo hacía, y por eso tiene que decir que ya no.
    expect(TENANTS.yaly.ai.systemPrompt).toMatch(/NO escuchas las notas de voz/i);
  });

  it("en la bandeja se ve que fue un audio, no un texto", () => {
    // Quien lo abre tiene que saber que hay algo que escuchar. Si apareciera
    // como texto plano, nadie le daría play.
    expect(captionDeMedia("audio")).toMatch(/audio|voz/i);
  });
});
