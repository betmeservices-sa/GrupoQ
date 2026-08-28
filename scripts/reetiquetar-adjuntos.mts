// Los mensajes que quedaron como "[adjunto]" (respuestas a historias vencidas,
// casi siempre): se le pide a Meta qué eran y se corrige el texto guardado.
//
//   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... ESQUEMA=yali npx tsx scripts/reetiquetar-adjuntos.mts [--seco]

import { createClient } from "@supabase/supabase-js";
import { detalleDeAdjunto } from "../lib/meta-adjunto-detalle";
import type { MetaConnection } from "../lib/meta-store";

const ESQUEMA = process.env.ESQUEMA || "public";
const SECO = process.argv.includes("--seco");
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false }, db: { schema: ESQUEMA } });

const { data: conexiones } = await sb.from("meta_connections").select("tenant, page_id, page_name, page_token");
const tokenPor = new Map((conexiones ?? []).map((c) => [c.page_id as string, c]));
const { data: filas, error } = await sb.from("meta_messages").select("id, mid, page_id, texto").eq("texto", "[adjunto]").limit(500);
if (error) throw new Error(error.message);
console.log(`${filas?.length ?? 0} mensajes con [adjunto] en ${ESQUEMA}`);
const conteo: Record<string, number> = {};
for (const f of filas ?? []) {
  const cx = tokenPor.get(f.page_id as string);
  if (!cx) continue;
  const marca = await detalleDeAdjunto({ pageToken: cx.page_token as string } as MetaConnection, f.mid as string);
  const clave = marca ? marca.split(" ")[0] : "(sin detalle)";
  conteo[clave] = (conteo[clave] ?? 0) + 1;
  if (!marca || SECO) continue;
  const { error: e2 } = await sb.from("meta_messages").update({ texto: marca }).eq("id", f.id);
  if (e2) console.error("no se pudo actualizar", f.mid, e2.message);
}
console.log(JSON.stringify(conteo, null, 2));
