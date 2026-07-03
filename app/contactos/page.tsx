"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Contact as ContactIcon,
  Download,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  Plus,
  Search,
  StickyNote,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenant, activeTenantId } from "@/lib/tenants/active";
import { telefonoBonito } from "@/lib/phone";
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

const TAG_COLORS = ["#0067f8", "#4ac12f", "#f5a623", "#9b51e0", "#e84d8a", "#00b8d4", "#a32923"];
function colorTag(tag: string, tags: string[]) {
  const i = tags.indexOf(tag);
  return TAG_COLORS[(i >= 0 ? i : 0) % TAG_COLORS.length];
}

function TagBadge({ tag, tags, onRemove }: { tag: string; tags: string[]; onRemove?: () => void }) {
  const color = colorTag(tag, tags);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {tag}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${tag}`} className="ml-0.5 opacity-60 hover:opacity-100">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

function nombreDe(c: ContactoDTO) {
  return [c.nombre, c.apellido].filter(Boolean).join(" ") || "Sin nombre";
}

// --- CSV: serializar y parsear (maneja comillas, comas y saltos de línea) ---
function aCSV(contactos: ContactoDTO[]): string {
  const cols = ["Nombre", "Apellido", "Correo", "Telefono", "Etiquetas"];
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const filas = contactos.map((c) =>
    [c.nombre, c.apellido, c.correo, c.telefono, c.tags.join("|")].map(esc).join(","),
  );
  // BOM para que Excel abra los acentos bien.
  return "﻿" + [cols.map(esc).join(","), ...filas].join("\r\n");
}

function parseCSV(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (enComillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += ch;
    } else if (ch === '"') {
      enComillas = true;
    } else if (ch === ",") {
      fila.push(campo);
      campo = "";
    } else if (ch === "\n" || ch === "\r") {
      if (campo !== "" || fila.length) {
        fila.push(campo);
        filas.push(fila);
        fila = [];
        campo = "";
      }
      if (ch === "\r" && texto[i + 1] === "\n") i++;
    } else campo += ch;
  }
  if (campo !== "" || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((r) => r.some((c) => c.trim() !== ""));
}

export default function ContactosPage() {
  const router = useRouter();
  const tags = activeTenant().tags;
  const [contactos, setContactos] = useState<ContactoDTO[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [tagFiltro, setTagFiltro] = useState("");
  const [activoTel, setActivoTel] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { modo: "crear" } | { modo: "editar"; contacto: ContactoDTO }>(null);
  const [aviso, setAviso] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function cargar(seleccionar?: string) {
    setCargando(true);
    try {
      const r = await fetch("/api/contactos");
      const d = await r.json();
      if (d.ok) {
        setContactos(d.contactos as ContactoDTO[]);
        if (seleccionar) setActivoTel(seleccionar);
      }
    } catch {
      // silencioso
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  // Guarda un cambio parcial (tags o notas) desde la ficha; optimista + persiste.
  async function guardarParcial(telefono: string, patch: Partial<ContactoDTO>) {
    setContactos((prev) => prev.map((c) => (c.telefono === telefono ? { ...c, ...patch } : c)));
    try {
      await fetch("/api/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, ...patch }),
      });
    } catch {
      // el dato ya está en el estado local
    }
  }

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contactos.filter((c) => {
      const okTag = !tagFiltro || c.tags.includes(tagFiltro);
      const okQ =
        !term || [c.nombre, c.apellido, c.correo, c.telefono].join(" ").toLowerCase().includes(term);
      return okTag && okQ;
    });
  }, [contactos, q, tagFiltro]);

  const activo = contactos.find((c) => c.telefono === activoTel) ?? null;

  function iniciarConversacion(c: ContactoDTO) {
    sessionStorage.setItem("ccg.iniciarConv", JSON.stringify({ telefono: c.telefono, nombre: nombreDe(c) }));
    router.push("/");
  }

  function exportar() {
    const blob = new Blob([aCSV(contactos)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contactos-${activeTenantId()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importar(file: File) {
    const filas = parseCSV(await file.text());
    if (filas.length < 2) {
      setAviso("El archivo no tiene filas para importar.");
      return;
    }
    const head = filas[0].map((h) => h.toLowerCase().trim());
    const col = (...claves: string[]) => head.findIndex((h) => claves.some((k) => h.includes(k)));
    const iNombre = col("nombre");
    const iApellido = col("apellido");
    const iCorreo = col("correo", "email", "mail");
    const iTel = col("tel", "phone", "cel", "número", "numero");
    const iTags = col("etiqueta", "tag");

    let ok = 0;
    for (const fila of filas.slice(1)) {
      const telefono = (iTel >= 0 ? fila[iTel] ?? "" : "").replace(/\D/g, "");
      if (telefono.length < 8) continue;
      const cuerpo = {
        telefono,
        nombre: iNombre >= 0 ? (fila[iNombre] ?? "").trim() : "",
        apellido: iApellido >= 0 ? (fila[iApellido] ?? "").trim() : "",
        correo: iCorreo >= 0 ? (fila[iCorreo] ?? "").trim() : "",
        tags:
          iTags >= 0 && fila[iTags]
            ? fila[iTags].split(/[|;,]/).map((t) => t.trim()).filter(Boolean)
            : [],
      };
      try {
        const r = await fetch("/api/contactos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        });
        if ((await r.json()).ok) ok++;
      } catch {
        // sigue con el resto
      }
    }
    setAviso(`${ok} contacto${ok === 1 ? "" : "s"} importado${ok === 1 ? "" : "s"}.`);
    await cargar();
  }

  return (
    <div className="flex h-full min-h-0 flex-1">
      {/* Columna 1: lista */}
      <section
        className={cn(
          "shrink-0 flex-col border-r border-line bg-card lg:flex lg:w-[360px]",
          activo ? "hidden" : "flex w-full",
        )}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Contactos</h1>
            <p className="text-[12.5px] text-[#94a3b4]">
              {contactos.length} {contactos.length === 1 ? "contacto" : "contactos"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn title="Importar CSV" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
            </IconBtn>
            <IconBtn title="Exportar CSV" onClick={exportar}>
              <Download size={16} />
            </IconBtn>
            <button
              type="button"
              onClick={() => setModal({ modo: "crear" })}
              className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Crear</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importar(f);
              e.target.value = "";
            }}
          />
        </header>

        {aviso && (
          <div className="flex items-center justify-between gap-2 border-b border-line bg-brand/5 px-4 py-2 text-[12.5px] font-medium text-brand">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso("")} aria-label="Cerrar aviso">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="space-y-2.5 border-b border-line px-4 py-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b4]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nombre, correo o teléfono"
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cargando ? (
            <p className="px-5 py-8 text-sm text-[#94a3b4]">Cargando contactos...</p>
          ) : filtrados.length === 0 ? (
            <EmptyState
              Icon={ContactIcon}
              titulo={contactos.length === 0 ? "Aún no hay contactos" : "Sin resultados"}
              descripcion={
                contactos.length === 0
                  ? "Crea o importa contactos, o espera a que llegue un mensaje: la IA guarda la ficha automáticamente."
                  : "Ningún contacto coincide con la búsqueda o el filtro."
              }
            />
          ) : (
            <ul>
              {filtrados.map((c) => {
                const sel = c.telefono === activoTel;
                return (
                  <li key={c.telefono}>
                    <button
                      type="button"
                      onClick={() => setActivoTel(c.telefono)}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition",
                        sel ? "bg-brand/5" : "hover:bg-surface",
                      )}
                    >
                      <Avatar iniciales={inicialesDe(nombreDe(c))} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#0f1b2d]">{nombreDe(c)}</p>
                        <p className="truncate text-[12px] text-[#94a3b4]">{telefonoBonito(c.telefono)}</p>
                        {c.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.tags.slice(0, 2).map((t) => (
                              <TagBadge key={t} tag={t} tags={tags} />
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Columna 2: ficha */}
      <section className={cn("min-w-0 flex-1 flex-col bg-surface", activo ? "flex" : "hidden lg:flex")}>
        {activo ? (
          <Ficha
            key={activo.telefono}
            contacto={activo}
            tags={tags}
            onBack={() => setActivoTel(null)}
            onConversar={() => iniciarConversacion(activo)}
            onEditar={() => setModal({ modo: "editar", contacto: activo })}
            onGuardarParcial={(patch) => guardarParcial(activo.telefono, patch)}
          />
        ) : (
          <EmptyState
            Icon={ContactIcon}
            titulo="Selecciona un contacto"
            descripcion="Elige un contacto de la lista para ver su ficha, editar sus etiquetas y notas, o iniciar una conversación."
          />
        )}
      </section>

      {modal && (
        <ContactoModal
          tags={tags}
          inicial={modal.modo === "editar" ? modal.contacto : undefined}
          onClose={() => setModal(null)}
          onGuardado={(tel) => {
            setModal(null);
            cargar(tel);
          }}
        />
      )}
    </div>
  );
}

function Ficha({
  contacto,
  tags,
  onBack,
  onConversar,
  onEditar,
  onGuardarParcial,
}: {
  contacto: ContactoDTO;
  tags: string[];
  onBack: () => void;
  onConversar: () => void;
  onEditar: () => void;
  onGuardarParcial: (patch: Partial<ContactoDTO>) => void;
}) {
  const [nota, setNota] = useState(contacto.notas ?? "");
  const [pickerTags, setPickerTags] = useState(false);
  const disponibles = tags.filter((t) => !contacto.tags.includes(t));
  const notaSucia = nota.trim() !== (contacto.notas ?? "").trim();

  return (
    <div className="flex h-full flex-col">
      {/* Acciones */}
      <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-2.5 lg:justify-end">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-[#5b6b80] hover:bg-surface lg:hidden"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 lg:hidden" />
        <button
          type="button"
          onClick={onEditar}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-[#5b6b80] transition hover:border-brand hover:text-brand"
        >
          <Pencil size={15} />
          Editar
        </button>
        <button
          type="button"
          onClick={onConversar}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-brand-dark"
        >
          <MessageSquarePlus size={15} />
          Conversar
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Encabezado */}
        <div className="flex flex-col items-center gap-3 border-b border-line bg-card px-6 py-7 text-center">
          <Avatar iniciales={inicialesDe(nombreDe(contacto))} size={72} />
          <h2 className="text-lg font-bold text-[#0f1b2d]">{nombreDe(contacto)}</h2>
        </div>

        <div className="mx-auto max-w-lg space-y-5 px-5 py-6">
          {/* Información */}
          <Seccion titulo="Información">
            <DatoFila Icon={Phone} label="Teléfono" valor={telefonoBonito(contacto.telefono)} />
            <DatoFila Icon={Mail} label="Correo" valor={contacto.correo || "Sin correo"} />
          </Seccion>

          {/* Etiquetas editables */}
          <Seccion titulo="Etiquetas">
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              {contacto.tags.length === 0 && !pickerTags && (
                <span className="text-[12.5px] text-[#94a3b4]">Sin etiquetas.</span>
              )}
              {contacto.tags.map((t) => (
                <TagBadge
                  key={t}
                  tag={t}
                  tags={tags}
                  onRemove={() => onGuardarParcial({ tags: contacto.tags.filter((x) => x !== t) })}
                />
              ))}
              {disponibles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPickerTags((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-semibold text-[#5b6b80] transition hover:border-brand hover:text-brand"
                >
                  <Plus size={12} /> Etiqueta
                </button>
              )}
            </div>
            {pickerTags && disponibles.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 px-1">
                {disponibles.map((t) => {
                  const color = colorTag(t, tags);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        onGuardarParcial({ tags: [...contacto.tags, t] });
                        setPickerTags(false);
                      }}
                      className="rounded-full px-2.5 py-1 text-[12px] font-semibold transition"
                      style={{ color, backgroundColor: `${color}14` }}
                    >
                      + {t}
                    </button>
                  );
                })}
              </div>
            )}
          </Seccion>

          {/* Notas */}
          <Seccion titulo="Notas">
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Agrega notas internas sobre este contacto (preferencias, seguimiento, etc.)"
              rows={4}
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-[#0f1b2d] outline-none transition placeholder:text-[#94a3b4] focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            {notaSucia && (
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNota(contacto.notas ?? "")}
                  className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[#5b6b80] transition hover:bg-surface"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => onGuardarParcial({ notas: nota.trim() })}
                  className="rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-brand-dark"
                >
                  Guardar nota
                </button>
              </div>
            )}
          </Seccion>
        </div>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-[#94a3b4]">{titulo}</p>
      <div className="rounded-xl border border-line bg-card p-2.5">{children}</div>
    </div>
  );
}

function DatoFila({ Icon, label, valor }: { Icon: typeof Phone; label: string; valor: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-2">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-[#5b6b80]">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b4]">{label}</p>
        <p className="break-words text-sm font-medium text-[#0f1b2d]">{valor}</p>
      </div>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-[#5b6b80] transition hover:border-brand hover:text-brand"
    >
      {children}
    </button>
  );
}

function FiltroPill({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        activo
          ? "rounded-full bg-brand px-2.5 py-1 text-[12px] font-semibold text-white"
          : "rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-[#5b6b80] transition hover:border-brand hover:text-brand"
      }
    >
      {children}
    </button>
  );
}

function ContactoModal({
  tags,
  inicial,
  onClose,
  onGuardado,
}: {
  tags: string[];
  inicial?: ContactoDTO;
  onClose: () => void;
  onGuardado: (telefono: string) => void;
}) {
  const editando = !!inicial;
  const [form, setForm] = useState({
    nombre: inicial?.nombre ?? "",
    apellido: inicial?.apellido ?? "",
    correo: inicial?.correo ?? "",
    telefono: inicial?.telefono ?? "",
  });
  const [tagsSel, setTagsSel] = useState<string[]>(inicial?.tags ?? []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function toggleTag(t: string) {
    setTagsSel((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
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
          tags: tagsSel,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "No se pudo guardar.");
        return;
      }
      onGuardado(telefono);
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
          <h2 className="text-base font-bold text-[#0f1b2d]">
            {editando ? "Editar contacto" : "Nuevo contacto"}
          </h2>
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
          <Campo
            label="Teléfono"
            value={editando ? telefonoBonito(form.telefono) : form.telefono}
            onChange={(v) => set("telefono", v)}
            placeholder="7002-0001"
            type="tel"
            disabled={editando}
            hint={editando ? "El teléfono identifica al contacto y no se cambia." : undefined}
          />
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[#5b6b80]">Etiquetas</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = tagsSel.includes(t);
                const color = colorTag(t, tags);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className="rounded-full px-2.5 py-1 text-[12px] font-semibold transition"
                    style={on ? { color: "#fff", backgroundColor: color } : { color, backgroundColor: `${color}14` }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-[12.5px] font-medium text-[#a32923]">{error}</p>}

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Guardar contacto"}
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
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12.5px] font-semibold text-[#5b6b80]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-[#0f1b2d] outline-none transition placeholder:text-[#94a3b4] focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {hint && <p className="mt-1 text-[11px] text-[#94a3b4]">{hint}</p>}
    </div>
  );
}
