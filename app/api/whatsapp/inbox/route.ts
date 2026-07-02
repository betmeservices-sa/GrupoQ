import { getSince } from "@/lib/wa-store";

export const dynamic = "force-dynamic";

// Lo que sondea el cliente: mensajes con seq mayor a su cursor.
export async function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");
  const mensajes = await getSince(Number.isFinite(after) ? after : 0);
  return Response.json({ mensajes });
}
