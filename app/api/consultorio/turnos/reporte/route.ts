import { sucursalActual } from "@/lib/consultorio/actual";
import { turnosDe } from "@/lib/consultorio/almacen";
import { EXAMENES } from "@/lib/consultorio/examenes";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El corte del día, para cuadrar con caja.
//
// Sale en CSV y no en pantalla porque el cruce se hace contra lo que caja
// cerró, y eso vive en otro lado: lo que se necesita es poder abrirlo en Excel
// al lado del otro reporte.
//
// Dos detalles que parecen manías y no lo son: el separador es punto y coma,
// que es lo que espera el Excel en español (con coma, todo cae en una sola
// columna), y el archivo lleva BOM, sin el cual los acentos se abren rotos.

const hora = new Intl.DateTimeFormat("es-SV", {
  timeZone: "America/El_Salvador",
  hour: "2-digit",
  minute: "2-digit",
});
const fecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/El_Salvador",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Un campo de CSV: si trae separador, comillas o saltos, va entre comillas. */
function campo(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "consultorio") {
    return new Response("No existe", { status: 404 });
  }
  const sucursal = await sucursalActual();
  const turnos = await turnosDe(sucursal.id);
  const hoy = fecha.format(new Date());

  // Solo lo cobrado: la fila que todavía espera no es parte del corte.
  const facturados = turnos.filter((t) => t.factura);

  const filas = [
    ["Factura", "Fecha", "Hora", "Sucursal", "Turno", "Código", "Paciente", "Teléfono", "Exámenes", "Detalle", "Monto"],
    ...facturados.map((t) => [
      t.factura,
      hoy,
      hora.format(new Date(t.cerrado ?? t.creado)),
      sucursal.nombre,
      t.numero,
      t.codigo,
      t.nombre,
      t.telefono,
      t.hechos.length,
      t.hechos.map((e) => EXAMENES[e]?.nombre ?? e).join(", "),
      (t.monto ?? 0).toFixed(2),
    ]),
    [],
    ["", "", "", "", "", "", "", "", "", "TOTAL", facturados.reduce((n, t) => n + (t.monto ?? 0), 0).toFixed(2)],
  ];

  const csv = "﻿" + filas.map((f) => f.map(campo).join(";")).join("\r\n");
  const nombre = `corte-${sucursal.codigo}-${hoy}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
