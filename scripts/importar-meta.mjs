// Trae a la bandeja las conversaciones que ya existían en Messenger e Instagram.
//
// POR QUÉ HACE FALTA
// El webhook solo entrega lo que pasa DESPUÉS de conectar la página. Todo lo
// anterior, que en Yali son meses de conversaciones, no llega nunca: Meta no
// reenvía lo viejo. Por eso la bandeja mostraba cuatro mensajes cuando en
// Instagram y Facebook había decenas de conversaciones.
//
// Se puede correr las veces que haga falta: cada mensaje se guarda por su id de
// Meta y los repetidos se descartan solos.
//
//   SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... ESQUEMA=yali \
//     node scripts/importar-meta.mjs [--dias 180] [--seco]
//
// --seco muestra lo que traería sin escribir nada.

const GRAPH = "https://graph.facebook.com/v21.0";

// Mismas señales que lib/respuesta-a-comentario.ts, que es la fuente. Hay una
// prueba que compara las dos listas para que no se separen: este archivo es
// .mjs y no puede importar el .ts.
const RESPUESTA_A_COMENTARIO = [
  /responding to a user comment/i,
  /respondiendo a un comentario/i,
  /est[aá]s respondiendo.{0,40}comentario/i,
];
const esRespuestaAComentario = (t) => Boolean(t) && RESPUESTA_A_COMENTARIO.some((s) => s.test(t));

const args = process.argv.slice(2);
const SECO = args.includes("--seco");
const DIAS = Number(args[args.indexOf("--dias") + 1]) || 180;

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const ESQUEMA = process.env.ESQUEMA || "public";

if (!SB_URL || !SB_KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const cabeceras = {
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  "Accept-Profile": ESQUEMA,
  "Content-Profile": ESQUEMA,
  "Content-Type": "application/json",
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Pide a Meta con reintentos.
 *
 * El endpoint de Instagram contesta "Timeout" y "Please reduce the amount of
 * data" cada dos por tres, y las dos vienen marcadas como pasajeras. Sin
 * reintentar, la mitad de las conversaciones de Instagram se perdían sin que
 * nadie se enterara, que es peor que fallar.
 */
async function pedirAMeta(url, intentos = 5) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!j.error) return j;
      const pasajero =
        j.error.is_transient ||
        j.error.code === 1 ||
        j.error.code === -2 ||
        j.error.code === 4;
      if (i > 1) console.log(`   reintento ${i}`);
      if (!pasajero || i === intentos) {
        console.error(`   Meta: ${j.error.message}`);
        return null;
      }
    } catch (e) {
      if (i === intentos) {
        console.error(`   red: ${e.message}`);
        return null;
      }
    }
    await dormir(1500 * i); // se espera cada vez un poco más
  }
  return null;
}

/** Las conversaciones de una página en un canal, siguiendo las páginas de Meta. */
async function conversacionesDe(pageId, token, plataforma) {
  const campos = "participants,updated_time,messages.limit(50){id,message,from,created_time}";
  const plat = plataforma === "instagram" ? "&platform=instagram" : "";
  // De a pocas: pedir muchas con sus mensajes es justo lo que hace que Meta
  // conteste "reduce the amount of data".
  let url = `${GRAPH}/${pageId}/conversations?fields=${encodeURIComponent(campos)}&limit=10${plat}&access_token=${encodeURIComponent(token)}`;
  const todas = [];
  // Freno: Meta a veces sigue ofreciendo "siguiente página" aunque ya no queden
  // datos, y sin tope esto daría vueltas para siempre.
  for (let pagina = 0; url && pagina < 60; pagina++) {
    const d = await pedirAMeta(url);
    if (!d) break;
    const lote = d.data ?? [];
    if (lote.length === 0) break;
    todas.push(...lote);
    console.log(`   ...${todas.length} conversaciones`);
    url = d.paging?.next ?? null;
    if (url) await dormir(400);
  }
  return todas;
}

async function guardar(filas) {
  if (SECO || filas.length === 0) return filas.length;
  // on_conflict=mid es lo que hace que "ignore-duplicates" funcione de verdad.
  // Sin eso, un solo mensaje repetido tumba el lote ENTERO de 200 y esos 200 se
  // pierden sin que se note: el script sigue como si nada.
  const r = await fetch(`${SB_URL}/rest/v1/meta_messages?on_conflict=mid`, {
    method: "POST",
    headers: { ...cabeceras, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(filas),
  });
  if (!r.ok) {
    console.error("   guardar:", (await r.text()).slice(0, 200));
    return 0;
  }
  return filas.length;
}

async function main() {
  const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000).toISOString();
  console.log(`Trayendo conversaciones desde ${desde.slice(0, 10)}${SECO ? " (en seco)" : ""}\n`);

  const rc = await fetch(
    `${SB_URL}/rest/v1/meta_connections?select=tenant,page_id,page_name,ig_id,page_token`,
    { headers: cabeceras },
  );
  const conexiones = await rc.json();

  let total = 0;
  for (const cx of conexiones) {
    // Los dos ids de la casa. Sirven para saber quién habló: si el mensaje sale
    // de uno de estos, lo escribió el hotel.
    const casa = new Set([cx.page_id, cx.ig_id].filter(Boolean));

    for (const canal of ["facebook", "instagram"]) {
      const convs = await conversacionesDe(cx.page_id, cx.page_token, canal);
      console.log(`${cx.page_name} · ${canal}: ${convs.length} conversaciones`);

      const filas = [];
      for (const conv of convs) {
        const otro = (conv.participants?.data ?? []).find((p) => !casa.has(p.id));
        if (!otro?.id) continue; // conversación sin contraparte: no hay a quién asignarla

        for (const m of conv.messages?.data ?? []) {
          if (!m.created_time || m.created_time < desde) continue;
          // Contestar un comentario en privado deja una nota de Meta en el
          // hilo, que no escribió nadie. Eso va en Comentarios.
          if (esRespuestaAComentario(m.message)) continue;
          const salida = casa.has(m.from?.id);
          filas.push({
            mid: m.id,
            tenant: cx.tenant,
            canal,
            page_id: cx.page_id,
            // Siempre el de la contraparte, en los dos sentidos: es lo que
            // identifica la conversación, igual que el webhook.
            sender_id: otro.id,
            sender_name: otro.name ?? otro.username ?? null,
            texto: m.message || "[adjunto]",
            ts: new Date(m.created_time).toISOString(),
            direction: salida ? "out" : "in",
          });
        }
      }

      // En orden cronologico ANTES de guardar. La bandeja relee por id, y el
      // estado de cada conversacion sale de quien hablo ultimo: si las filas
      // entraran en el orden que las da Meta (la mas nueva primero), el ultimo
      // releido seria el mas viejo y las conversaciones quedarian al reves.
      filas.sort((a, b) => a.ts.localeCompare(b.ts));

      // De a tandas: un solo POST con miles de filas se corta a la mitad.
      for (let i = 0; i < filas.length; i += 200) {
        total += await guardar(filas.slice(i, i + 200));
      }
      console.log(`   ${filas.length} mensajes`);
    }
  }

  console.log(`\n${SECO ? "Se traerían" : "Guardados"}: ${total} mensajes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
