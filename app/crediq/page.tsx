"use client";

import { useEffect, useMemo, useState } from "react";
import { GitBranch, Phone, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { telefonoBonito } from "@/lib/phone";
import { activeTenant } from "@/lib/tenants/active";

// Tablero de prospectos de CrediQ, la financiera de Grupo Q.
//
// No inventa un almacén nuevo: lee los MISMOS contactos que la pestaña
// Contactos (/api/contactos) y los ordena por la etiqueta de etapa que ya edita
// el staff ahí. Así lo que se marca en la ficha se ve en el tablero y al revés,
// sin dos verdades que se contradigan.
//
// Deliberadamente NO es el /pipeline de la inmobiliaria: ese trae propiedades,
// carriles y mudanzas, que en un concesionario no significan nada.

interface ContactoDTO {
  telefono: string;
  nombre: string;
  apellido: string;
  correo: string;
  notas: string;
  tags: string[];
  /** ISO. Puede faltar cuando la ficha viene del seed en memoria. */
  actualizado?: string | null;
}

// El orden del embudo. Estas etiquetas viven en la config del tenant
// (lib/tenants/grupoq.ts) y son las mismas que ofrece la ficha del contacto.
const ETAPAS = [
  "Cotización enviada",
  "Test drive agendado",
  "Pendiente documentos",
  "Pre-aprobado",
  "Aprobado",
  "Entrega programada",
  "Cliente cerrado",
] as const;

const SIN_ETAPA = "Nuevos";

// Qué significa cada columna, para que quien abra el tablero por primera vez no
// tenga que adivinar dónde va cada quien.
const AYUDA: Record<string, string> = {
  [SIN_ETAPA]: "Escribieron y todavía nadie los clasificó",
  "Cotización enviada": "Ya tienen números, están decidiendo",
  "Test drive agendado": "Con cita para probar el vehículo",
  "Pendiente documentos": "Falta papelería para armar el expediente",
  "Pre-aprobado": "CrediQ dio el visto bueno preliminar",
  Aprobado: "Crédito aprobado, listo para cerrar",
  "Entrega programada": "Firmado, con fecha de entrega",
  "Cliente cerrado": "Vehículo entregado",
};

// El vehículo sale de las notas. Es un dato DERIVADO, no un campo: el staff
// escribe la nota libre y acá se reconoce el modelo contra el catálogo. Si no
// aparece ninguno, la tarjeta simplemente no muestra chip, que es mejor que
// mostrar uno inventado.
const MODELOS = [
  "Frontier",
  "X-Trail",
  "Kicks",
  "Qashqai",
  "Versa",
  "Sentra",
  "Navara",
  "Patrol",
  "Urvan",
];

function vehiculoDe(notas: string): string | null {
  const n = notas.toLowerCase();
  return MODELOS.find((m) => n.includes(m.toLowerCase())) ?? null;
}

function etapaDe(tags: string[]): string {
  return ETAPAS.find((e) => tags.includes(e)) ?? SIN_ETAPA;
}

function nombreDe(c: ContactoDTO): string {
  return [c.nombre, c.apellido].filter(Boolean).join(" ").trim() || c.telefono;
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function CrediqPage() {
  const [contactos, setContactos] = useState<ContactoDTO[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState<string | null>(null);
  const tenant = activeTenant();

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch("/api/contactos");
      const d = (await r.json()) as { ok: boolean; contactos?: ContactoDTO[] };
      setContactos(d.contactos ?? []);
    } catch {
      setContactos([]);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  // Mover de etapa = reemplazar la etiqueta de etapa dejando intactas las de
  // interés. Optimista, porque el tablero se siente muerto si hay que esperar
  // la ida y vuelta para ver la tarjeta cambiar de columna.
  async function moverA(c: ContactoDTO, etapa: string) {
    const sinEtapas = c.tags.filter((t) => !ETAPAS.includes(t as (typeof ETAPAS)[number]));
    const tags = etapa === SIN_ETAPA ? sinEtapas : [...sinEtapas, etapa];
    setContactos((prev) =>
      (prev ?? []).map((x) => (x.telefono === c.telefono ? { ...x, tags } : x)),
    );
    setGuardando(c.telefono);
    try {
      await fetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono: c.telefono, tags }),
      });
    } finally {
      setGuardando(null);
    }
  }

  const columnas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const filtrados = (contactos ?? []).filter(
      (c) =>
        !term ||
        [nombreDe(c), c.telefono, c.notas].join(" ").toLowerCase().includes(term),
    );
    // Lo mas reciente arriba: quien acaba de llamar o de escribir es lo que hay
    // que atender primero. Las fichas sin fecha (seed en memoria) van al final,
    // no al principio, porque no son nuevas: es que no traen el dato.
    const porFecha = (a: ContactoDTO, b: ContactoDTO) =>
      (b.actualizado ?? "").localeCompare(a.actualizado ?? "");
    return [SIN_ETAPA, ...ETAPAS].map((etapa) => ({
      etapa,
      fichas: filtrados.filter((c) => etapaDe(c.tags) === etapa).sort(porFecha),
    }));
  }, [contactos, busqueda]);

  const enEmbudo = columnas
    .filter((c) => c.etapa !== "Cliente cerrado")
    .reduce((n, c) => n + c.fichas.length, 0);
  const nuevos = columnas.find((c) => c.etapa === SIN_ETAPA)?.fichas.length ?? 0;

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text)]">
            <GitBranch size={20} className="text-brand" />
            Pipeline CrediQ
          </h1>
          <p className="text-xs text-[var(--text-3)]">
            {cargando
              ? "Cargando prospectos..."
              : `${enEmbudo} ${tenant.labels.contactoPlural} en el embudo${nuevos > 0 ? ` · ${nuevos} sin clasificar` : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
            />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar nombre, teléfono o nota"
              className="w-64 rounded-lg border border-line bg-card py-1.5 pl-7 pr-2 text-xs text-[var(--text)] outline-none"
            />
          </div>
          <button
            onClick={() => void cargar()}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-semibold text-[var(--text)]"
          >
            <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
            Actualizar
          </button>
        </div>
      </div>

      {!cargando && (contactos?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-[var(--text-3)]">
          Todavía no hay {tenant.labels.contactoPlural} con ficha. Las fichas se llavean por
          teléfono, así que aparecen acá cuando alguien escribe por WhatsApp o cuando se crean a
          mano desde Contactos.
        </div>
      )}

      <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
        {columnas.map(({ etapa, fichas }) => (
          <section
            key={etapa}
            className="flex w-64 shrink-0 flex-col rounded-xl border border-line bg-surface/60"
          >
            <header className="border-b border-line px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold text-[var(--text)]">{etapa}</h2>
                <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-3)]">
                  {fichas.length}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] leading-tight text-[var(--text-3)]">
                {AYUDA[etapa]}
              </p>
            </header>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {fichas.length === 0 && (
                <p className="px-1 py-3 text-center text-[10px] text-[var(--text-3)]">Sin nadie</p>
              )}
              {fichas.map((c) => {
                const nombre = nombreDe(c);
                const vehiculo = vehiculoDe(c.notas);
                return (
                  <article
                    key={c.telefono}
                    className={cn(
                      "rounded-lg border border-line bg-card p-2.5 transition-opacity",
                      guardando === c.telefono && "opacity-50",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                        {iniciales(nombre)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[var(--text)]">{nombre}</p>
                        <p className="flex items-center gap-1 text-[10px] text-[var(--text-3)]">
                          <Phone size={9} />
                          {telefonoBonito(c.telefono)}
                        </p>
                      </div>
                    </div>

                    {vehiculo && (
                      <span className="mt-2 inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                        {vehiculo}
                      </span>
                    )}

                    {c.notas && (
                      <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-[var(--text-3)]">
                        {c.notas}
                      </p>
                    )}

                    <select
                      value={etapa}
                      onChange={(e) => void moverA(c, e.target.value)}
                      className="mt-2 w-full rounded-md border border-line bg-surface px-1.5 py-1 text-[10px] font-semibold text-[var(--text)] outline-none"
                      aria-label={`Etapa de ${nombre}`}
                    >
                      {[SIN_ETAPA, ...ETAPAS].map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
