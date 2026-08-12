"use client";

// Lo que el sistema de reservas del hotel sabe de este contacto: sus estadías,
// las notas que dejó el hotel, por qué canal reservó y qué debe.
//
// Solo lectura. Nada de lo que se ve acá se escribe del otro lado, y cuando una
// consulta no responde se dice, en vez de mostrarlo como si no hubiera nada.

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Link2, Loader2, StickyNote } from "lucide-react";
import { cn } from "@/lib/cn";

interface Nota {
  id: string;
  texto: string;
  fecha: string;
  autor: string;
}
interface Estadia {
  id: string;
  estado: string;
  momento: "pasada" | "en_casa" | "futura";
  desde: string;
  hasta: string;
  noches: number;
  adultos: number;
  ninos: number;
  habitaciones: string[];
  tipos: string[];
  saldo: number;
  fuente: string;
  fuenteExterna: boolean;
  sinAsignar: number;
  notas: Nota[] | null;
}
interface Ficha {
  vinculo: "telefono" | "correo" | "nombre";
  huesped: {
    id: string;
    nombreCompleto: string;
    correo: string;
    telefono: string;
    celular: string;
    pais: string;
  };
  estadias: Estadia[];
  notas: Nota[] | null;
  saldoTotal: number;
  avisos: string[];
}
type Resultado =
  | { estado: "match"; ficha: Ficha }
  | { estado: "sin_match"; padron: number; completo: boolean }
  | { estado: "sin_sistema" }
  | { estado: "error"; error: string };

const MOMENTO: Record<Estadia["momento"], string> = {
  en_casa: "En casa",
  futura: "Próxima",
  pasada: "Anterior",
};

const VINCULO: Record<Ficha["vinculo"], string> = {
  telefono: "El teléfono de este contacto es el que tiene el hotel cargado.",
  correo: "El correo de este contacto es el que tiene el hotel cargado.",
  nombre:
    "Coincide el nombre completo. Ni el teléfono ni el correo de este contacto están cargados en el hotel, así que confírmalo antes de darlo por hecho.",
};

function fechaCorta(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha;
  const [a, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

function dinero(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function HuespedPms({
  telefono,
  correo,
  nombre,
}: {
  telefono: string;
  correo: string;
  nombre: string;
}) {
  const [res, setRes] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const qs = new URLSearchParams({ telefono, correo, nombre });
    fetch(`/api/hotel/huesped?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setRes(d.ok ? (d.resultado as Resultado) : { estado: "error", error: d.error });
      })
      .catch(() => vivo && setRes({ estado: "error", error: "No se pudo consultar." }))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [telefono, correo, nombre]);

  if (cargando) {
    return (
      <Marco>
        <p className="flex items-center gap-2 px-1 py-1 text-[12.5px] text-[var(--text-2)]">
          <Loader2 size={14} className="animate-spin text-brand" />
          Buscando en el sistema del hotel
        </p>
      </Marco>
    );
  }

  if (!res || res.estado === "sin_sistema") return null;

  if (res.estado === "error") {
    return (
      <Marco>
        <p className="flex items-start gap-2 px-1 py-1 text-[12.5px] text-[var(--text-2)]">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
          {res.error || "No se pudo consultar el sistema del hotel."}
        </p>
      </Marco>
    );
  }

  if (res.estado === "sin_match") {
    return (
      <Marco>
        <div className="rounded-lg border border-dashed border-[var(--border-2)] px-3.5 py-4 text-center">
          <p className="text-[12.5px] font-semibold text-[var(--text-2)]">
            Este contacto no está en el sistema del hotel
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-3)]">
            Se busca por teléfono y por correo. En cuanto se hospede, sus estadías y las notas del
            hotel aparecen acá solas.
          </p>
          {!res.completo && (
            <p className="mt-1.5 text-[11px] text-[var(--text-3)]">
              La búsqueda se cortó en {res.padron} fichas.
            </p>
          )}
        </div>
      </Marco>
    );
  }

  const f = res.ficha;
  const enCasa = f.estadias.some((e) => e.momento === "en_casa");
  // El total solo aporta cuando suma varias reservas: con una sola sería el
  // mismo número dos veces en la misma tarjeta.
  const totalAparte = f.estadias.filter((e) => e.saldo > 0).length > 1;

  return (
    <Marco>
      <div className="space-y-3">
        <p
          className={cn(
            "flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed",
            f.vinculo === "nombre"
              ? "bg-[var(--brand-accent)]/10 text-[var(--text-2)]"
              : "bg-brand/[0.08] text-[var(--text-2)]",
          )}
        >
          <Link2
            size={14}
            className={cn(
              "mt-0.5 shrink-0",
              f.vinculo === "nombre" ? "text-[var(--brand-accent)]" : "text-brand",
            )}
          />
          {VINCULO[f.vinculo]}
        </p>

        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-[13px] font-bold text-[var(--text)]">{f.huesped.nombreCompleto}</span>
          {enCasa && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
              En casa
            </span>
          )}
          {totalAparte && (
            <span className="rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--brand-accent)]">
              {dinero(f.saldoTotal)} pendiente en total
            </span>
          )}
        </div>

        {(f.huesped.correo || f.huesped.telefono || f.huesped.celular || f.huesped.pais) && (
          <p className="px-1 text-[11.5px] text-[var(--text-3)]">
            {[f.huesped.correo, f.huesped.telefono || f.huesped.celular, f.huesped.pais]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <div className="space-y-2">
          {f.estadias.length === 0 ? (
            <Vacio texto="Tiene ficha en el hotel, pero todavía ninguna reserva." />
          ) : (
            f.estadias.map((e) => <FilaEstadia key={e.id} e={e} />)
          )}
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)]">
            <StickyNote size={12} />
            Notas del hotel sobre el huésped
          </p>
          {f.notas === null ? (
            <NoSePudo texto="No se pudieron consultar las notas del huésped." />
          ) : f.notas.length === 0 ? (
            <Vacio texto="Sin notas cargadas." />
          ) : (
            <ul className="space-y-1.5">
              {f.notas.map((n) => (
                <FilaNota key={n.id} n={n} />
              ))}
            </ul>
          )}
        </div>

        {f.avisos.length > 0 && (
          <p className="flex items-start gap-2 px-1 text-[11.5px] text-[var(--text-3)]">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
            {f.avisos.join(" ")}
          </p>
        )}
      </div>
    </Marco>
  );
}

function FilaEstadia({ e }: { e: Estadia }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        e.momento === "en_casa" ? "border-brand/45 bg-brand/[0.06]" : "border-line bg-surface/60",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-bold text-[var(--text)]">
          {fechaCorta(e.desde)} al {fechaCorta(e.hasta)}
        </p>
        <span className="text-[11px] font-semibold text-[var(--text-3)]">{e.id}</span>
      </div>
      <p className="mt-0.5 text-[11.5px] text-[var(--text-2)]">
        {e.habitaciones.join(", ") || e.tipos.join(", ") || "sin habitación asignada"} · {e.noches}{" "}
        {e.noches === 1 ? "noche" : "noches"} · {e.adultos} {e.adultos === 1 ? "adulto" : "adultos"}
        {e.ninos > 0 ? ` y ${e.ninos} ${e.ninos === 1 ? "niño" : "niños"}` : ""}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Pastilla>{MOMENTO[e.momento]}</Pastilla>
        <Pastilla>{e.estado}</Pastilla>
        <Pastilla>
          {e.fuente}
          {e.fuenteExterna ? " (portal)" : ""}
        </Pastilla>
        {e.saldo > 0 && (
          <span className="rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--brand-accent)]">
            {dinero(e.saldo)} pendiente
          </span>
        )}
      </div>

      {e.notas === null ? (
        <div className="mt-2">
          <NoSePudo texto="No se pudieron consultar las notas de esta reserva." />
        </div>
      ) : e.notas.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {e.notas.map((n) => (
            <FilaNota key={n.id} n={n} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FilaNota({ n }: { n: Nota }) {
  return (
    <li className="rounded-lg border-l-2 border-brand/60 bg-card px-2.5 py-2">
      <p className="whitespace-pre-line text-[12px] leading-relaxed text-[var(--text)]">{n.texto}</p>
      {(n.autor || n.fecha) && (
        <p className="mt-1 text-[10.5px] text-[var(--text-3)]">
          {[n.autor, n.fecha && fechaCorta(n.fecha)].filter(Boolean).join(" · ")}
        </p>
      )}
    </li>
  );
}

function Pastilla({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
      {children}
    </span>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--border-2)] px-3 py-3 text-center text-[11.5px] text-[var(--text-3)]">
      {texto}
    </p>
  );
}

function NoSePudo({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg border border-dashed border-[var(--brand-accent)]/50 px-3 py-2.5 text-[11.5px] text-[var(--text-2)]">
      <AlertCircle size={13} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
      {texto}
    </p>
  );
}

function Marco({ children }: { children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)]">
        Sistema de reservas
      </p>
      <div className="rounded-xl border border-line bg-card p-2.5">{children}</div>
    </div>
  );
}
