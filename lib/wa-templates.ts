// Gestión de plantillas (message templates) de WhatsApp vía Meta Cloud API.
// Las plantillas son los mensajes pre-aprobados por Meta que se usan para INICIAR
// conversación (fuera de la ventana de 24h). Se crean/listan/borran contra la
// WhatsApp Business Account (WABA), no contra el número.
//
// Costura FAKE/REAL (igual que lib/wa-send.ts): si hay WHATSAPP_ACCESS_TOKEN +
// WHATSAPP_WABA_ID habla con Graph; si no, usa un almacén EN MEMORIA para que la
// demo funcione sin credenciales (las plantillas creadas quedan en "PENDING" y se
// pierden al reiniciar el server). El token necesita permiso
// `whatsapp_business_management` (además del de mensajería).

import type {
  TemplateCategory,
  TemplateStatus,
  TemplateComponent,
  WaTemplate,
} from "./data/types";
import { TENANTS, DEFAULT_TENANT } from "./tenants";
import type { TenantId } from "./tenants/types";

export type { TemplateCategory, TemplateStatus, TemplateComponent, WaTemplate };

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

// Lo que manda el formulario de la plataforma (forma simplificada).
export interface NuevoTemplate {
  name: string;
  language: string;
  category: TemplateCategory;
  header?: string; // texto del encabezado (opcional)
  body: string; // cuerpo, admite variables {{1}}, {{2}}, ...
  footer?: string; // pie de página (opcional)
  ejemplos?: string[]; // valores de ejemplo para {{1}}, {{2}}, ... (los exige Meta)
}

function creds(): { token: string; waba: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const waba = process.env.WHATSAPP_WABA_ID;
  return token && waba ? { token, waba } : null;
}

export function tieneCredsTemplates(): boolean {
  return creds() !== null;
}

// Cuenta cuántas variables {{n}} usa el texto (devuelve el índice más alto).
// Meta exige numeración secuencial 1..N y un ejemplo por cada una.
export function contarVariables(texto: string): number {
  const matches = texto.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  const nums = matches
    .map((m) => parseInt(m.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

// Meta solo permite minúsculas, números y guion bajo en el nombre.
export function nombreValido(name: string): boolean {
  return /^[a-z0-9_]{1,512}$/.test(name);
}

function construirComponents(input: NuevoTemplate): TemplateComponent[] {
  const components: TemplateComponent[] = [];

  const header = input.header?.trim();
  if (header) {
    components.push({ type: "HEADER", format: "TEXT", text: header });
  }

  const body: TemplateComponent = { type: "BODY", text: input.body.trim() };
  const vars = contarVariables(input.body);
  const ejemplos = (input.ejemplos ?? []).map((e) => e.trim());
  if (vars > 0) {
    body.example = { body_text: [ejemplos.slice(0, vars)] };
  }
  components.push(body);

  const footer = input.footer?.trim();
  if (footer) {
    components.push({ type: "FOOTER", text: footer });
  }

  return components;
}

// --- Almacén FAKE por tenant (solo cuando no hay credenciales) ---
// Cada cliente arranca con sus propias plantillas demo (lib/tenants/<t>.waTemplates).
const fakeStores = new Map<TenantId, WaTemplate[]>();

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function storeDe(tenant: TenantId): WaTemplate[] {
  let s = fakeStores.get(tenant);
  if (!s) {
    s = TENANTS[tenant].waTemplates.map(clone);
    fakeStores.set(tenant, s);
  }
  return s;
}

interface GraphTemplate {
  id?: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components?: TemplateComponent[];
}

export async function listarTemplates(
  tenant: TenantId = DEFAULT_TENANT,
): Promise<{
  ok: boolean;
  templates: WaTemplate[];
  demo: boolean;
  error?: string;
}> {
  const c = creds();
  if (!c) return { ok: true, templates: storeDe(tenant), demo: true };

  const url = `${GRAPH}/${c.waba}/message_templates?fields=id,name,status,category,language,components&limit=200`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${c.token}` },
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      (data as { error?: { message?: string } })?.error?.message ??
      `Graph respondió ${res.status}`;
    return { ok: false, templates: [], demo: false, error };
  }
  const rows = ((data as { data?: GraphTemplate[] })?.data ?? []).map(
    (t): WaTemplate => ({
      id: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      components: t.components ?? [],
    }),
  );
  return { ok: true, templates: rows, demo: false };
}

export async function crearTemplate(
  input: NuevoTemplate,
  tenant: TenantId = DEFAULT_TENANT,
): Promise<{
  ok: boolean;
  template?: WaTemplate;
  demo: boolean;
  error?: string;
}> {
  if (!nombreValido(input.name)) {
    return {
      ok: false,
      demo: false,
      error: "El nombre solo admite minúsculas, números y guion bajo.",
    };
  }
  if (!input.body?.trim()) {
    return { ok: false, demo: false, error: "El cuerpo del mensaje es obligatorio." };
  }
  const vars = contarVariables(input.body);
  const ejemplos = (input.ejemplos ?? []).map((e) => e.trim()).filter(Boolean);
  if (vars > 0 && ejemplos.length < vars) {
    return {
      ok: false,
      demo: false,
      error: `Faltan valores de ejemplo: el cuerpo usa ${vars} variable(s).`,
    };
  }

  const components = construirComponents(input);
  const c = creds();

  if (!c) {
    const t: WaTemplate = {
      name: input.name,
      language: input.language,
      category: input.category,
      status: "PENDING",
      components,
    };
    const store = storeDe(tenant);
    fakeStores.set(tenant, [t, ...store.filter((x) => x.name !== t.name)]);
    return { ok: true, template: t, demo: true };
  }

  const res = await fetch(`${GRAPH}/${c.waba}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components,
    }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string; error_user_msg?: string } })?.error;
    return {
      ok: false,
      demo: false,
      error: err?.error_user_msg ?? err?.message ?? `Graph respondió ${res.status}`,
    };
  }
  const created = data as { id?: string; status?: TemplateStatus };
  return {
    ok: true,
    demo: false,
    template: {
      id: created.id,
      name: input.name,
      language: input.language,
      category: input.category,
      status: created.status ?? "PENDING",
      components,
    },
  };
}

export async function eliminarTemplate(
  name: string,
  tenant: TenantId = DEFAULT_TENANT,
): Promise<{
  ok: boolean;
  demo: boolean;
  error?: string;
}> {
  const c = creds();
  if (!c) {
    fakeStores.set(tenant, storeDe(tenant).filter((t) => t.name !== name));
    return { ok: true, demo: true };
  }
  const res = await fetch(
    `${GRAPH}/${c.waba}/message_templates?name=${encodeURIComponent(name)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${c.token}` } },
  );
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      (data as { error?: { message?: string } })?.error?.message ??
      `Graph respondió ${res.status}`;
    return { ok: false, demo: false, error };
  }
  return { ok: true, demo: false };
}
