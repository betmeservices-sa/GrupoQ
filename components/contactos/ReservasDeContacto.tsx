"use client";

// Las reservas de una ficha de contacto: las que Sofía apartó en su chat, las
// que el equipo cerró y se detectaron, y las que se tomaron a mano con su
// teléfono. Misma tarjeta que en la ficha del chat y en el dashboard.

import { useCallback, useEffect, useState } from "react";
import { ApartadoCard, type Apartado } from "@/components/yali/Apartados";

export function ReservasDeContacto({ from }: { from: string }) {
  const [lista, setLista] = useState<Apartado[] | null>(null);
  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/yali/prereservas?contacto=${encodeURIComponent(from)}`, { cache: "no-store" });
      const d = (await r.json()) as { ok?: boolean; reservas?: Apartado[] };
      setLista(d.ok ? (d.reservas ?? []) : []);
    } catch {
      setLista([]);
    }
  }, [from]);
  useEffect(() => {
    setLista(null);
    void cargar();
  }, [cargar]);

  if (lista === null) return <p className="px-1 text-[12.5px] text-[var(--text-3)]">Buscando reservas...</p>;
  if (lista.length === 0) return <p className="px-1 text-[12.5px] text-[var(--text-3)]">Sin reservas todavía.</p>;
  return (
    <div className="space-y-2 px-1">
      {lista.map((a) => (
        <ApartadoCard key={a.id} a={a} compacto onCambio={cargar} />
      ))}
    </div>
  );
}
