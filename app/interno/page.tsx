"use client";

// Chat interno del equipo.
//
// Los mensajes y los canales viven en el servidor y se sondean cada pocos
// segundos. Antes vivían en la memoria de la pestaña: se veía igual, pero un
// mensaje no llegaba nunca al otro lado porque cada quien tenía su propia
// copia, y al recargar se borraba.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/EmptyState";
import { staff } from "@/lib/data/seed";
import { ChannelList } from "@/components/internal/ChannelList";
import { InternalThread } from "@/components/internal/InternalThread";
import { NuevoCanal } from "@/components/internal/NuevoCanal";
import { sinLeerPorCanal, useInterno } from "@/lib/interno-bridge";
import type { InternalChannel, InternalMessage } from "@/lib/data/types";

export default function InternoPage() {
  const { estado, enviar, marcarLeido, guardarCanal } = useInterno();
  const [activoId, setActivoId] = useState<string | null>(null);

  // Los canales del servidor, más un chat directo con cada compañero. Los
  // directos no se crean a mano: si una persona existe en el equipo, se le
  // tiene que poder escribir sin pedirle permiso a nadie.
  const canales: InternalChannel[] = useMemo(() => {
    const delServidor: InternalChannel[] = estado.canales.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      miembros: c.miembros,
    }));
    const directos: InternalChannel[] = staff
      .filter((s: { id: string }) => s.id !== estado.yo)
      .map((s: { id: string; nombre: string }) => ({
        id: idDirecto(estado.yo, s.id),
        nombre: s.nombre,
        tipo: "dm" as const,
        miembros: [estado.yo, s.id],
      }));
    const vistos = new Set(delServidor.map((c) => c.id));
    return [...delServidor, ...directos.filter((d) => !vistos.has(d.id))];
  }, [estado.canales, estado.yo]);

  const canal = activoId ? canales.find((c) => c.id === activoId) ?? null : null;

  const mensajes: InternalMessage[] = useMemo(() => {
    if (!canal) return [];
    return estado.mensajes
      .filter((m) => m.canalId === canal.id)
      .sort((a, b) => a.id - b.id)
      .map((m) => ({
        id: String(m.id),
        channelId: m.canalId,
        staffId: m.autor,
        texto: m.texto,
        ts: m.ts,
        imagen: m.imagen,
      }));
  }, [estado.mensajes, canal]);

  const sinLeer = useMemo(() => sinLeerPorCanal(estado), [estado]);

  // Abrir un canal es leerlo.
  useEffect(() => {
    if (!canal) return;
    const ultimo = estado.mensajes
      .filter((m) => m.canalId === canal.id)
      .reduce((max, m) => Math.max(max, m.id), 0);
    if (ultimo > (estado.leido[canal.id] ?? 0)) void marcarLeido(canal.id, ultimo);
  }, [canal, estado.mensajes, estado.leido, marcarLeido]);

  return (
    <div className="flex h-full flex-col">
      <header
        className={cn(
          "border-b border-line bg-card px-5 py-3 lg:block",
          canal ? "hidden lg:block" : "block",
        )}
      >
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Chat interno</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">Comunicación entre áreas</p>
      </header>

      {estado.enMemoria && (
        <div className="flex items-start gap-2 border-b border-[var(--warn-line,#fcd34d)] bg-[var(--warn-bg,#fffbeb)] px-5 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warn-fg,#92400e)]" />
          <p className="text-[12.5px] leading-relaxed text-[var(--warn-fg,#92400e)]">
            Falta la tabla del chat interno. Lo que escribas <strong>no le llega a nadie</strong> y
            se pierde al recargar.
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className={cn("shrink-0 lg:block", canal ? "hidden lg:block" : "block w-full lg:w-auto")}>
          <ChannelList
            channels={canales}
            activoId={activoId}
            onSelect={setActivoId}
            yo={estado.yo}
            sinLeer={sinLeer}
            pie={<NuevoCanal onCrear={guardarCanal} />}
          />
        </div>

        <div className={cn("min-w-0 flex-1", canal ? "block" : "hidden lg:block")}>
          {canal ? (
            <InternalThread
              channel={canal}
              messages={mensajes}
              onBack={() => setActivoId(null)}
              onSend={(texto, imagen) => void enviar(canal.id, texto, imagen)}
            />
          ) : (
            <div className="hidden h-full place-items-center lg:grid">
              <EmptyState
                Icon={MessagesSquare}
                titulo="Elegí un canal o una persona"
                descripcion="Acá se habla el equipo, aparte de las conversaciones con huéspedes."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Id de un chat directo, igual desde los dos lados.
 *
 * Se ordenan los ids antes de unirlos: si no, Verónica veria "s2-s3" y Olga
 * "s3-s2", y cada una escribiria en una conversacion distinta creyendo que
 * habla con la otra.
 */
function idDirecto(a: string, b: string): string {
  return `dm-${[a, b].sort().join("-")}`;
}
