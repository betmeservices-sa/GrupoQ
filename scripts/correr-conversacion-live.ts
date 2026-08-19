/**
 * Corre la conversación de verdad CONTRA PRODUCCIÓN (demo.miagentia.com).
 *
 * Usa la llave de Anthropic que ya está configurada en Vercel: este script no
 * toca ninguna llave de IA, solo empuja mensajes por el webhook y lee el panel.
 *
 * Cómo funciona el truco de las imágenes: se suben a Meta con el mismo endpoint
 * que usa un teléfono real (`POST /{phone_number_id}/media`), lo que devuelve un
 * `media_id` de verdad. Con eso el webhook se comporta igual que si la foto
 * hubiera salido del celular: la app la baja de Graph y se la pasa al modelo.
 * Con un id inventado la imagen nunca llegaría al modelo.
 *
 * RITMO: hay que esperar la respuesta de cada turno antes de mandar el siguiente.
 * Si se atropellan, el debounce del agente cancela el turno anterior (por diseño)
 * y se pierde la medición.
 *
 * TOPE: el agente corta a los 10 mensajes por conversación, así que 100 turnos
 * son 10 conversaciones. No se puede reiniciar borrando el historial, porque
 * `clearHistory` borra TAMBIÉN el consumo, que es justo lo que estamos midiendo.
 *
 * Uso:  node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/correr-conversacion-live.ts
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { medidasDeImagen } from "./medidas-imagen";

const BASE = process.env.MED_BASE || "https://demo.miagentia.com";
const USUARIO = "demoagentia";
const PASSWORD = process.env.MED_PASS || "demok";

const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PNID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";

const NUMERO_BASE = 50375391721; // el de pruebas
const CONVERSACIONES = Number(process.env.MED_CONVS) || 10;
const TURNOS = Number(process.env.MED_TURNOS) || 10;

const TMP = ".medicion-tmp";
const SALIDA = "medicion";

const MENSAJES = [
  "Hola buenas", "Vi su anuncio", "Tengo una clínica dental", "Somos cuatro personas",
  "Se nos acumulan los mensajes", "A veces contestamos al otro día",
  "¿Ustedes cómo lo resuelven?", "¿Contesta solo o hay alguien detrás?",
  "¿Cuánto cuesta?", "¿En cuánto tiempo queda listo?",
  "¿Se conecta al número que ya tengo?", "El número está en volantes",
  "¿Y si preguntan algo que no sabe?", "¿Puede agendar citas?",
  "Llevamos la agenda en papel", "¿Se conecta con Google Calendar?",
  "Déjeme consultarlo", "¿Funciona los fines de semana?",
  "Los sábados escriben más", "¿Dónde queda la información de mis pacientes?",
  "Eso me preocupa", "¿Alguien más lee esas conversaciones?",
  "Ok, me deja tranquilo", "¿Se puede apagar?", "¿Y si quiero contestar yo?",
  "Buenísimo", "¿Me manda la propuesta?", "¿Hablamos mañana?",
  "En la mañana mejor", "Listo, gracias",
];

const PIES = ["Mire", "Le mando esto", "Así se ve", "¿Ve el problema?", "Le paso la captura", ""];

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Sesión en el panel ────────────────────────────────────────────────────────

let cookie = "";

async function entrar() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ usuario: USUARIO, password: PASSWORD }),
  });
  const set = r.headers.get("set-cookie") || "";
  cookie = set.split(",").map((c) => c.split(";")[0].trim()).join("; ");
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error("no se pudo entrar al panel: " + JSON.stringify(j));
  return j.tenant as string;
}

interface Consumo {
  respuestas: number;
  llamadas: number;
  imagenes: number;
  tokensPrompt: number;
  tokensSalida: number;
  tokensTexto: number;
  tokensImagen: number;
  costoTotal: number;
}

async function consumo(): Promise<Consumo> {
  const r = await fetch(`${BASE}/api/ai/consumo`, { headers: { cookie } });
  const j = await r.json();
  return j.total as Consumo;
}

// ── Imágenes ──────────────────────────────────────────────────────────────────

const CARPETAS = [
  path.join(os.homedir(), "Pictures", "Screenshots"),
  path.join(os.homedir(), "Downloads"),
];
const EXT: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

interface Foto { archivo: string; ruta: string; mime: string; w: number; h: number; kb: number; mediaId?: string }

function elegirFotos(cuantas: number): Foto[] {
  const out: Foto[] = [];
  for (const carpeta of CARPETAS) {
    if (!fs.existsSync(carpeta)) continue;
    const nombres = fs.readdirSync(carpeta).filter((n) => EXT[path.extname(n).toLowerCase()]);
    const paso = Math.max(1, Math.floor(nombres.length / (cuantas / CARPETAS.length)));
    for (let i = 0; i < nombres.length && out.length < cuantas; i += paso) {
      const ruta = path.join(carpeta, nombres[i]);
      try {
        const st = fs.statSync(ruta);
        // Meta topa en 5 MB; abajo de 1 KB no es una foto.
        if (st.size > 4.5 * 1024 * 1024 || st.size < 1024) continue;
        const mime = EXT[path.extname(ruta).toLowerCase()];
        const fd = fs.openSync(ruta, "r");
        const buf = Buffer.alloc(Math.min(65536, st.size));
        fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const m = medidasDeImagen(buf, mime);
        if (!m) continue;
        out.push({ archivo: nombres[i], ruta, mime, w: m.w, h: m.h, kb: Math.round(st.size / 1024) });
      } catch { /* se salta */ }
    }
  }
  return out;
}

/**
 * Sube a Meta y devuelve el media_id. Se copia a una carpeta local con nombre
 * simple: los nombres de las capturas traen espacios y comas que rompen el
 * multipart, y algunos son larguísimos.
 */
async function subir(f: Foto, i: number): Promise<string | null> {
  fs.mkdirSync(TMP, { recursive: true });
  const destino = path.join(TMP, `img${i}${path.extname(f.archivo).toLowerCase()}`);
  fs.copyFileSync(f.ruta, destino);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", f.mime);
  form.append("file", new Blob([fs.readFileSync(destino)], { type: f.mime }), path.basename(destino));
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${PNID}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: form,
    });
    const j = await r.json();
    if (!j.id) {
      console.log(`   subida falló (${f.archivo.slice(0, 30)}):`, JSON.stringify(j).slice(0, 120));
      return null;
    }
    return j.id as string;
  } catch (e) {
    console.log("   subida falló:", (e as Error).message);
    return null;
  } finally {
    try { fs.unlinkSync(destino); } catch { /* da igual */ }
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

async function mandar(from: string, wamid: string, texto: string, mediaId?: string, mime?: string) {
  const mensaje: Record<string, unknown> = {
    from,
    id: wamid,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: mediaId ? "image" : "text",
  };
  if (mediaId) mensaje.image = { id: mediaId, mime_type: mime, caption: texto || undefined };
  else mensaje.text = { body: texto };

  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: PNID },
              contacts: [{ wa_id: from, profile: { name: "Bryan" } }],
              messages: [mensaje],
            },
          },
        ],
      },
    ],
  };
  const r = await fetch(`${BASE}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.status;
}

/** Espera a que el agente conteste, o se rinde. */
async function esperarRespuesta(antes: number, topeMs = 70000): Promise<Consumo | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < topeMs) {
    await dormir(4000);
    const c = await consumo();
    if (c.respuestas > antes) return c;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Fila {
  turno: number; conv: number; numero: string; tipo: string; archivo: string;
  ancho: number | null; alto: number | null; kb: number;
  dPrompt: number; dSalida: number; dTexto: number; dImagen: number; dCosto: number; seg: number;
}

async function main() {
  if (!TOKEN || !PNID) {
    console.error("Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID.");
    process.exit(1);
  }

  const tenant = await entrar();
  const base = await consumo();
  console.log(`\nPanel: ${BASE} · tenant ${tenant}`);
  console.log(`Línea base: ${base.respuestas} respuestas, ${base.imagenes} imágenes, $${base.costoTotal.toFixed(4)}\n`);

  const totalImgs = Math.floor((CONVERSACIONES * TURNOS) / 2);
  console.log(`Subiendo ${totalImgs} imágenes a Meta...`);
  const fotos = elegirFotos(totalImgs);
  let subidas = 0;
  for (let i = 0; i < fotos.length; i++) {
    fotos[i].mediaId = (await subir(fotos[i], i)) ?? undefined;
    if (fotos[i].mediaId) subidas++;
    process.stdout.write(`\r  ${subidas}/${fotos.length} subidas`);
  }
  console.log(`\n${subidas} imágenes listas.\n`);

  const utiles = fotos.filter((f) => f.mediaId);
  const filas: Fila[] = [];
  let prev = base;
  let iFoto = 0, iTexto = 0, n = 0;

  for (let conv = 0; conv < CONVERSACIONES; conv++) {
    const numero = String(NUMERO_BASE + conv);
    console.log(`\n── conversación ${conv + 1}/${CONVERSACIONES} · ${numero} ──`);

    for (let turno = 1; turno <= TURNOS; turno++) {
      n++;
      const conFoto = turno % 2 === 1 && iFoto < utiles.length;
      const foto = conFoto ? utiles[iFoto++] : null;
      const texto = foto ? PIES[n % PIES.length] : MENSAJES[iTexto++ % MENSAJES.length];
      const wamid = `wamid.MED.${Date.now()}.${n}`;

      const t0 = Date.now();
      const st = await mandar(numero, wamid, texto, foto?.mediaId, foto?.mime);
      if (st !== 200) {
        console.log(`  turno ${turno}: el webhook devolvió ${st}, se salta`);
        continue;
      }

      const c = await esperarRespuesta(prev.respuestas);
      if (!c) {
        console.log(`  turno ${turno}: sin respuesta en 70s (tope alcanzado o error). Sigue.`);
        continue;
      }

      filas.push({
        turno: n, conv: conv + 1, numero,
        tipo: foto ? "imagen" : "texto",
        archivo: foto?.archivo ?? "",
        ancho: foto?.w ?? null, alto: foto?.h ?? null, kb: foto?.kb ?? 0,
        dPrompt: c.tokensPrompt - prev.tokensPrompt,
        dSalida: c.tokensSalida - prev.tokensSalida,
        dTexto: c.tokensTexto - prev.tokensTexto,
        dImagen: c.tokensImagen - prev.tokensImagen,
        dCosto: Math.round((c.costoTotal - prev.costoTotal) * 1e8) / 1e8,
        seg: Math.round((Date.now() - t0) / 1000),
      });

      const f = filas[filas.length - 1];
      console.log(
        `  ${String(turno).padStart(2)}. ${(foto ? `IMG ${f.ancho}x${f.alto}` : "texto").padEnd(18)}` +
          ` prompt ${String(f.dPrompt).padStart(5)}  img ${String(f.dImagen).padStart(5)}` +
          `  $${f.dCosto.toFixed(6)}  ${f.seg}s`,
      );
      prev = c;

      fs.mkdirSync(SALIDA, { recursive: true });
      fs.writeFileSync(
        path.join(SALIDA, "live-turnos.csv"),
        [
          "turno,conversacion,numero,tipo,archivo,ancho,alto,kb,tokens_prompt,tokens_salida,tokens_texto,tokens_imagen,costo,segundos",
          ...filas.map((x) =>
            [x.turno, x.conv, x.numero, x.tipo, `"${x.archivo}"`, x.ancho ?? "", x.alto ?? "",
             x.kb, x.dPrompt, x.dSalida, x.dTexto, x.dImagen, x.dCosto, x.seg].join(","),
          ),
        ].join("\n"),
        "utf8",
      );
    }
  }

  const fin = await consumo();
  console.log("\n── total ──");
  console.log(`Turnos medidos:  ${filas.length}`);
  console.log(`Respuestas:      ${fin.respuestas - base.respuestas}`);
  console.log(`Imágenes vistas: ${fin.imagenes - base.imagenes}`);
  console.log(`Costo de la corrida: $${(fin.costoTotal - base.costoTotal).toFixed(4)}`);
  console.log(`\nDetalle en ${SALIDA}/live-turnos.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
