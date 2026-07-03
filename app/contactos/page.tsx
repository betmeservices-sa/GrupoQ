"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Contact as ContactIcon, MessageSquarePlus, Plus, Search, X } from "lucide-react";
import { activeTenant } from "@/lib/tenants/active";
import { Avatar, inicialesDe } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";

interface ContactoDTO {
  telefono: string;
  nombre: string;
  apellido: string;
  correo: string;
  notas: string;
  tags: string[];
}

// Paleta estable para las etiquetas (por posición en la lista del tenant).
const TAG_COLORS = ["#0067f8", "#4ac12f", "#f5a623", "#9b51e0", "#e84d8a", "#00b8d4", "#a32923"];

function TagBadge({ tag, tags }: { tag: string; tags: string[] }) {
  const i = tags.indexOf(tag);
  const color = TAG_COLORS[(i >= 0 ? i : 0) % TAG_COLORS.length];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}14` }}
    >
      {tag}
    </span>
  );
}

export default function ContactosPage() {
  const router = useRouter();
  const tags = activeTenant().tags;
  const [contactos, setContactos] = useState<ContactoDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [tagFiltro, setTagFiltro] = useState(""); // "" = todos
  const [modal, setModal] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch("/api/contactos");
      const d = await r.json();
      if (d.ok) setContactos(d.contactos as ContactoDTO[]);
    } catch {
      // silencioso
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contactos.filter((c) => {
      const okTag = !tagFiltro || c.tags.includes(tagFiltro);
      const okQ =
        !term ||
        [c.nombre, c.apellido, c.correo, c.telefono].join(" ").toLowerCase().includes(term);
      return okTag && okQ;
    });
  }, [contactos, q, tagFiltro]);

  function iniciarConversacion(c: ContactoDTO) {
    sessionStorage.setItem(
      "ccg.iniciarConv",
      JSON.stringify({
        telefono: c.telefono,
        nombre: [c.nombre, c.apellido].filter(Boolean).join(" "),
      }),
    );
    router.push("/");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Contactos</h1>
          <p className="text-[12.5px] text-[#94a3b4]">
            {contactos.length} {contactos.length === 1 ? "contacto" : "contactos"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Crear contacto</span>
        </button>
      </header>

      {/* Filtros */}
      <div className="space-y-2.5 border-b border-line bg-card px-5 py-3">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b4]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-[#0f1b2d] outline-none transition placeholder:text-[#94a3b4] focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FiltroPill activo={!tagFiltro} onClick={() => setTagFiltro("")}>
            Todos
          </FiltroPill>
          {tags.map((t) => (
            <FiltroPill key={t} activo={tagFiltro === t} onClick={() => setTagFiltro(t)}>
              {t}
            </FiltroPill>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {cargando ? (
          <p className="px-5 py-8 text-sm text-[#94a3b4]">Cargando contactos...</p>
        ) : filtrados.length === 0 ? (
          <EmptyState
            Icon={ContactIcon}
            titulo={contactos.length === 0 ? "Aún no hay contactos" : "Sin resultados"}
            descripcion={
              contactos.length === 0
                ? "Crea un contacto o espera a que llegue un mensaje: la IA guarda la ficha automáticamente."
                : "Ningún contacto coincide con la búsqueda o el filtro."
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtrados.map((c) => {
              const nombreCompleto = [c.nombre, c.apellido].filter(Boolean).join(" ") || "Sin nombre";
              return (
                <li
                  key={c.telefono}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface"
                >
                  <Avatar iniciales={inicialesDe(nombreCompleto)} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0f1b2d]">{nombreCompleto}</p>
                    <p className="truncate text-[12.5px] text-[#94a3b4]">
                      {c.correo || "sin correo"} · {c.telefono}
                    </p>
                    {c.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <TagBadge key={t} tag={t} tags={tags} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => iniciarConversacion(c)}
                    title="Iniciar conversación"
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-brand transition hover:border-brand hover:bg-brand/5"
                  >
                    <MessageSquarePlus size={15} />
                    <span className="hidden sm:inline">Conversar</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modal && (
        <CrearContactoModal
          tags={tags}
          onClose={() => setModal(false)}
          onCreado={() => {
            setModal(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function FiltroPill({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        activo
          ? "rounded-full bg-brand px-3 py-1 text-[12px] font-semibold text-white"
          : "rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-[#5b6b80] transition hover:border-brand hover:text-brand"
      }
    >
      {children}
    </button>
  );
}

function CrearContactoModal({
  tags,
  onClose,
  onCreado,
}: {
  tags: string[];
  onClose: () => void;
  onCreado: () => void;
}) {
  const [form, setForm] = useState({ nombre: "", apellido: "", correo: "", telefono: "", tag: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    setError("");
    const telefono = form.telefono.replace(/\D/g, "");
    if (!form.nombre.trim()) return setError("El nombre es obligatorio.");
    if (telefono.length < 8) return setError("El teléfono debe tener al menos 8 dígitos.");
    setGuardando(true);
    try {
      const r = await fetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono,
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          correo: form.correo.trim(),
          tags: form.tag ? [form.tag] : [],
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "No se pudo guardar.");
        return;
      }
      onCreado();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#0f1b2d]">Nuevo contacto</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94a3b4] hover:bg-surface"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Nombre" value={form.nombre} onChange={(v) => set("nombre", v)} placeholder="María" />
            <Campo label="Apellido" value={form.apellido} onChange={(v) => set("apellido", v)} placeholder="González" />
          </div>
          <Campo label="Correo" value={form.correo} onChange={(v) => set("correo", v)} placeholder="maria@correo.com" type="email" />
          <Campo label="Teléfono" value={form.telefono} onChange={(v) => set("telefono", v)} placeholder="50370000000" type="tel" />
          <div>
            <label className="mb-1 block text-[12.5px] font-semibold text-[#5b6b80]">Etiqueta</label>
            <select
              value={form.tag}
              onChange={(e) => set("tag", e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-[#0f1b2d] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              <option value="">Sin etiqueta</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-[12.5px] font-medium text-[#a32923]">{error}</p>}

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar contacto"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12.5px] font-semibold text-[#5b6b80]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-[#0f1b2d] outline-none transition placeholder:text-[#94a3b4] focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </div>
  );
}
