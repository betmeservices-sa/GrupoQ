// Llamadas a los webhooks de n8n para citas. La URL base se configura con
// N8N_WEBHOOK_BASE (ej. https://xxx.app.n8n.cloud/webhook). El workflow de n8n
// debe estar ACTIVO para que respondan los webhooks de producción.

const BASE = process.env.N8N_WEBHOOK_BASE;

async function llamar(
  path: string,
  body: unknown,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (!BASE) return { ok: false, error: "N8N_WEBHOOK_BASE no configurado" };
  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `n8n respondió ${res.status}` };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error de red" };
  }
}

export interface InputDisponibilidad {
  especialidad?: string;
  sucursal?: string;
  fecha_preferida?: string;
  rango_dias?: number;
  nombre?: string;
  telefono?: string;
}

export interface InputConfirmar {
  nombre?: string;
  telefono?: string;
  especialidad?: string;
  sucursal?: string;
  fecha?: string;
  hora?: string;
  medico?: string;
  notas?: string;
}

export function consultarDisponibilidad(input: InputDisponibilidad) {
  return llamar("cita-disponibilidad", { canal: "whatsapp", rango_dias: 7, ...input });
}

export function confirmarCita(input: InputConfirmar) {
  return llamar("cita-confirmar", input);
}
