"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, PhoneOff, RefreshCw } from "lucide-react";
import { AgenteCard } from "@/components/agentes/AgenteCard";
import { PanelAgente } from "@/components/agentes/PanelAgente";
import { EmptyState } from "@/components/ui/EmptyState";
import { activeTenantId } from "@/lib/tenants/active";
import { esAgencia } from "@/lib/tenants/voz";
import type { AgenteRecord, NumeroRecord } from "@/lib/vapi";

interface Respuesta {
  source: "vapi" | "demo";
  agentes: AgenteRecord[];
  sincronizadaEn?: string;
  error?: string;
}

type Seccion = "script" | "numeros" | "llamar";

export default function AgentesPage() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [numeros, setNumeros] = useState<NumeroRecord[]>([]);
  const [cargando, setCargando] = useState(true);
  // Panel abierto: que agente y en que seccion. null = cerrado.
  const [panel, setPanel] = useState<{ id: string; seccion: Seccion } | null>(null);
  // La agencia administra la cuenta entera (script, lineas, avisos). El cliente
  // ve su agente y lo puede probar; el resto ni le llega del servidor.
  const agencia = esAgencia(activeTenantId());

  const sincronizar = useCallback(async () => {
    setCargando(true);
    try {
      // Agentes y numeros van juntos: el panel necesita los dos para poder
      // ofrecer reasignaciones, y pedirlos por separado deja la UI a medias.
      const [rAg, rNum] = await Promise.all([
        fetch("/api/agentes"),
        fetch("/api/numeros").catch(() => null),
      ]);
      setData((await rAg.json()) as Respuesta);
      if (rNum?.ok) {
        const d = (await rNum.json()) as { numeros?: NumeroRecord[] };
        setNumeros(d.numeros ?? []);
      }
    } catch (err) {
      setData({
        source: "vapi",
        agentes: [],
        error: err instanceof Error ? err.message : "Error de red",
      });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void sincronizar();
  }, [sincronizar]);

  const agentes = data?.agentes ?? [];
  const abierto = useMemo(
    () => (panel ? agentes.find((a) => a.id === panel.id) : undefined),
    [panel, agentes],
  );
  const sinNumero = agentes.filter((a) => a.numeros.length === 0).length;
  const libres = numeros.filter((n) => !n.assistantId).length;

  return (
    // Mismo patron que /llamadas: el <main> del AppShell es overflow-hidden, asi
    // que la pagina scrollea por su cuenta con el header fijo arriba.
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Agentes</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {!data
              ? "Cargando..."
              : agencia
                ? `${agentes.length} agente${agentes.length === 1 ? "" : "s"} de voz ${
                    data.source === "demo" ? "(datos de demostración)" : "en Vapi"
                  }`
                : "Quién atiende y responde tu línea"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={cargando}
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-surface disabled:opacity-50"
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Sincronizar
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {data?.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
            {agencia ? (
              <>
                <strong>No se pudo conectar con Vapi:</strong> {data.error}
              </>
            ) : (
              <strong>No se pudo cargar tu agente. Probá sincronizar en unos segundos.</strong>
            )}
          </div>
        )}

        {agencia && data?.source === "demo" && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
            <strong>Estás viendo agentes de ejemplo, no los reales.</strong> Falta la variable{" "}
            <code>VAPI_PRIVATE_KEY</code> en este entorno. Llamar y reasignar quedan deshabilitados.
          </div>
        )}

        {/* Aviso accionable: un agente sin numero no sirve, y un numero libre es
            capacidad ociosa. Se dice arriba para no tener que abrir cada
            tarjeta para descubrirlo. */}
        {agencia && sinNumero > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
            <PhoneOff size={15} className="shrink-0" />
            <span>
              <strong>
                {sinNumero} agente{sinNumero === 1 ? "" : "s"} sin número
              </strong>{" "}
              {sinNumero === 1 ? "no puede" : "no pueden"} recibir ni hacer llamadas.
              {libres > 0 &&
                ` Hay ${libres} número${libres === 1 ? "" : "s"} libre${libres === 1 ? "" : "s"} para asignar.`}
            </span>
          </div>
        )}

        {data && agentes.length === 0 && !data.error ? (
          <EmptyState
            titulo="Sin agentes"
            descripcion={
              agencia
                ? "No hay assistants configurados en esta cuenta de Vapi."
                : "Todavía no hay un agente de voz configurado para tu línea."
            }
            Icon={Bot}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {agentes.map((a) => (
              <AgenteCard
                key={a.id}
                agente={a}
                modoCliente={!agencia}
                puedeMarcar={numeros.length > 0}
                onAbrir={(seccion) => setPanel({ id: a.id, seccion })}
              />
            ))}
          </div>
        )}
      </div>

      {abierto && panel && (
        <PanelAgente
          agente={abierto}
          numeros={numeros}
          seccionInicial={panel.seccion}
          modoCliente={!agencia}
          onCerrar={() => setPanel(null)}
          onCambio={() => void sincronizar()}
        />
      )}
    </div>
  );
}
