import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe } from "@/lib/meta-store";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Los últimos avisos de Meta, tal cual llegaron, de las páginas de este cliente.
//
// Existe porque el crudo se guarda en la base (meta_webhook_eventos) pero desde
// afuera no había cómo leerlo sin abrir la base, y los logs de Vercel duran
// medio minuto. Con esto, cuando algo llega con una forma nueva (una respuesta
// a historia de Facebook, por ejemplo) se ve el JSON exacto en segundos.
//
// La tabla es de todos: se filtra por las páginas e Instagram del cliente que
// pregunta. Lo que no sea suyo no se le muestra.

interface Fila {
  id: number;
  recibido: string;
  objeto: string | null;
  cuerpo: { entry?: { id?: string }[] } | null;
}

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const n = Math.min(Math.max(Number(new URL(req.url).searchParams.get("n")) || 5, 1), 50);

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ ok: false, error: "Sin base configurada." });

  const conexiones = await conexionesDe(tenant);
  const mios = new Set<string>();
  for (const c of conexiones) {
    mios.add(c.pageId);
    if (c.igId) mios.add(c.igId);
  }

  const { data, error } = await sb
    .from("meta_webhook_eventos")
    .select("id, recibido, objeto, cuerpo")
    .order("recibido", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message });

  const eventos = ((data ?? []) as Fila[])
    .filter((f) => (f.cuerpo?.entry ?? []).some((e) => e.id && mios.has(e.id)))
    .slice(0, n);

  return NextResponse.json({ ok: true, tenant, eventos });
}
