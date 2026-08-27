"use client";

// Reservar a mano desde el dashboard.
//
// Para lo que no pasa por Sofía: una llamada, alguien en recepción, una
// reserva que ya se cobró por otro lado. Mismo camino que la confirmación de
// un apartado: tarifas reales de la sede, queda en el panel y entra a
// Cloudbeds si la escritura está encendida.

import { useEffect, useState } from "react";
import { BedDouble, CheckCircle2, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Opcion {
  habitacion_id: string;
  habitacion: string;
  descripcion: string;
  hasta_huespedes: number;
  libres: number;
  noches: number;
  tarifa_por_noche: number;
  total_estadia: number;
}

const SEDES = [
  { id: "a", nombre: "Yalí" },
  { id: "b", nombre: "Costa del Surf" },
  { id: "c", nombre: "Playa Linda" },
];

function hoyMas(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function NuevaReserva({ sedeInicial, onCerrar, onCreada }: { sedeInicial?: string; onCerrar: () => void; onCreada: () => void }) {
  const [sede, setSede] = useState(sedeInicial && SEDES.some((s) => s.id === sedeInicial) ? sedeInicial : "a");
  const [llegada, setLlegada] = useState(hoyMas(1));
  const [salida, setSalida] = useState(hoyMas(2));
  const [adultos, setAdultos] = useState(2);
  const [ninos, setNinos] = useState(0);
  const [opciones, setOpciones] = useState<Opcion[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [habitacion, setHabitacion] = useState<string>("");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecha, setHecha] = useState<{ codigo: string; enCloudbeds: boolean; total: number } | null>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  async function buscar() {
    setBuscando(true);
    setError(null);
    setOpciones(null);
    setHabitacion("");
    try {
      const q = new URLSearchParams({ sede, llegada, salida, adultos: String(adultos), ninos: String(ninos) });
      const r = await fetch(`/api/yali/reservas?${q}`, { cache: "no-store" });
      const d = (await r.json()) as { ok: boolean; opciones?: Opcion[]; nota?: string; error?: string; aviso_tarifas?: string };
      if (!d.ok) {
        setError(d.error ?? "No se pudo consultar.");
      } else {
        setOpciones(d.opciones ?? []);
        setAviso(d.aviso_tarifas ?? null);
        if (d.opciones?.length === 1) setHabitacion(d.opciones[0].habitacion);
      }
    } catch {
      setError("No se pudo consultar la disponibilidad.");
    } finally {
      setBuscando(false);
    }
  }

  async function reservar() {
    if (!habitacion || !nombre.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/yali/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sede, llegada, salida, adultos, ninos, habitacion, nombre, correo, telefono, notas }),
      });
      const d = (await r.json()) as { ok: boolean; error?: string; reserva?: { id: string; reservaCloudbeds: string | null; total: number }; enCloudbeds?: boolean };
      if (!d.ok || !d.reserva) {
        setError(d.error ?? "No se pudo tomar la reserva.");
        return;
      }
      setHecha({ codigo: d.reserva.reservaCloudbeds ?? d.reserva.id, enCloudbeds: Boolean(d.enCloudbeds), total: d.reserva.total });
      onCreada();
    } catch {
      setError("No se pudo tomar la reserva.");
    } finally {
      setGuardando(false);
    }
  }

  const elegida = opciones?.find((o) => o.habitacion === habitacion) ?? null;
  const campo = "w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-[var(--text)] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" onClick={onCerrar}>
      <div className="w-full max-w-xl rounded-2xl border border-line bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--text)]">
            <BedDouble size={16} className="text-brand" /> Nueva reserva
          </h2>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1 text-[var(--text-3)] transition hover:bg-surface" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {hecha ? (
          <div className="space-y-3 px-5 py-6 text-center">
            <CheckCircle2 size={34} className="mx-auto text-[#2f9e2f]" />
            <p className="text-[15px] font-bold text-[var(--text)]">Reserva tomada · {hecha.codigo}</p>
            <p className="text-[13px] text-[var(--text-2)]">
              {elegida?.habitacion} en {SEDES.find((s) => s.id === sede)?.nombre}, del {llegada} al {salida}, ${hecha.total}.
              {hecha.enCloudbeds ? " Ya está en Cloudbeds." : " Quedó en el panel; hay que cargarla en Cloudbeds."}
            </p>
            <button type="button" onClick={onCerrar} className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white">
              Listo
            </button>
          </div>
        ) : (
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <label className="col-span-2 text-[11.5px] font-semibold text-[var(--text-3)]">
                Hotel
                <select value={sede} onChange={(e) => setSede(e.target.value)} className={cn(campo, "mt-1")}>
                  {SEDES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                Llegada
                <input type="date" value={llegada} onChange={(e) => setLlegada(e.target.value)} className={cn(campo, "mt-1")} />
              </label>
              <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                Salida
                <input type="date" value={salida} onChange={(e) => setSalida(e.target.value)} className={cn(campo, "mt-1")} />
              </label>
              <div className="flex gap-2">
                <label className="flex-1 text-[11.5px] font-semibold text-[var(--text-3)]">
                  Adultos
                  <input type="number" min={1} value={adultos} onChange={(e) => setAdultos(Math.max(1, Number(e.target.value) || 1))} className={cn(campo, "mt-1")} />
                </label>
                <label className="flex-1 text-[11.5px] font-semibold text-[var(--text-3)]">
                  Niños
                  <input type="number" min={0} value={ninos} onChange={(e) => setNinos(Math.max(0, Number(e.target.value) || 0))} className={cn(campo, "mt-1")} />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void buscar()}
              disabled={buscando || !llegada || !salida}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-[var(--text-2)] transition hover:bg-card disabled:opacity-60"
            >
              {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar habitaciones libres
            </button>

            {aviso && <p className="text-[12px] text-[var(--text-3)]">{aviso}</p>}

            {opciones && opciones.length === 0 && (
              <p className="rounded-xl border border-dashed border-line p-3 text-[12.5px] text-[var(--text-3)]">
                No hay habitaciones libres para esas fechas y esa cantidad de personas.
              </p>
            )}
            {opciones && opciones.length > 0 && (
              <div className="space-y-1.5">
                {opciones.map((o) => (
                  <label
                    key={o.habitacion_id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-[13px] transition",
                      habitacion === o.habitacion ? "border-brand bg-brand/[0.06]" : "border-line hover:bg-surface",
                    )}
                  >
                    <input type="radio" name="habitacion" checked={habitacion === o.habitacion} onChange={() => setHabitacion(o.habitacion)} />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-[var(--text)]">{o.habitacion}</span>
                      <span className="text-[var(--text-3)]">
                        {" "}
                        · hasta {o.hasta_huespedes} · {o.libres} {o.libres === 1 ? "libre" : "libres"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold text-[var(--text)]">${o.total_estadia}</span>
                      <span className="block text-[11px] text-[var(--text-3)]">
                        ${o.tarifa_por_noche} × {o.noches} {o.noches === 1 ? "noche" : "noches"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {habitacion && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                  Nombre completo del huésped
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={cn(campo, "mt-1")} placeholder="Ana Pérez" />
                </label>
                <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                  Correo
                  <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} className={cn(campo, "mt-1")} placeholder="ana@correo.com" />
                </label>
                <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                  Teléfono (WhatsApp)
                  <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className={cn(campo, "mt-1")} placeholder="+503 7000 0000" />
                </label>
                <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                  Notas para el hotel
                  <input value={notas} onChange={(e) => setNotas(e.target.value)} className={cn(campo, "mt-1")} placeholder="Llega de madrugada, cama extra..." />
                </label>
              </div>
            )}

            {error && <p className="text-[12.5px] text-[#c2410c]">{error}</p>}

            <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
              <button type="button" onClick={onCerrar} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-[var(--text-2)] transition hover:bg-surface">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void reservar()}
                disabled={guardando || !habitacion || !nombre.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {guardando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Tomar la reserva{elegida ? ` · $${elegida.total_estadia}` : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
