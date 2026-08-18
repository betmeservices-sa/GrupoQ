"use client";

import { useEffect, useState } from "react";
import { Coins, Image as ImageIcon, Loader2, Type } from "lucide-react";
import { fmtCosto, fmtTokens, type TarifaModelo } from "@/lib/tokens-precios";
import type { ResumenConsumo } from "@/lib/tokens-store";

interface Respuesta extends ResumenConsumo {
  modeloActual: string;
  tarifaActual: TarifaModelo | null;
}

// Cuánto está costando el agente de IA, en tokens Y en dinero, separando lo que
// cuesta el TEXTO de lo que cuestan las IMÁGENES.
//
// De dónde salen los números: cada respuesta guarda el `usage` que devuelve la
// API (los cuatro campos, que se cobran distinto) más el modelo con el que se
// generó. Las imágenes no tienen línea propia en la factura (se cobran como
// tokens de entrada), así que su parte se mide con count_tokens sobre el mismo
// contenido con y sin la foto, y se resta.
export function ConsumoIA() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/ai/consumo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Respuesta) => {
        if (vivo) setDatos(d);
      })
      .catch(() => {
        if (vivo) setError("No se pudo leer el consumo.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const t = datos?.total;
  const hayDatos = Boolean(t && t.respuestas > 0);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[var(--text)]">Consumo del agente de IA</h2>
          <p className="text-[12px] text-[var(--text-3)]">
            Tokens y costo por respuesta, separando texto e imágenes procesadas
          </p>
        </div>
        {datos?.modeloActual && (
          <span className="rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-[var(--text-2)]">
            {datos.modeloActual}
            {datos.tarifaActual
              ? ` · $${datos.tarifaActual.input}/M entrada · $${datos.tarifaActual.output}/M salida`
              : " · tarifa no registrada"}
          </span>
        )}
      </div>

      {cargando && (
        <div className="flex items-center gap-2 py-6 text-[13px] text-[var(--text-3)]">
          <Loader2 size={15} className="animate-spin" /> Cargando consumo...
        </div>
      )}

      {!cargando && error && <p className="py-4 text-[13px] text-[var(--text-3)]">{error}</p>}

      {!cargando && !error && !hayDatos && (
        <p className="py-4 text-[13px] text-[var(--text-3)]">
          Todavía no hay respuestas de la IA registradas para este cliente. En cuanto el agente
          conteste un WhatsApp, aquí aparece cuánto costó.
        </p>
      )}

      {!cargando && !error && hayDatos && t && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              Icon={Coins}
              valor={fmtCosto(t.costoTotal)}
              label="Costo total"
              detalle={`${t.respuestas} respuestas · ${fmtTokens(t.llamadas)} llamadas al modelo`}
            />
            <Kpi
              Icon={Type}
              valor={fmtCosto(t.costoTexto)}
              label="Texto"
              detalle={`${fmtTokens(t.tokensTexto)} tokens de entrada`}
            />
            <Kpi
              Icon={ImageIcon}
              valor={fmtCosto(t.costoImagen)}
              label="Imágenes"
              detalle={`${t.imagenes} procesadas · ${fmtTokens(t.tokensImagen)} tokens`}
            />
            <Kpi
              Icon={Coins}
              valor={fmtTokens(t.tokensPrompt + t.tokensSalida)}
              label="Tokens totales"
              detalle={`${fmtTokens(t.tokensPrompt)} entrada · ${fmtTokens(t.tokensSalida)} salida`}
            />
          </div>

          {/* El prompt completo NO es input_tokens: hay que sumarle el caché. */}
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-[11.5px] lg:grid-cols-4">
            <Linea label="Entrada sin caché" valor={fmtTokens(t.inputTokens)} />
            <Linea label="Escritura de caché" valor={fmtTokens(t.cacheEscritura)} />
            <Linea label="Lectura de caché" valor={fmtTokens(t.cacheLectura)} />
            <Linea label="Salida" valor={fmtTokens(t.tokensSalida)} />
          </div>

          <h3 className="mt-5 mb-2 text-[12.5px] font-bold text-[var(--text-2)]">
            Por conversación
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-[var(--text-3)]">
                  <th className="py-2 pr-3 font-semibold">Número</th>
                  <th className="py-2 pr-3 text-right font-semibold">Respuestas</th>
                  <th className="py-2 pr-3 text-right font-semibold">Tokens</th>
                  <th className="py-2 pr-3 text-right font-semibold">Texto</th>
                  <th className="py-2 pr-3 text-right font-semibold">Imágenes</th>
                  <th className="py-2 pr-3 text-right font-semibold">Total</th>
                  <th className="py-2 font-semibold">Modelo</th>
                </tr>
              </thead>
              <tbody>
                {datos.conversaciones.map((c) => (
                  <tr key={c.waFrom} className="border-b border-line/60">
                    <td className="py-2 pr-3 font-semibold text-[var(--text)]">{c.waFrom}</td>
                    <td className="py-2 pr-3 text-right text-[var(--text-2)]">{c.respuestas}</td>
                    <td className="py-2 pr-3 text-right text-[var(--text-2)]">
                      {fmtTokens(c.tokensPrompt + c.tokensSalida)}
                    </td>
                    <td className="py-2 pr-3 text-right text-[var(--text-2)]">
                      {fmtCosto(c.costoTexto)}
                    </td>
                    <td className="py-2 pr-3 text-right text-[var(--text-2)]">
                      {c.imagenes > 0 ? `${fmtCosto(c.costoImagen)} (${c.imagenes})` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right font-bold text-[var(--text)]">
                      {fmtCosto(c.costoTotal)}
                    </td>
                    <td className="py-2 text-[11.5px] text-[var(--text-3)]">
                      {c.modelos.join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  Icon,
  valor,
  label,
  detalle,
}: {
  Icon: typeof Coins;
  valor: string;
  label: string;
  detalle: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon size={16} />
      </span>
      <p className="mt-2 text-[20px] font-extrabold leading-none tracking-tight text-[var(--text)]">
        {valor}
      </p>
      <p className="mt-1 text-[12px] font-medium text-[var(--text-2)]">{label}</p>
      <p className="mt-0.5 text-[11px] text-[var(--text-3)]">{detalle}</p>
    </div>
  );
}

function Linea({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="font-semibold text-[var(--text)]">{valor}</p>
      <p className="text-[var(--text-3)]">{label}</p>
    </div>
  );
}
