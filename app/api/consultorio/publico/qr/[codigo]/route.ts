import QRCode from "qrcode";
import { doctorPorCodigo, sucursalPorCodigo } from "@/lib/consultorio/almacen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El QR de un doctor o de una sucursal, como PNG.
//
// Lo que va adentro es la URL completa de la página que abre el paciente,
// armada con el host de la petición: el mismo código sirve en localhost y en el
// dominio de verdad sin tocar nada. Si se guardara la URL fija, el QR impreso
// apuntaría al servidor de desarrollo para siempre.
export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  // El mismo endpoint sirve los dos QR: el del doctor lleva a su registro y el
  // de la sucursal lleva a la fila. Se distinguen por el código y no por la
  // ruta, así que quien imprime la hoja no tiene que saber cuál es cuál.
  const doctor = doctorPorCodigo(codigo);
  const sucursal = doctor ? null : sucursalPorCodigo(codigo);
  const suyo = doctor ?? sucursal;
  if (!suyo) return new Response("No existe ese código", { status: 404 });
  const camino = doctor ? "r" : "s";

  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const destino = `${proto}://${host}/${camino}/${suyo.codigo}`;

  const png = await QRCode.toBuffer(destino, {
    width: 1024,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="qr-${suyo.codigo}.png"`,
    },
  });
}
