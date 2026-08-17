// Formato del módulo de cobros. A diferencia de la inmobiliaria, acá el dinero
// SÍ lleva centavos: una cuota es 156.25 y redondearla a 156 en una pantalla de
// cobranza es exactamente el error que hace que el cliente pague de menos.

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function dinero(v: number): string {
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Para totales de columna y KPIs, donde el centavo no cabe ni importa. */
export function dineroCorto(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
  }
  if (v >= 10_000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** "2026-08-21" -> "21 ago". */
export function fechaCorta(iso: string): string {
  const f = iso.slice(0, 10);
  const [, mes, dia] = f.split("-");
  if (!mes || !dia) return iso;
  return `${Number(dia)} ${MESES[Number(mes) - 1] ?? ""}`.trim();
}

/** "2026-08-14T09:41:00Z" -> "14 ago, 9:41 a.m." (hora de El Salvador). */
export function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/El_Salvador",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const h = Number(v("hour"));
  const ampm = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${Number(v("day"))} ${MESES[Number(v("month")) - 1]}, ${h12}:${v("minute")} ${ampm}`;
}

/** 208 -> "3:28". Duración de llamada como la muestra un teléfono. */
export function duracion(seg?: number): string {
  if (!seg || seg <= 0) return "0:00";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Los días para una fecha, dichos como los diría un gestor. */
export function cuandoVence(dias: number | undefined): string {
  if (dias === undefined) return "";
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias > 1) return `en ${dias} días`;
  if (dias === -1) return "venció ayer";
  return `venció hace ${Math.abs(dias)} días`;
}

/** "+50378541209" -> "7854-1209". */
export function telefonoSv(e164: string): string {
  const d = (e164 ?? "").replace(/\D/g, "");
  const local = d.startsWith("503") && d.length === 11 ? d.slice(3) : d;
  return local.length === 8 ? `${local.slice(0, 4)}-${local.slice(4)}` : e164;
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter((p) => p.length > 2);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}
