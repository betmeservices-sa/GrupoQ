// Clasifica por tema los mensajes entrantes de Messenger e Instagram que ya
// estaban en la base antes de que el webhook lo hiciera solo.
//
//   SUPABASE_PAT=... ESQUEMA=yali npx tsx scripts/clasificar-temas.mts [--dias 90] [--seco]
//
// Usa las mismas reglas que el webhook (lib/tema.ts): lo que salga acá es lo
// mismo que saldría si el mensaje llegara hoy. Corre por la API de
// administración de Supabase (el PAT), no por la publishable key.

import { temaDe } from "../lib/tema";

const PROYECTO = process.env.SUPABASE_PROYECTO || "pfzxpidlbuxxtlycdwaj";
const PAT = process.env.SUPABASE_PAT;
const ESQUEMA = process.env.ESQUEMA || "public";
const args = process.argv.slice(2);
const SECO = args.includes("--seco");
const DIAS = Number(args[args.indexOf("--dias") + 1]) || 90;

if (!PAT) {
  console.error("Falta SUPABASE_PAT.");
  process.exit(1);
}

async function sql<T>(query: string): Promise<T[]> {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROYECTO}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const j = (await r.json()) as T[] | { message?: string };
  if (!Array.isArray(j)) throw new Error((j as { message?: string }).message ?? "falló la consulta");
  return j;
}

async function main() {
  const filas = await sql<{ id: number; texto: string }>(
    `select id, texto from ${ESQUEMA}.meta_messages where direction='in' and tema is null and ts >= now() - interval '${DIAS} days'`,
  );
  const porTema: Record<string, number[]> = {};
  for (const f of filas) (porTema[temaDe(f.texto)] ??= []).push(f.id);
  console.log(`${filas.length} mensajes sin tema en ${ESQUEMA} (últimos ${DIAS} días):`);
  for (const [t, ids] of Object.entries(porTema)) console.log(`  ${t}: ${ids.length}`);
  if (SECO || filas.length === 0) return;
  for (const [t, ids] of Object.entries(porTema)) {
    for (let i = 0; i < ids.length; i += 500) {
      await sql(`update ${ESQUEMA}.meta_messages set tema='${t}' where id in (${ids.slice(i, i + 500).join(",")})`);
    }
  }
  console.log("Guardado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
