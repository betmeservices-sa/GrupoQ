"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  Facebook,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenant } from "@/lib/tenants/active";
import { WaRoutingPanel } from "@/components/settings/WaRoutingPanel";

type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "PAUSED" | "DISABLED";

interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
}
interface WaTemplate {
  id?: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: TemplateComponent[];
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-[#2f9e2f] ring-1 ring-[#00c040]/30",
  PENDING: "bg-amber-50 text-amber-700 ring-1 ring-amber-300/50",
  REJECTED: "bg-red-50 text-red-600 ring-1 ring-red-300/50",
  PAUSED: "bg-slate-100 text-slate-600 ring-1 ring-slate-300/50",
  DISABLED: "bg-slate-100 text-slate-600 ring-1 ring-slate-300/50",
};
const STATUS_LABEL: Record<string, string> = {
  APPROVED: "Aprobada",
  PENDING: "En revisión",
  REJECTED: "Rechazada",
  PAUSED: "Pausada",
  DISABLED: "Deshabilitada",
};
const CAT_LABEL: Record<TemplateCategory, string> = {
  UTILITY: "Utilidad",
  MARKETING: "Marketing",
  AUTHENTICATION: "Autenticación",
};

const INPUT =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-[#0f1b2d] outline-none transition focus:border-brand focus:bg-card";

// Índice más alto de {{n}} usado en el texto (mismo criterio que el backend).
function contarVariables(texto: string): number {
  const matches = texto.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  const nums = matches
    .map((m) => parseInt(m.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

function bodyDe(t: WaTemplate): string {
  return t.components.find((c) => c.type === "BODY")?.text ?? "";
}

export default function SettingsPage() {
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [demo, setDemo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  // Formulario
  const [name, setName] = useState("");
  const [categoria, setCategoria] = useState<TemplateCategory>("UTILITY");
  const [idioma, setIdioma] = useState("es");
  const [header, setHeader] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [footer, setFooter] = useState("");
  const [ejemplos, setEjemplos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Resultado del flujo "Conectar Facebook e Instagram" (?meta=... lo pone el
  // callback de OAuth al volver).
  const [metaEstado, setMetaEstado] = useState<string | null>(null);
  const [metaDetalle, setMetaDetalle] = useState<string | null>(null);
  const [metaPermisos, setMetaPermisos] = useState<string | null>(null);
  const [metaPlist, setMetaPlist] = useState<string | null>(null);
  const [metaPerror, setMetaPerror] = useState<string | null>(null);
  const [metaNombres, setMetaNombres] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setMetaEstado(p.get("meta"));
    setMetaDetalle(p.get("paginas") ?? p.get("motivo"));
    setMetaPermisos(p.get("permisos"));
    setMetaPlist(p.get("plist"));
    setMetaPerror(p.get("perror"));
    setMetaNombres(p.get("nombres"));
  }, []);

  // Estado PERMANENTE de la conexión (qué páginas tiene conectadas el tenant),
  // independiente del banner de resultado que solo aparece al volver de Meta.
  const [conexiones, setConexiones] = useState<
    { pageId: string; nombre: string; instagram: boolean }[]
  >([]);
  useEffect(() => {
    fetch("/api/meta/connections", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setConexiones(d.conexiones);
      })
      .catch(() => {});
  }, [metaEstado]);

  const numVars = useMemo(() => contarVariables(cuerpo), [cuerpo]);

  const preview = useMemo(() => {
    let txt = cuerpo;
    for (let i = 1; i <= numVars; i++) {
      const val = ejemplos[i - 1]?.trim() || `ejemplo ${i}`;
      txt = txt.replace(new RegExp(`\\{\\{\\s*${i}\\s*\\}\\}`, "g"), val);
    }
    return txt;
  }, [cuerpo, numVars, ejemplos]);

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true);
    setErrorLista(null);
    try {
      const res = await fetch("/api/whatsapp/templates", { cache: "no-store" });
      const d = await res.json();
      if (d.ok) {
        setTemplates(d.templates);
        setDemo(d.demo);
      } else {
        setErrorLista(d.error ?? "No se pudieron cargar las plantillas.");
      }
    } catch {
      setErrorLista("No se pudieron cargar las plantillas.");
    }
    if (!silencioso) setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Mientras haya plantillas en revisión, refrescamos solos cada 20s para que el
  // cambio a "Aprobada"/"Rechazada" aparezca sin recargar la página.
  const hayPendientes = templates.some((t) => t.status === "PENDING");
  useEffect(() => {
    if (!hayPendientes) return;
    const id = setInterval(() => cargar(true), 20000);
    return () => clearInterval(id);
  }, [hayPendientes]);

  function resetForm() {
    setName("");
    setCategoria("UTILITY");
    setIdioma("es");
    setHeader("");
    setCuerpo("");
    setFooter("");
    setEjemplos([]);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErrorForm(null);
    setExito(null);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          language: idioma,
          category: categoria,
          header: header || undefined,
          body: cuerpo,
          footer: footer || undefined,
          ejemplos: ejemplos.slice(0, numVars),
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErrorForm(d.error ?? "No se pudo crear la plantilla.");
        setEnviando(false);
        return;
      }
      setExito(
        d.demo
          ? "Plantilla creada en modo demo (simulada, no se envió a Meta)."
          : "Plantilla enviada a Meta. Quedará en revisión hasta su aprobación.",
      );
      resetForm();
      await cargar();
    } catch {
      setErrorForm("Error de red al crear la plantilla.");
    }
    setEnviando(false);
  }

  async function eliminar(nombre: string) {
    if (!window.confirm(`¿Eliminar la plantilla "${nombre}"?`)) return;
    const res = await fetch(
      `/api/whatsapp/templates?name=${encodeURIComponent(nombre)}`,
      { method: "DELETE" },
    );
    const d = await res.json();
    if (d.ok) await cargar();
    else window.alert(d.error ?? "No se pudo eliminar.");
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">
          Configuración
        </h1>
        <p className="text-[12.5px] text-[#94a3b4]">
          Conexiones con Meta y plantillas de WhatsApp
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {/* Conexión OAuth con Meta: el botón inicia /api/meta/connect y el
            callback vuelve aquí con ?meta=conectado|demo|error. */}
        <div className="mb-4 rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0f1b2d]">
                <Facebook size={16} className="text-brand" />
                <Instagram size={16} className="text-brand" />
                Conexiones · Facebook e Instagram
              </div>
              <p className="mt-1 max-w-xl text-[12.5px] text-[#5b6b80]">
                Conecta la página de Facebook y la cuenta de Instagram del negocio para
                recibir y responder mensajes, publicar y ver estadísticas desde esta
                bandeja. Se abre la pantalla oficial de Meta para autorizar los permisos.
              </p>
            </div>
            <a
              href="/api/meta/connect"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-105"
            >
              <Facebook size={16} />
              {conexiones.length ? "Reconectar / agregar cuentas" : "Conectar Facebook e Instagram"}
            </a>
          </div>

          {conexiones.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {conexiones.map((c) => (
                <span
                  key={c.pageId}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-[#2f9e2f] ring-1 ring-[#00c040]/30"
                >
                  <CheckCircle2 size={13} />
                  {c.nombre}
                  {c.instagram && (
                    <span className="flex items-center gap-0.5 text-[#94a3b4]">
                      · <Instagram size={11} /> vinculado
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {metaEstado === "conectado" && metaDetalle !== "0" && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-medium text-[#2f9e2f] ring-1 ring-[#00c040]/30">
              <CheckCircle2 size={14} />
              Conexión exitosa: {metaDetalle ?? "0"} página(s) autorizada(s)
              {metaNombres ? ` (${metaNombres})` : ""}
              {metaPermisos ? ` y ${metaPermisos} permiso(s) otorgado(s)` : ""}. Los
              tokens quedaron registrados en el servidor.
            </p>
          )}
          {metaEstado === "conectado" && metaDetalle === "0" && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 ring-1 ring-amber-300/50">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">
                  La autorización funcionó pero no incluyó ninguna página
                </span>{" "}
                ({metaPermisos ?? "0"} permiso(s) otorgado(s)). Meta guardó una selección
                vacía de un intento anterior. Solución: en Facebook ve a Configuración
                &gt; Integraciones comerciales, elimina esta app, y vuelve a presionar
                Conectar; en el diálogo selecciona la(s) página(s) cuando te lo pregunte.
                {metaPlist && (
                  <>
                    <br />
                    <span className="font-semibold">Permisos otorgados:</span>{" "}
                    <code className="break-all rounded bg-amber-100 px-1">{metaPlist}</code>
                  </>
                )}
                {metaPerror && (
                  <>
                    <br />
                    <span className="font-semibold">Error al listar páginas:</span>{" "}
                    <code className="rounded bg-amber-100 px-1">{metaPerror}</code>
                  </>
                )}
              </span>
            </p>
          )}
          {metaEstado === "demo" && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 ring-1 ring-amber-300/50">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>
                <span className="font-semibold">Modo demo.</span> El flujo se simuló porque
                no hay <code className="rounded bg-amber-100 px-1">META_APP_SECRET</code>{" "}
                configurado. Con las credenciales reales, aquí se intercambia el code por
                los tokens del cliente.
              </span>
            </p>
          )}
          {metaEstado === "error" && (
            <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-700 ring-1 ring-red-300/50">
              <AlertCircle size={14} />
              No se pudo completar la conexión
              {metaDetalle ? ` (motivo: ${metaDetalle})` : ""}. Intenta de nuevo.
            </p>
          )}
        </div>

        <WaRoutingPanel />

        {demo && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold">Modo demo.</span> No hay credenciales de Meta
              configuradas (<code className="rounded bg-amber-100 px-1">WHATSAPP_WABA_ID</code>{" "}
              y token con permiso <code className="rounded bg-amber-100 px-1">whatsapp_business_management</code>).
              Las plantillas se simulan localmente y no se envían a Meta.
            </p>
          </div>
        )}

        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px] text-[#5b6b80]">
          <Info size={16} className="mt-0.5 shrink-0 text-brand" />
          <p>
            <span className="font-semibold text-[#0f1b2d]">Cómo funciona:</span> completa el
            formulario y crea la plantilla. Se envía a Meta y queda{" "}
            <span className="font-semibold">En revisión</span>. Cuando Meta la aprueba, el estado
            cambia a <span className="font-semibold text-[#2f9e2f]">Aprobada</span> y recién ahí se
            puede usar para enviar. Esta vista se actualiza sola mientras haya plantillas en revisión.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          {/* Formulario */}
          <form
            onSubmit={crear}
            className="space-y-3.5 rounded-2xl border border-line bg-card p-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[#0f1b2d]">
              <Plus size={16} className="text-brand" />
              Nueva plantilla
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#5b6b80]">
                Nombre
              </label>
              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                }
                placeholder="recordatorio_cita"
                className={INPUT}
                required
              />
              <p className="mt-1 text-[11px] text-[#94a3b4]">
                Solo minúsculas, números y guion bajo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#5b6b80]">
                  Categoría
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as TemplateCategory)}
                  className={INPUT}
                >
                  <option value="UTILITY">Utilidad</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Autenticación</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#5b6b80]">
                  Idioma
                </label>
                <select
                  value={idioma}
                  onChange={(e) => setIdioma(e.target.value)}
                  className={INPUT}
                >
                  <option value="es">Español (es)</option>
                  <option value="es_MX">Español MX (es_MX)</option>
                  <option value="en_US">Inglés US (en_US)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#5b6b80]">
                Encabezado <span className="font-normal text-[#94a3b4]">(opcional)</span>
              </label>
              <input
                value={header}
                onChange={(e) => setHeader(e.target.value)}
                placeholder={activeTenant().brand.nombreCorto}
                className={INPUT}
              />
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#5b6b80]">
                Cuerpo del mensaje
              </label>
              <textarea
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                rows={4}
                placeholder="Hola {{1}}, le recordamos su cita el {{2}}."
                className={cn(INPUT, "resize-y")}
                required
              />
              <p className="mt-1 text-[11px] text-[#94a3b4]">
                Usa <code className="rounded bg-surface px-1">{"{{1}}"}</code>,{" "}
                <code className="rounded bg-surface px-1">{"{{2}}"}</code> para datos variables.
              </p>
            </div>

            {numVars > 0 && (
              <div className="space-y-2 rounded-xl border border-line bg-surface/60 p-2.5">
                <p className="text-[12px] font-semibold text-[#5b6b80]">
                  Valores de ejemplo (los exige Meta)
                </p>
                {Array.from({ length: numVars }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 text-center text-[11px] font-bold text-[#94a3b4]">
                      {`{{${i + 1}}}`}
                    </span>
                    <input
                      value={ejemplos[i] ?? ""}
                      onChange={(e) => {
                        const next = [...ejemplos];
                        next[i] = e.target.value;
                        setEjemplos(next);
                      }}
                      placeholder={`Ejemplo ${i + 1}`}
                      className={cn(INPUT, "py-1.5")}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="mb-1 block text-[12px] font-semibold text-[#5b6b80]">
                Pie de página <span className="font-normal text-[#94a3b4]">(opcional)</span>
              </label>
              <input
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder={activeTenant().brand.nombreCorto}
                className={INPUT}
              />
            </div>

            {cuerpo.trim() && (
              <div className="rounded-xl border border-line bg-surface/60 p-2.5">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b4]">
                  Vista previa
                </p>
                {header.trim() && (
                  <p className="text-[13px] font-bold text-[#0f1b2d]">{header}</p>
                )}
                <p className="whitespace-pre-wrap text-[13px] text-[#0f1b2d]">{preview}</p>
                {footer.trim() && (
                  <p className="mt-1 text-[11px] text-[#94a3b4]">{footer}</p>
                )}
              </div>
            )}

            {errorForm && (
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-red-600">
                <AlertCircle size={14} /> {errorForm}
              </p>
            )}
            {exito && (
              <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#2f9e2f]">
                <CheckCircle2 size={14} /> {exito}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-105 disabled:opacity-60"
            >
              {enviando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Crear plantilla
            </button>
          </form>

          {/* Lista */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#0f1b2d]">
                Plantillas <span className="text-[#94a3b4]">({templates.length})</span>
                {hayPendientes && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-300/50">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    En revisión por Meta · se actualiza solo
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => cargar()}
                disabled={cargando}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[#5b6b80] transition hover:bg-surface disabled:opacity-60"
              >
                <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
                Actualizar
              </button>
            </div>

            {errorLista && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>{errorLista}</p>
              </div>
            )}

            {!cargando && !errorLista && templates.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-card py-10 text-center">
                <FileText size={26} className="text-[#94a3b4]" />
                <p className="text-sm font-semibold text-[#0f1b2d]">Aún no hay plantillas</p>
                <p className="max-w-xs text-[12.5px] text-[#94a3b4]">
                  Crea tu primera plantilla con el formulario de la izquierda.
                </p>
              </div>
            )}

            {templates.map((t) => (
              <div
                key={t.id ?? t.name}
                className="rounded-2xl border border-line bg-card p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-[#0f1b2d]">
                        {t.name}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          STATUS_TONE[t.status] ?? STATUS_TONE.PAUSED,
                        )}
                      >
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#94a3b4]">
                      {CAT_LABEL[t.category] ?? t.category} · {t.language}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => eliminar(t.name)}
                    aria-label={`Eliminar ${t.name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94a3b4] transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface/70 px-3 py-2 text-[12.5px] text-[#5b6b80]">
                  {bodyDe(t)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
