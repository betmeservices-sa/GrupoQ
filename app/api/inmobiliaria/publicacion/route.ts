import { NextResponse } from "next/server";
import { buscarPropiedad } from "@/lib/inmobiliaria-cartera";
import { armarAnuncio } from "@/lib/inmobiliaria-publicacion";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El anuncio de una propiedad: texto, orden del carrusel y los datos que se
// estampan en la portada. Las fotos NO se generan ni se retocan aquí: solo se
// ordenan las que ya están en la ficha, y la portada se compone encima de la
// primera, del lado del navegador.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Falta la propiedad." }, { status: 400 });
  }

  const propiedad = buscarPropiedad(id);
  if (!propiedad) {
    return NextResponse.json(
      { ok: false, error: "Esa propiedad no está en la cartera." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, propiedad, anuncio: armarAnuncio(propiedad) });
}
