import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { deudorDesdeFila, importarCsv, MAX_FILAS, plantillaCsv } from "@/lib/cobros-csv";
import { agregarDeudores } from "@/lib/cobros-store";
import type { Deudor } from "@/lib/cobros-tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 20,000 filas de CSV de cobranza andan por los 3 MB. El tope es generoso a
// propósito: el error de "archivo muy grande" tiene que salir por el conteo de
// filas, con su explicación, y no por un 413 crudo del runtime.
const MAX_BYTES = 8_000_000;

/** Devuelve la plantilla de ejemplo, para que nadie adivine el formato. */
export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  return new Response(plantillaCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="plantilla-cobros.csv"',
    },
  });
}

interface Cuerpo {
  csv?: string;
  archivo?: string;
  // false (por defecto) = solo vista previa; true = crear las fichas.
  crear?: boolean;
}

/**
 * Lee el archivo de deudores. Por defecto SOLO devuelve la vista previa: qué
 * columnas reconoció, cuántas filas entran, cuántas rechazó y por qué. Nada se
 * guarda hasta que el usuario confirma con crear:true, porque una importación
 * mal mapeada que se guarda sola es una cartera contaminada.
 */
export async function POST(req: Request) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  let body: Cuerpo;
  try {
    body = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la petición." }, { status: 400 });
  }

  const csv = body.csv ?? "";
  if (!csv.trim()) {
    return NextResponse.json({ ok: false, error: "El archivo llegó vacío." }, { status: 400 });
  }
  if (csv.length > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `El archivo pesa más de lo que admite el demo. El tope es de ${MAX_FILAS.toLocaleString("en-US")} contactos.`,
      },
      { status: 413 },
    );
  }

  const resultado = importarCsv(csv);

  if (resultado.filas.length === 0) {
    return NextResponse.json({
      ok: false,
      error:
        resultado.rechazadas.length > 0
          ? "Ninguna fila del archivo trae un número marcable. Revisá la columna de teléfono."
          : "El archivo no trae filas de datos.",
      resultado: { ...resultado, filas: [] },
    });
  }

  if (!body.crear) {
    return NextResponse.json({
      ok: true,
      guardado: false,
      resumen: {
        total: resultado.total,
        aceptadas: resultado.filas.length,
        rechazadas: resultado.rechazadas.length,
        duplicadas: resultado.duplicadas,
        columnas: resultado.columnas,
        columnasIgnoradas: resultado.columnasIgnoradas,
      },
      // Muestra corta: la vista previa no necesita las 10,000 filas.
      muestra: resultado.filas.slice(0, 8),
      rechazadas: resultado.rechazadas.slice(0, 20),
    });
  }

  const ahora = new Date().toISOString();
  const sello = Date.now().toString(36);
  const nuevos: Deudor[] = resultado.filas.map((f, i) =>
    deudorDesdeFila(f, `imp${sello}${i}`, ahora),
  );
  const creados = agregarDeudores(nuevos);

  return NextResponse.json({
    ok: true,
    guardado: true,
    archivo: body.archivo ?? null,
    resumen: {
      total: resultado.total,
      aceptadas: resultado.filas.length,
      creadas: creados.length,
      rechazadas: resultado.rechazadas.length,
      duplicadas: resultado.duplicadas,
      columnasIgnoradas: resultado.columnasIgnoradas,
    },
    // Los ids sirven para armar la campaña de una vez con lo recién importado.
    ids: creados.map((d) => d.id),
    rechazadas: resultado.rechazadas.slice(0, 20),
  });
}
