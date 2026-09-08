"use client";

// Los leads que se están enfriando, en dos listas que piden cosas distintas.
//
// A los de la izquierda hay que perseguirles un papel. A los de la derecha ya
// no se les debe nada: entregaron todo y aun así nadie los movió, que es la
// peor de las dos y por eso va aparte y no mezclada en una sola lista.
//
// Cada uno trae lo que hace falta para decidir a quién llamar primero: cuánto
// quiere, cuántas veces ya se le buscó, y hace cuánto que nadie lo toca.

import { PhoneCall, MessageSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LeadFrio } from "@/lib/ventas-pipeline";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const dias = (n: number) => (n === 0 ? "hoy" : n === 1 ? "1 día" : `${n} días`);

function Fila({ l, vendedor }: { l: LeadFrio; vendedor: string }) {
  return (
    <li className="border-b border-line/60 py-2 last:border-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--text)]">{l.nombre}</span>
        <span
          className={cn(
            "shrink-0 text-[12.5px] font-bold tabular-nums",
            l.monto ? "text-[var(--text)]" : "text-[var(--text-3)]",
          )}
        >
          {l.monto ? usd(l.monto) : "sin monto"}
        </span>
      </div>
      <p className="truncate text-[11.5px] text-[var(--text-3)]">
        {vendedor} · {l.resumen}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--text-2)]">
        <span className="inline-flex items-center gap-1">
          <PhoneCall size={11} className="text-[var(--text-3)]" />
          {l.llamadas} {l.llamadas === 1 ? "llamada" : "llamadas"}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageSquare size={11} className="text-[var(--text-3)]" />
          {l.mensajes} {l.mensajes === 1 ? "mensaje" : "mensajes"}
        </span>
        <span className={cn(l.diasSinContacto >= 7 && "font-semibold text-[var(--brand-red)]")}>
          {l.diasSinContacto === 0 ? "contactado hoy" : `${dias(l.diasSinContacto)} sin contacto`}
        </span>
        <span className="text-[var(--text-3)]">{dias(l.diasDesdeInfo)} desde que llegó</span>
      </div>
    </li>
  );
}

function Lista({
  titulo,
  leads,
  nombreVendedor,
  vacio,
}: {
  titulo: string;
  leads: LeadFrio[];
  nombreVendedor: (id: string | null) => string;
  vacio: string;
}) {
  const plata = leads.reduce((s, l) => s + (l.monto ?? 0), 0);
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-bold text-[var(--text)]">{titulo}</h3>
        <span className="text-[12.5px] font-bold tabular-nums text-[var(--text)]">
          {leads.length}
          {plata > 0 && <span className="ml-1.5 font-semibold text-[var(--text-3)]">{usd(plata)}</span>}
        </span>
      </div>
      {leads.length === 0 ? (
        <p className="mt-1 text-[12.5px] text-[var(--text-3)]">{vacio}</p>
      ) : (
        <ul className="mt-1.5 max-h-[340px] overflow-y-auto pr-1">
          {leads.map((l) => (
            <Fila key={l.telefono} l={l} vendedor={nombreVendedor(l.vendedor)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function Enfriandose({
  pendientesDoc,
  docCompleta,
  nombreVendedor,
}: {
  pendientesDoc: LeadFrio[];
  docCompleta: LeadFrio[];
  nombreVendedor: (id: string | null) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Lista
        titulo="Leads enfriándose, pendientes de documentación"
        leads={pendientesDoc}
        nombreVendedor={nombreVendedor}
        vacio="Nadie lleva tres días quieto esperando papeles."
      />
      <Lista
        titulo="Leads enfriándose con documentación completa"
        leads={docCompleta}
        nombreVendedor={nombreVendedor}
        vacio="Ninguno entregó todo y quedó esperando."
      />
    </div>
  );
}
