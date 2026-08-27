import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { getSupabase } from "@/lib/supabase";
import { nombreDeTema } from "@/lib/tema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cuánto entra por Messenger e Instagram y de qué hablan.
//
// ?dias=1 (hoy), 7, 30. Todo se cuenta en hora de El Salvador (UTC-6): "hoy"
// es el día de quien mira el panel, no el de los servidores.
//
// Se lee crudo y se cuenta acá: son cientos de filas por semana, no millones,
// y así una consulta sirve para todos los cortes (canal, día, tema, quién
// respondió) sin armar cinco.

const TZ_OFFSET_MS = -6 * 60 * 60_000;

function diaLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

interface Fila {
  canal: string;
  direction: string;
  ts: string;
  tema: string | null;
  sender_id: string;
  staff_id: string | null;
}

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 7));
  const sb = getSupabase(tenant);
  if (!sb) return NextResponse.json({ ok: false, error: "Sin base configurada." });

  // Desde las 00:00 de hace (dias-1) días, hora local. Con dias=1 es hoy.
  const ahoraLocal = new Date(Date.now() + TZ_OFFSET_MS);
  const inicioLocal = new Date(Date.UTC(ahoraLocal.getUTCFullYear(), ahoraLocal.getUTCMonth(), ahoraLocal.getUTCDate() - (dias - 1)));
  const desde = new Date(inicioLocal.getTime() - TZ_OFFSET_MS).toISOString();

  const { data, error } = await sb
    .from("meta_messages")
    .select("canal, direction, ts, tema, sender_id, staff_id")
    .eq("tenant", tenant)
    .gte("ts", desde)
    .limit(20000);
  if (error) return NextResponse.json({ ok: false, error: error.message });

  const filas = (data ?? []) as Fila[];
  const entrantes = filas.filter((f) => f.direction === "in");
  const salientes = filas.filter((f) => f.direction === "out");

  const porCanal: Record<string, number> = { facebook: 0, instagram: 0 };
  const personas = new Set<string>();
  const porDia = new Map<string, { facebook: number; instagram: number }>();
  const porTema = new Map<string, number>();
  for (const f of entrantes) {
    porCanal[f.canal] = (porCanal[f.canal] ?? 0) + 1;
    personas.add(`${f.canal}:${f.sender_id}`);
    const d = diaLocal(f.ts);
    const dia = porDia.get(d) ?? { facebook: 0, instagram: 0 };
    if (f.canal === "instagram") dia.instagram++;
    else dia.facebook++;
    porDia.set(d, dia);
    const t = f.tema ?? "otro";
    porTema.set(t, (porTema.get(t) ?? 0) + 1);
  }

  // Los días sin mensajes también cuentan, en cero: una gráfica con huecos
  // miente.
  const diasLista: { dia: string; facebook: number; instagram: number }[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(inicioLocal.getTime() + i * 24 * 60 * 60_000).toISOString().slice(0, 10);
    diasLista.push({ dia: d, ...(porDia.get(d) ?? { facebook: 0, instagram: 0 }) });
  }

  const temas = [...porTema.entries()]
    .map(([id, n]) => ({ id, nombre: nombreDeTema(id), n }))
    .sort((a, b) => b.n - a.n);

  const respondidos = {
    ia: salientes.filter((f) => f.staff_id === "ia").length,
    personas: salientes.filter((f) => f.staff_id && f.staff_id !== "ia").length,
    equipo: salientes.filter((f) => !f.staff_id).length,
  };

  // Conversaciones que arrancaron en el periodo y que ya tienen respuesta.
  const ultimoPorPersona = new Map<string, Fila>();
  for (const f of filas.slice().sort((a, b) => (a.ts < b.ts ? -1 : 1))) ultimoPorPersona.set(`${f.canal}:${f.sender_id}`, f);
  const sinResponder = [...ultimoPorPersona.values()].filter((f) => f.direction === "in").length;

  return NextResponse.json({
    ok: true,
    dias,
    desde,
    entrantes: entrantes.length,
    personas: personas.size,
    porCanal,
    porDia: diasLista,
    temas,
    respondidos,
    sinResponder,
  });
}
