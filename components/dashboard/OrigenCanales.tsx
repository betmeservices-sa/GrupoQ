import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { origenPorCanal } from "@/lib/origen-canales";
import type { Channel, Conversation } from "@/lib/data/types";

// Color de cada plataforma, el mismo que llevan las pastillas de canal en la
// bandeja: la barra y el ícono de una fila hablan del mismo canal.
const COLOR: Record<Channel, string> = {
  whatsapp: "#25D366",
  instagram: "#E1306C",
  facebook: "#1877F2",
  internal: "#475569",
};

export function OrigenCanales({ conversations }: { conversations: Conversation[] }) {
  const filas = origenPorCanal(conversations);
  const max = Math.max(1, ...filas.map((f) => f.total));

  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-[var(--text)]">De dónde llegan las conversaciones</h2>
        {filas.length > 0 && (
          <span className="text-[12px] text-[var(--text-3)]">{conversations.length} en total</span>
        )}
      </div>

      {filas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-7 text-center text-[12.5px] text-[var(--text-3)]">
          Cuando entre el primer mensaje, aquí aparece por qué canal llegó.
        </p>
      ) : (
        <div className="space-y-3">
          {filas.map((f) => {
            const color = COLOR[f.canal];
            return (
              <div key={f.canal} className="flex items-center gap-3">
                <ChannelBadge
                  channel={f.canal}
                  showLabel
                  className="w-[104px] shrink-0 justify-start"
                />
                <div
                  className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface"
                  title={`${f.pendientes} de ${f.total} sin atender`}
                >
                  {/* Largo = volumen del canal. El tramo sólido es lo que sigue
                      esperando; el resto, en tono bajo, ya está atendido. */}
                  <div
                    className="flex h-full rounded-full transition-all"
                    style={{ width: `${(f.total / max) * 100}%`, backgroundColor: `${color}52` }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(f.pendientes / f.total) * 100}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
                <span className="w-8 shrink-0 text-right text-[12.5px] font-bold text-[var(--text)]">
                  {f.total}
                </span>
                <span className="w-9 shrink-0 text-right text-[12.5px] text-[var(--text-3)]">
                  {f.pct}%
                </span>
                <span className="w-[112px] shrink-0 text-right">
                  {f.pendientes > 0 ? (
                    <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11.5px] font-bold text-[#b07d1a]">
                      {f.pendientes} sin atender
                    </span>
                  ) : (
                    <span className="text-[11.5px] font-medium text-[var(--text-3)]">al día</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
