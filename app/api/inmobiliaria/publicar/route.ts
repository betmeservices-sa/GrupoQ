import { NextResponse } from "next/server";
import { GRAPH } from "@/lib/meta-oauth";
import { conexionesDe } from "@/lib/meta-store";
import { buscarPropiedad, marcarPublicada, registrarPublicacion } from "@/lib/inmobiliaria-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGENES = 10; // el tope del carrusel de Meta
const MAX_BYTES = 4_000_000;

// Publica el anuncio en la página de Facebook que el cliente conectó por OAuth
// (el mismo módulo de Meta que ya usa la bandeja: lib/meta-store + meta-oauth).
//
// Sin conexión de Meta, va en SIMULADO: se registra la publicación del demo y se
// dice con todas las letras que no salió a ninguna red. Nunca se finge que un
// post real ocurrió.
//
// Instagram queda fuera a propósito: su API de publicación exige una URL pública
// de la imagen, y las fotos del alta viven en memoria del proceso, donde Meta no
// puede alcanzarlas. Publicar en IG es subir el arte a un hosting primero, y eso
// es otra pieza, no un parche aquí.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  let body: { id?: string; texto?: string; imagenes?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la publicación." }, { status: 400 });
  }

  const propiedad = buscarPropiedad(body.id ?? "");
  if (!propiedad) {
    return NextResponse.json({ ok: false, error: "Esa propiedad no está en la cartera." }, { status: 404 });
  }
  if (propiedad.estado === "vendida") {
    return NextResponse.json(
      { ok: false, error: `${propiedad.codigo} ya no está disponible. Publicarla trae interesados por algo que no existe.` },
      { status: 409 },
    );
  }

  const texto = (body.texto ?? "").slice(0, 4000).trim();
  const imagenes = (body.imagenes ?? []).slice(0, MAX_IMAGENES);
  if (imagenes.length === 0) {
    return NextResponse.json({ ok: false, error: "No llegó ninguna imagen." }, { status: 400 });
  }

  const piezas: Blob[] = [];
  for (const dataUrl of imagenes) {
    const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) continue;
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length === 0 || bytes.length > MAX_BYTES) continue;
    piezas.push(new Blob([new Uint8Array(bytes)], { type: m[1] }));
  }
  if (piezas.length === 0) {
    return NextResponse.json({ ok: false, error: "Las imágenes no llegaron completas." }, { status: 400 });
  }

  const conexion = (await conexionesDe(tenant))[0];

  // ── Simulado: el cliente todavía no conectó su página ──
  if (!conexion) {
    marcarPublicada(propiedad.id);
    const pub = registrarPublicacion({
      propiedadId: propiedad.id,
      codigo: propiedad.codigo,
      red: "simulada",
      fotos: piezas.length,
    });
    return NextResponse.json({
      ok: true,
      simulado: true,
      publicacion: pub,
      aviso:
        "No hay página de Facebook conectada, así que el anuncio no salió a ninguna red. Quedó armado y listo: se conecta la página en Configuración y se publica de verdad.",
    });
  }

  // ── Real: subir las fotos sin publicar y armar un solo post con todas ──
  try {
    const ids: string[] = [];
    for (const pieza of piezas) {
      const form = new FormData();
      form.append("source", pieza, "anuncio.jpg");
      form.append("published", "false");
      form.append("access_token", conexion.pageToken);
      const r = await fetch(`${GRAPH}/${conexion.pageId}/photos`, { method: "POST", body: form });
      const j = (await r.json()) as { id?: string; error?: { message?: string } };
      if (j.error || !j.id) throw new Error(j.error?.message ?? "Meta no aceptó la foto");
      ids.push(j.id);
    }

    const form = new FormData();
    form.append("message", texto);
    form.append("access_token", conexion.pageToken);
    ids.forEach((id, i) => form.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    const r = await fetch(`${GRAPH}/${conexion.pageId}/feed`, { method: "POST", body: form });
    const j = (await r.json()) as { id?: string; error?: { message?: string } };
    if (j.error || !j.id) throw new Error(j.error?.message ?? "Meta no aceptó la publicación");

    marcarPublicada(propiedad.id);
    const pub = registrarPublicacion({
      propiedadId: propiedad.id,
      codigo: propiedad.codigo,
      red: "facebook",
      fotos: piezas.length,
      enlace: `https://facebook.com/${j.id}`,
    });
    return NextResponse.json({ ok: true, simulado: false, publicacion: pub });
  } catch (e) {
    const detalle = e instanceof Error ? e.message : "error desconocido";
    console.error("[inmobiliaria-publicar]", detalle);
    return NextResponse.json({ ok: false, error: `Facebook no aceptó la publicación: ${detalle}` }, { status: 502 });
  }
}
