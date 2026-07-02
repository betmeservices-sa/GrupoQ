import { departments, staff } from "./data/seed";
import type { DepartmentId } from "./data/types";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

const TZ = "America/El_Salvador";

// Detecta timestamps CON zona (reales): terminan en 'Z' o en un offset como
// '+00:00' / '-06:00'. OJO: Supabase (timestamptz) los devuelve con '+00:00',
// NO con 'Z', por eso antes se mostraba la hora UTC cruda. Los del seed del demo
// vienen sin zona y se muestran tal cual.
function conZona(ts: string): boolean {
  return ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts);
}

function a12h(h: number, m: number): string {
  const ampm = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// "2026-06-26T06:10:00+00:00" -> "12:10 a.m." (hora local de El Salvador).
export function horaDe(ts: string): string {
  if (conZona(ts)) {
    const hhmm = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
    const [h, m] = hhmm.split(":").map(Number);
    return a12h(h, m);
  }
  const [h, m] = ts.slice(11, 16).split(":").map(Number);
  return a12h(h, m);
}

function fechaLocal(ts: string): string {
  if (conZona(ts)) return new Date(ts).toLocaleDateString("en-CA", { timeZone: TZ });
  return ts.slice(0, 10);
}

// Etiqueta corta y relativa para listas: hora si es hoy, "Ayer", o "21 jun".
export function diaRelativo(ts: string): string {
  const fecha = fechaLocal(ts);
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const ayer = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: TZ });
  if (fecha === hoy) return horaDe(ts);
  if (fecha === ayer) return "Ayer";
  const [, mes, dia] = fecha.split("-");
  return `${Number(dia)} ${MESES[Number(mes) - 1]}`;
}

// 8420 -> "8.4k", 121400 -> "121k", 1200000 -> "1.2M"
export function compacto(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 100 ? k.toFixed(1) : Math.round(k)}k`;
  }
  return `${(n / 1_000_000).toFixed(1)}M`;
}

const staffById = new Map(staff.map((s) => [s.id, s]));
const deptById = new Map(departments.map((d) => [d.id, d]));

export function nombreStaff(id?: string): string {
  if (!id) return "Sin asignar";
  return staffById.get(id)?.nombre ?? "Desconocido";
}

export function inicialesStaff(id?: string): string {
  if (!id) return "?";
  return staffById.get(id)?.iniciales ?? "?";
}

export function depto(id: DepartmentId) {
  return deptById.get(id)!;
}

// Metadatos de un miembro del staff para chat interno (nombre, iniciales, color).
export function staffMeta(id: string) {
  const s = staffById.get(id);
  if (!s) return { nombre: "Desconocido", iniciales: "?", color: "#64748b" };
  return {
    nombre: s.nombre,
    iniciales: s.iniciales,
    color: deptById.get(s.departamento)?.color ?? "#64748b",
  };
}
