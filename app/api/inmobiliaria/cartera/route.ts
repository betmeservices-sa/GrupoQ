import { NextResponse } from "next/server";
import { propiedadDesdeAlta, siguienteCodigo, validarAlta, type AltaPropiedad } from "@/lib/inmobiliaria-alta";
import { resolverPropiedad } from "@/lib/inmobiliaria-cartera";
import { hoyEnSv } from "@/lib/inmobiliaria-pipeline";
import {
  agregarPropiedad,
  buscarPropiedad,
  cargarCartera,
  guardarFoto,
  todasLasPropiedades,
} from "@/lib/inmobiliaria-store";
import { LEADS } from "@/lib/inmobiliaria-datos";
import { AMBIENTE_NOMBRE, type Ambiente, type Foto } from "@/lib/inmobiliaria-tipos";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La cartera completa, o una ficha suelta con ?id=. Las alertas (publicada sin
// estar disponible, exclusiva vencida) vienen resueltas contra el día de hoy.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const propiedad = buscarPropiedad(id);
    if (!propiedad) {
      return NextResponse.json({ ok: false, error: "Esa propiedad no está en la cartera." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, propiedad });
  }

  return NextResponse.json({ ok: true, cartera: cargarCartera() });
}

interface FotoEntrante {
  dataUrl?: string;
  ambiente?: string;
  ancho?: number;
  alto?: number;
}

// Alta de una propiedad desde el teléfono. Las fotos llegan como data URL (el
// navegador ya las redujo) y se guardan en el almacén del demo, que vive en
// memoria igual que las reservas simuladas del hotel.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  let body: (Omit<Partial<AltaPropiedad>, "fotos"> & { fotos?: FotoEntrante[] }) | null = null;
  try {
    body = (await req.json()) as Omit<Partial<AltaPropiedad>, "fotos"> & { fotos?: FotoEntrante[] };
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió el formulario." }, { status: 400 });
  }

  // Las fotos primero: la validación pide al menos una, y para eso tienen que
  // estar guardadas y con su ruta.
  const fotos: Foto[] = [];
  for (const f of (body.fotos ?? []).slice(0, 12)) {
    const ambiente = (f.ambiente ?? "fachada") as Ambiente;
    if (!(ambiente in AMBIENTE_NOMBRE)) continue;
    const guardada = guardarFoto(f.dataUrl ?? "", Number(f.ancho) || 0, Number(f.alto) || 0);
    if (!guardada) continue;
    fotos.push({
      src: guardada.src,
      ambiente,
      ancho: Number(f.ancho) || 1080,
      alto: Number(f.alto) || 810,
    });
  }

  const alta: Partial<AltaPropiedad> = { ...body, fotos };
  const problemas = validarAlta(alta);
  if (problemas.length > 0) {
    return NextResponse.json({ ok: false, problemas }, { status: 400 });
  }

  const codigo = siguienteCodigo(todasLasPropiedades().map((p) => p.codigo));
  const semilla = propiedadDesdeAlta(alta as AltaPropiedad, {
    id: `n${Date.now().toString(36)}`,
    codigo,
  });
  agregarPropiedad(semilla);

  return NextResponse.json({
    ok: true,
    propiedad: resolverPropiedad(semilla, hoyEnSv(), LEADS),
  });
}
