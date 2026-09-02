import { NextResponse } from "next/server";
import {
  fetchConsumoEleven,
  fetchCuotaEleven,
  hayLlaveEleven,
  nombresRelacionados,
} from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

// Endpoint aparte del de llamadas para que la latencia de ElevenLabs no frene
// la carga del dashboard. Queda detras del middleware: exige sesion.
//
// Devuelve dos cosas distintas y conviene no confundirlas:
//   cuota   -> del periodo de facturacion en curso, NO se puede filtrar por
//              fecha porque ElevenLabs entrega un solo numero acumulado.
//   consumo -> del rango que pida el cliente, calculado sobre el historial.
//
// Los limites llegan en unix (segundos) desde el navegador, que es quien sabe
// la zona horaria de quien mira. En Vercel el servidor corre en UTC, asi que
// resolver "hoy" aca daria un dia corrido.
export async function GET(req: Request) {
  if (!hayLlaveEleven()) {
    // Diagnostico: que nombres de variables relacionadas ve el servidor (solo
    // nombres, sin valores). Ayuda a detectar un nombre mal escrito.
    return NextResponse.json({
      configurado: false,
      cuota: null,
      consumo: null,
      nombresVistos: nombresRelacionados(),
    });
  }

  const url = new URL(req.url);
  const aUnix = (v: string | null): number | null => {
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };
  const desde = aUnix(url.searchParams.get("desde"));
  const hasta = aUnix(url.searchParams.get("hasta"));
  // getTimezoneOffset() del navegador. Puede ser negativo, por eso no pasa por
  // aUnix, que exige positivo.
  const offsetCrudo = Number(url.searchParams.get("offset"));
  const offset = Number.isFinite(offsetCrudo) ? Math.trunc(offsetCrudo) : 0;

  try {
    // En paralelo: son dos llamadas independientes y la del historial es la
    // lenta la primera vez (despues pega en cache).
    const [cuota, consumo] = await Promise.all([
      fetchCuotaEleven(),
      fetchConsumoEleven(desde, hasta, offset),
    ]);
    return NextResponse.json({ configurado: true, cuota, consumo });
  } catch (err) {
    return NextResponse.json(
      {
        configurado: true,
        cuota: null,
        consumo: null,
        error: err instanceof Error ? err.message : "Error",
      },
      { status: 200 },
    );
  }
}
