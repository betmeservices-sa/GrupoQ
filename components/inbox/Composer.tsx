"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  Clock,
  Loader2,
  Paperclip,
  SendHorizonal,
  FileText,
  X,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface TplComp {
  type: string;
  text?: string;
}
interface Tpl {
  name: string;
  language: string;
  status: string;
  category?: string;
  components: TplComp[];
}

export interface EnvioPlantilla {
  name: string;
  language: string;
  variables: string[];
  texto: string;
}

function compTexto(t: Tpl, tipo: string): string {
  return t.components.find((c) => c.type === tipo)?.text ?? "";
}
function numVars(texto: string): number {
  const ms = texto.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  const ns = ms.map((m) => parseInt(m.replace(/\D/g, ""), 10)).filter((n) => !Number.isNaN(n));
  return ns.length ? Math.max(...ns) : 0;
}
function render(texto: string, valores: string[]): string {
  let out = texto;
  for (let i = 1; i <= valores.length; i++) {
    out = out.replace(new RegExp(`\\{\\{\\s*${i}\\s*\\}\\}`, "g"), valores[i - 1]?.trim() || `{{${i}}}`);
  }
  return out;
}

export function Composer({
  onSend,
  onTyping,
  onAttach,
  onSendTemplate,
  ventanaCerrada,
  placeholder = "Escribe una respuesta...",
}: {
  onSend: (texto: string) => void | Promise<void>;
  onTyping?: () => void;
  onAttach?: (file: File) => void | Promise<void>;
  onSendTemplate?: (t: EnvioPlantilla) => void | Promise<void>;
  ventanaCerrada?: boolean;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [adjuntando, setAdjuntando] = useState(false);
  const ultimoTyping = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- Selector de plantillas ---
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [cargandoTpls, setCargandoTpls] = useState(false);
  const [sel, setSel] = useState<Tpl | null>(null);
  const [vars, setVars] = useState<string[]>([]);
  const [enviandoTpl, setEnviandoTpl] = useState(false);
  const [errTpl, setErrTpl] = useState<string | null>(null);

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setTexto(e.target.value);
    if (e.target.value.trim() && onTyping) {
      const ahora = Date.now();
      if (ahora - ultimoTyping.current > 10000) {
        ultimoTyping.current = ahora;
        onTyping();
      }
    }
  }

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    try {
      await onSend(limpio);
      setTexto("");
    } catch {
      // deja el texto para reintentar
    } finally {
      setEnviando(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || adjuntando || !onAttach) return;
    setAdjuntando(true);
    try {
      await onAttach(file);
    } catch {
      // no romper
    } finally {
      setAdjuntando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function abrirPicker() {
    setPickerOpen(true);
    setSel(null);
    setErrTpl(null);
    setCargandoTpls(true);
    try {
      const r = await fetch("/api/whatsapp/templates", { cache: "no-store" });
      const d = await r.json();
      setTpls(d.ok ? (d.templates as Tpl[]).filter((t) => t.status === "APPROVED") : []);
    } catch {
      setTpls([]);
    }
    setCargandoTpls(false);
  }

  function elegir(t: Tpl) {
    setSel(t);
    setVars(Array(numVars(compTexto(t, "BODY"))).fill(""));
    setErrTpl(null);
  }

  async function enviarTpl() {
    if (!sel || !onSendTemplate) return;
    const body = compTexto(sel, "BODY");
    const n = numVars(body);
    if (vars.slice(0, n).some((v) => !v.trim())) {
      setErrTpl("Completa todos los datos.");
      return;
    }
    setEnviandoTpl(true);
    setErrTpl(null);
    try {
      await onSendTemplate({
        name: sel.name,
        language: sel.language,
        variables: vars.slice(0, n).map((v) => v.trim()),
        texto: render(body, vars),
      });
      setPickerOpen(false);
      setSel(null);
      setVars([]);
    } catch (e) {
      setErrTpl(e instanceof Error ? e.message : "Fallo el envío.");
    }
    setEnviandoTpl(false);
  }

  return (
    <div className="relative border-t border-line bg-card">
      {/* Popover del selector de plantillas */}
      {pickerOpen && onSendTemplate && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} aria-hidden />
          <div className="absolute bottom-full left-3 z-50 mb-2 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#0f1b2d]">
                {sel ? (
                  <button
                    type="button"
                    onClick={() => setSel(null)}
                    className="flex items-center gap-1 text-[#5b6b80] hover:text-brand"
                  >
                    <ChevronLeft size={15} /> {sel.name}
                  </button>
                ) : (
                  <>
                    <FileText size={15} className="text-brand" /> Plantillas aprobadas
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                aria-label="Cerrar"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#94a3b4] hover:bg-surface"
              >
                <X size={15} />
              </button>
            </div>

            {cargandoTpls ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-[#94a3b4]">
                <Loader2 size={15} className="animate-spin" /> Cargando…
              </div>
            ) : sel ? (
              // Detalle: variables + preview
              <div className="space-y-2.5">
                {numVars(compTexto(sel, "BODY")) > 0 &&
                  Array.from({ length: numVars(compTexto(sel, "BODY")) }).map((_, i) => (
                    <input
                      key={i}
                      value={vars[i] ?? ""}
                      onChange={(e) => {
                        const next = [...vars];
                        next[i] = e.target.value;
                        setVars(next);
                      }}
                      placeholder={`Dato ${i + 1}`}
                      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-[#0f1b2d] outline-none focus:border-brand focus:bg-card"
                    />
                  ))}
                <div className="rounded-lg border border-line bg-surface/60 p-2.5">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#94a3b4]">
                    Vista previa
                  </p>
                  {compTexto(sel, "HEADER") && (
                    <p className="text-[13px] font-bold text-[#0f1b2d]">{compTexto(sel, "HEADER")}</p>
                  )}
                  <p className="whitespace-pre-wrap text-[13px] text-[#0f1b2d]">
                    {render(compTexto(sel, "BODY"), vars)}
                  </p>
                  {compTexto(sel, "FOOTER") && (
                    <p className="mt-1 text-[11px] text-[#94a3b4]">{compTexto(sel, "FOOTER")}</p>
                  )}
                </div>
                {errTpl && <p className="text-[12px] font-medium text-red-600">{errTpl}</p>}
                <button
                  type="button"
                  onClick={enviarTpl}
                  disabled={enviandoTpl}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {enviandoTpl ? <Loader2 size={15} className="animate-spin" /> : <SendHorizonal size={15} />}
                  Enviar plantilla
                </button>
              </div>
            ) : tpls.length === 0 ? (
              <div className="px-2 py-5 text-center text-[12.5px] text-[#94a3b4]">
                No hay plantillas aprobadas todavía. Crea y espera la aprobación de Meta en{" "}
                <span className="font-semibold text-[#5b6b80]">Configuración</span>.
              </div>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {tpls.map((t) => (
                  <button
                    key={t.name + t.language}
                    type="button"
                    onClick={() => elegir(t)}
                    className="w-full rounded-lg border border-line bg-surface/50 px-3 py-2 text-left transition hover:border-brand hover:bg-surface"
                  >
                    <p className="text-[12.5px] font-bold text-[#0f1b2d]">{t.name}</p>
                    <p className="line-clamp-2 text-[11.5px] text-[#5b6b80]">{compTexto(t, "BODY")}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {ventanaCerrada && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[11.5px] font-medium text-amber-700">
          <Clock size={13} className="shrink-0" />
          Ventana de 24h cerrada: el texto libre fallara, usa una plantilla aprobada.
        </div>
      )}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Boton de adjuntar */}
        {onAttach && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={adjuntando}
              aria-label="Adjuntar archivo"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-[#5b6b80] transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
            >
              {adjuntando ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
            </button>
          </>
        )}

        {/* Boton de plantillas (solo WhatsApp) */}
        {onSendTemplate && (
          <button
            type="button"
            onClick={() => (pickerOpen ? setPickerOpen(false) : abrirPicker())}
            aria-label="Enviar plantilla"
            title="Enviar plantilla"
            className={cn(
              "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition",
              pickerOpen
                ? "border-brand bg-brand/10 text-brand"
                : "border-line bg-surface text-[#5b6b80] hover:border-brand hover:text-brand",
            )}
          >
            <FileText size={18} />
          </button>
        )}

        <textarea
          value={texto}
          onChange={onChange}
          onKeyDown={onKey}
          rows={1}
          placeholder={placeholder}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-[#0f1b2d] outline-none transition placeholder:text-[#94a3b4] focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={!texto.trim() || enviando}
          aria-label="Enviar"
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizonal size={18} />
        </button>
      </div>
    </div>
  );
}
