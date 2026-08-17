import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  filtrarCartera,
  hoyEnSv,
  ordenarPorPrioridad,
  resolverDeudor,
  resumirCartera,
} from "@/lib/cobros-cartera";
import { buscarDeudor, guardarDeudor, todosLosDeudores } from "@/lib/cobros-store";
import type {
  Deudor,
  DeudorVista,
  EstadoGestion,
  Gestion,
  ProductoCredito,
  TramoMora,
} from "@/lib/cobros-tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Con 10,000 cuentas, mandar la cartera entera al navegador lo tumba. La lista
// va paginada y SIN historial; el historial completo se pide por ficha.
const POR_PAGINA = 100;
const MAX_POR_PAGINA = 300;

function sinHistorial(d: DeudorVista): Omit<DeudorVista, "gestiones"> & { gestiones: Gestion[] } {
  // Se deja la última gestión: es lo que la fila muestra ("no contestó",
  // "prometió pagar"). El resto del historial se carga al abrir la ficha.
  return { ...d, gestiones: d.ultimaLlamada ? [{ ...d.ultimaLlamada, transcript: undefined }] : [] };
}

export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hoy = hoyEnSv();

  const id = url.searchParams.get("id");
  if (id) {
    const d = buscarDeudor(id);
    if (!d) {
      return NextResponse.json({ ok: false, error: "Esa cuenta no está en la cartera." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deudor: resolverDeudor(d, hoy) });
  }

  const todos = todosLosDeudores();
  const vistas = todos.map((d) => resolverDeudor(d, hoy));

  const filtrados = ordenarPorPrioridad(
    filtrarCartera(vistas, {
      texto: url.searchParams.get("q") ?? undefined,
      tramo: (url.searchParams.get("tramo") as TramoMora | "todos") ?? "todos",
      estado: (url.searchParams.get("estado") as EstadoGestion | "todos") ?? "todos",
      producto: (url.searchParams.get("producto") as ProductoCredito | "todos") ?? "todos",
      riesgo: (url.searchParams.get("riesgo") as "bajo" | "medio" | "alto" | "todos") ?? "todos",
      soloPromesaVencida: url.searchParams.get("vencidas") === "1",
      soloLlamables: url.searchParams.get("llamables") === "1",
    }),
  );

  const limite = Math.min(Number(url.searchParams.get("limite")) || POR_PAGINA, MAX_POR_PAGINA);
  const desde = Math.max(0, Number(url.searchParams.get("desde")) || 0);

  return NextResponse.json({
    ok: true,
    hoy,
    // El resumen se calcula sobre TODA la cartera, no sobre la página: un KPI
    // que cambia al pasar de página no es un KPI.
    resumen: resumirCartera(todos, hoy),
    total: filtrados.length,
    desde,
    deudores: filtrados.slice(desde, desde + limite).map(sinHistorial),
  });
}

interface Parche {
  id?: string;
  estado?: EstadoGestion;
  llamable?: boolean;
  nota?: string;
  promesa?: { monto: number; fecha: string };
  quitarPromesa?: boolean;
}

// Lo que hace un gestor a mano sobre una ficha: dejar una nota, mover el
// estado, tomar una promesa por teléfono o sacar la cuenta de las llamadas.
export async function PATCH(req: Request) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  let body: Parche;
  try {
    body = (await req.json()) as Parche;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la petición." }, { status: 400 });
  }

  const actual = body.id ? buscarDeudor(body.id) : null;
  if (!actual) {
    return NextResponse.json({ ok: false, error: "Esa cuenta no está en la cartera." }, { status: 404 });
  }

  const ahora = new Date().toISOString();
  const gestiones = [...actual.gestiones];

  if (body.nota && body.nota.trim()) {
    gestiones.unshift({
      id: `g${Date.now().toString(36)}`,
      tipo: "nota",
      cuando: ahora,
      autor: "gestor",
      resumen: body.nota.trim().slice(0, 500),
    });
  }

  const promesa = body.quitarPromesa
    ? undefined
    : body.promesa
      ? {
          monto: Number(body.promesa.monto) || 0,
          fecha: body.promesa.fecha,
          registrada: ahora,
          origen: "gestor" as const,
        }
      : actual.promesa;

  const actualizado: Deudor = {
    ...actual,
    estado: body.estado ?? (body.promesa ? "promesa_pago" : actual.estado),
    llamable: body.llamable ?? actual.llamable,
    promesa,
    gestiones: gestiones.slice(0, 80),
    actualizado: ahora,
  };

  guardarDeudor(actualizado);
  return NextResponse.json({ ok: true, deudor: resolverDeudor(actualizado, hoyEnSv()) });
}
