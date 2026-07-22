"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, PhoneOff } from "lucide-react";
import { costoRealLlamada, derivar } from "@/lib/calls-metrics";
import { COLOR_OUTCOME, ETIQUETA_OUTCOME, fmtDuracion, fmtUSD } from "@/lib/calls-format";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CallRecord } from "@/lib/data/types";

function fmtFecha(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-SV", {
    timeZone: "America/El_Salvador",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CallsTable({
  calls,
  tarifaCarrier = 0,
}: {
  calls: CallRecord[];
  tarifaCarrier?: number;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);

  if (calls.length === 0) {
    return (
      <EmptyState
        titulo="Sin llamadas"
        descripcion="No hay llamadas que coincidan con los filtros."
        Icon={PhoneOff}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="border-b border-line text-[#94a3b4]">
          <tr>
            <th className="px-3 py-3 font-medium" />
            <th className="px-3 py-3 font-medium">Fecha</th>
            <th className="px-3 py-3 font-medium">Desde</th>
            <th className="px-3 py-3 font-medium">Hacia</th>
            <th className="px-3 py-3 font-medium">Agente</th>
            <th className="px-3 py-3 font-medium">Ring</th>
            <th className="px-3 py-3 font-medium">Habla</th>
            <th className="px-3 py-3 font-medium">Resultado</th>
            <th className="px-3 py-3 text-right font-medium">Costo real</th>
            <th className="px-3 py-3 text-right font-medium">USD/min</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => {
            const d = derivar(c);
            const exp = abierta === c.id;
            return (
              <Fragment key={c.id}>
                <tr
                  onClick={() => setAbierta(exp ? null : c.id)}
                  className="cursor-pointer border-b border-line/60 hover:bg-surface"
                >
                  <td className="px-3 py-3 text-[#94a3b4]">
                    {exp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{fmtFecha(c.creada ?? c.inicio)}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {c.nombreNumero || c.numeroPropio || c.phoneNumberId || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{c.numeroCliente ?? "—"}</td>
                  <td className="px-3 py-3">{c.nombreAssistant || c.assistantId || "—"}</td>
                  <td className="px-3 py-3">{fmtDuracion(d.ringSeg)}</td>
                  <td className="px-3 py-3">{fmtDuracion(d.hablaSeg)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-1 font-medium ${COLOR_OUTCOME[d.outcome]}`}
                    >
                      {ETIQUETA_OUTCOME[d.outcome]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {fmtUSD(costoRealLlamada(c, tarifaCarrier))}
                  </td>
                  <td className="px-3 py-3 text-right">{fmtUSD(d.costoPorMinuto)}</td>
                </tr>
                {exp && (
                  <tr className="border-b border-line/60 bg-surface">
                    <td colSpan={10} className="px-6 py-4">
                      <div className="mb-2 text-[11px] text-[#94a3b4]">
                        Motivo técnico: <code>{c.estadoFinal ?? "—"}</code>
                      </div>
                      {c.costoDesglose && (
                        <div className="mb-2 flex flex-wrap gap-4 text-[11px] text-[#475569]">
                          <span>
                            Voz:{" "}
                            <strong className="text-[#0f1b2d]">
                              {c.costoDesglose.ttsCharacters.toLocaleString("es-SV")}
                            </strong>{" "}
                            caracteres
                          </span>
                          <span>
                            LLM:{" "}
                            <strong className="text-[#0f1b2d]">
                              {c.costoDesglose.llmPromptTokens.toLocaleString("es-SV")}
                            </strong>{" "}
                            prompt /{" "}
                            <strong className="text-[#0f1b2d]">
                              {c.costoDesglose.llmCompletionTokens.toLocaleString("es-SV")}
                            </strong>{" "}
                            respuesta
                          </span>
                        </div>
                      )}
                      {c.grabacionUrl && (
                        <a
                          href={c.grabacionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-2 inline-block text-brand underline"
                        >
                          Escuchar grabación
                        </a>
                      )}
                      {c.transcript ? (
                        <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-card p-3 text-[11px] leading-relaxed">
                          {c.transcript}
                        </pre>
                      ) : (
                        <p className="text-[11px] text-[#94a3b4]">Sin transcript.</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
