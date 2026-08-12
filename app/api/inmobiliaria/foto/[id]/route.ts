import { leerFoto } from "@/lib/inmobiliaria-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sirve una foto que el agente tomó en el alta. Vive en memoria del proceso
// (ver inmobiliaria-store), así que se va con el reinicio: es una foto de
// demostración, no un archivo del cliente.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(id ?? "")) return new Response("Id inválido", { status: 400 });

  const foto = leerFoto(id);
  if (!foto) return new Response("Esa foto ya no está", { status: 404 });

  return new Response(new Uint8Array(foto.bytes), {
    status: 200,
    headers: {
      "Content-Type": foto.tipoMime,
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
