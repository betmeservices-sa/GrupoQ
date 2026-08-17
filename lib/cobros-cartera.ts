// Lo que se calcula sobre la cartera de mora: la vista de cada deudor, el
// resumen del portafolio y los filtros de la pantalla.
//
// Todo acá es puro: recibe deudores y una fecha, devuelve datos. Sin red, sin
// almacén, sin Date.now() escondido. Así el resumen se puede probar entero.

import {
  ESTADO_NOMBRE,
  TRAMO_NOMBRE,
  tramoDe,
  type Deudor,
  type DeudorVista,
  type EstadoGestion,
  type ProductoCredito,
  type ResumenCartera,
  type TramoMora,
} from "./cobros-tipos";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Hoy en El Salvador (UTC-6, sin horario de verano), como AAAA-MM-DD. */
export function hoyEnSv(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

/** Días entre dos fechas AAAA-MM-DD (b - a). Negativo = b ya pasó. */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Number.isNaN(ms) ? 0 : Math.round(ms / DIA_MS);
}

export function resolverDeudor(d: Deudor, hoy: string): DeudorVista {
  const llamadas = d.gestiones.filter((g) => g.tipo === "llamada");
  const diasParaPromesa = d.promesa ? diasEntre(hoy, d.promesa.fecha) : undefined;
  return {
    ...d,
    tramo: tramoDe(d.diasMora),
    diasParaPromesa,
    // Una promesa vencida es la que ya pasó de fecha y nadie marcó como cumplida.
    promesaVencida:
      d.promesa !== undefined && d.promesa.cumplida !== true && diasEntre(hoy, d.promesa.fecha) < 0,
    ultimaLlamada: llamadas[0],
    intentos: llamadas.length,
  };
}

const TRAMOS: TramoMora[] = ["al_dia", "1_30", "31_60", "61_90", "90_mas"];
const ESTADOS = Object.keys(ESTADO_NOMBRE) as EstadoGestion[];

export function resumirCartera(deudores: Deudor[], hoy: string): ResumenCartera {
  const porTramo = Object.fromEntries(
    TRAMOS.map((t) => [t, { cuentas: 0, monto: 0 }]),
  ) as ResumenCartera["porTramo"];
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as ResumenCartera["porEstado"];

  let saldoTotal = 0;
  let montoVencido = 0;
  let promesasVigentes = 0;
  let promesasVencidas = 0;
  let montoPrometido = 0;
  let recuperadoMes = 0;
  let contactadosHoy = 0;
  let llamadosHoy = 0;

  const mes = hoy.slice(0, 7);

  for (const d of deudores) {
    const v = resolverDeudor(d, hoy);
    saldoTotal += d.saldoTotal;
    montoVencido += d.montoVencido;
    porTramo[v.tramo].cuentas += 1;
    porTramo[v.tramo].monto += d.montoVencido;
    porEstado[d.estado] += 1;

    if (d.promesa && d.promesa.cumplida !== true) {
      if (v.promesaVencida) promesasVencidas += 1;
      else {
        promesasVigentes += 1;
        montoPrometido += d.promesa.monto;
      }
    }

    for (const g of d.gestiones) {
      const dia = g.cuando.slice(0, 10);
      if (g.tipo === "pago" && dia.startsWith(mes)) {
        // El monto del pago va en el resumen de la gestión; el número real lo
        // guarda el core bancario. Acá se acumula lo que registró el módulo.
        recuperadoMes += montoDeGestion(g.resumen);
      }
      if (g.tipo === "llamada" && dia === hoy) {
        llamadosHoy += 1;
        if (g.resultado && g.resultado !== "no_contesto" && g.resultado !== "numero_equivocado") {
          contactadosHoy += 1;
        }
      }
    }
  }

  return {
    cuentas: deudores.length,
    saldoTotal: redondear(saldoTotal),
    montoVencido: redondear(montoVencido),
    promesasVigentes,
    promesasVencidas,
    montoPrometido: redondear(montoPrometido),
    recuperadoMes: redondear(recuperadoMes),
    porTramo,
    porEstado,
    contactadosHoy,
    tasaContactoPct: llamadosHoy > 0 ? Math.round((contactadosHoy / llamadosHoy) * 100) : 0,
  };
}

// Los pagos se registran con el monto dentro del resumen ("Abonó $150.00").
// Sacarlo con expresión regular es feo pero honesto: no hay core bancario detrás
// del demo y prefiero eso a inventar un campo que nadie llena.
function montoDeGestion(resumen: string): number {
  const m = /\$\s?([\d,]+(?:\.\d{1,2})?)/.exec(resumen);
  return m ? Number(m[1].replace(/,/g, "")) || 0 : 0;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Filtros de la pantalla ──

export interface FiltroCartera {
  texto?: string;
  tramo?: TramoMora | "todos";
  estado?: EstadoGestion | "todos";
  producto?: ProductoCredito | "todos";
  riesgo?: "bajo" | "medio" | "alto" | "todos";
  // Solo cuentas con promesa vencida (lo primero que revisa un supervisor).
  soloPromesaVencida?: boolean;
  soloLlamables?: boolean;
}

export function filtrarCartera(deudores: DeudorVista[], f: FiltroCartera): DeudorVista[] {
  const q = (f.texto ?? "").trim().toLowerCase();
  return deudores.filter((d) => {
    if (f.tramo && f.tramo !== "todos" && d.tramo !== f.tramo) return false;
    if (f.estado && f.estado !== "todos" && d.estado !== f.estado) return false;
    if (f.producto && f.producto !== "todos" && d.producto !== f.producto) return false;
    if (f.riesgo && f.riesgo !== "todos" && d.riesgo !== f.riesgo) return false;
    if (f.soloPromesaVencida && !d.promesaVencida) return false;
    if (f.soloLlamables && !d.llamable) return false;
    if (q) {
      const heno = `${d.nombre} ${d.documento} ${d.telefono} ${d.cuenta} ${d.etiquetas.join(" ")}`;
      if (!heno.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

// Orden de trabajo por defecto: primero lo que se puede recuperar y está por
// romperse (promesa vencida), después por monto vencido. Un gestor con 300
// cuentas necesita que la primera fila sea la que importa.
export function ordenarPorPrioridad(deudores: DeudorVista[]): DeudorVista[] {
  const peso = (d: DeudorVista): number => {
    if (d.promesaVencida) return 0;
    if (d.estado === "sin_gestionar") return 1;
    if (d.estado === "promesa_rota") return 2;
    if (d.estado === "en_gestion") return 3;
    if (d.estado === "negociacion") return 4;
    if (d.estado === "promesa_pago") return 5;
    if (d.estado === "disputa") return 6;
    if (d.estado === "pago_parcial") return 7;
    if (d.estado === "ilocalizable") return 8;
    if (d.estado === "legal") return 9;
    if (d.estado === "no_contactar") return 10;
    return 11; // pagado
  };
  return [...deudores].sort((a, b) => peso(a) - peso(b) || b.montoVencido - a.montoVencido);
}

export const TRAMOS_ORDEN = TRAMOS;
export const NOMBRE_TRAMO = TRAMO_NOMBRE;
