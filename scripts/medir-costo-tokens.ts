/**
 * Banco de medición de costo: cuánto cuesta CONTESTAR y cuánto cuesta VER UNA FOTO.
 *
 * Llama al mismo `generarRespuesta` que corre en producción, así que los números
 * son los de verdad: mismo system prompt, mismas herramientas, mismo modelo y el
 * mismo `count_tokens` con y sin la imagen para separar su costo.
 *
 * POR QUÉ NO SE HACE POR EL WEBHOOK: el webhook recibe un `media_id` de Meta y
 * baja la foto de Graph. Con un id inventado la imagen nunca llega al modelo y
 * mediríamos cero tokens de imagen, que es justo el dato que buscamos.
 *
 * NO manda ningún WhatsApp: no toca `enviarTextoWa`. Sí gasta tokens de verdad
 * contra la API, que es el punto.
 *
 * Uso:
 *   node --env-file=.env.local node_modules/.bin/tsx scripts/medir-costo-tokens.ts
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { generarRespuesta, type TurnoIA, type ImagenIA } from "../lib/ai";
import { costoDeUso, tokensPrompt, tarifaDe, type UsoTokens } from "../lib/tokens-precios";
import { medidasDeImagen } from "./medidas-imagen";

const TELEFONO = "50375391721"; // el número de pruebas
const TENANT = "miagentia" as const; // único con visión encendida además de yaly

// Configurables para poder hacer una corrida chica de prueba antes de la larga.
const CONVERSACIONES = Number(process.env.MED_CONVS) || 10;
const TURNOS_POR_CONV = Number(process.env.MED_TURNOS) || 10;
const IMAGENES_OBJETIVO = Number(process.env.MED_IMGS) || 50;

const MAX_BYTES = 3.6 * 1024 * 1024; // la API topa en 5 MB; el base64 infla ~33%

// ── Imágenes del disco ────────────────────────────────────────────────────────

const CARPETAS = [
  path.join(os.homedir(), "Pictures", "Screenshots"),
  path.join(os.homedir(), "Downloads"),
];

const MIME_POR_EXT: Record<string, ImagenIA["mime"]> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

interface Foto {
  archivo: string;
  origen: string;
  base64: string;
  mime: ImagenIA["mime"];
  bytes: number;
  w: number | null;
  h: number | null;
}

function juntarFotos(cuantas: number): Foto[] {
  const candidatas: { ruta: string; origen: string }[] = [];
  for (const carpeta of CARPETAS) {
    if (!fs.existsSync(carpeta)) continue;
    const origen = path.basename(carpeta);
    for (const nombre of fs.readdirSync(carpeta)) {
      const mime = MIME_POR_EXT[path.extname(nombre).toLowerCase()];
      if (!mime) continue;
      candidatas.push({ ruta: path.join(carpeta, nombre), origen });
    }
  }
  // Se toman repartidas a lo largo de cada carpeta, no las primeras 50 seguidas:
  // archivos vecinos suelen ser capturas casi idénticas y sesgarían la muestra.
  const paso = Math.max(1, Math.floor(candidatas.length / (cuantas * 3)));
  const fotos: Foto[] = [];
  for (let i = 0; i < candidatas.length && fotos.length < cuantas; i += paso) {
    const { ruta, origen } = candidatas[i];
    try {
      const st = fs.statSync(ruta);
      if (st.size > MAX_BYTES || st.size < 1024) continue;
      const buf = fs.readFileSync(ruta);
      const mime = MIME_POR_EXT[path.extname(ruta).toLowerCase()];
      const m = medidasDeImagen(buf, mime);
      fotos.push({
        archivo: path.basename(ruta),
        origen,
        base64: buf.toString("base64"),
        mime,
        bytes: st.size,
        w: m?.w ?? null,
        h: m?.h ?? null,
      });
    } catch {
      /* archivo ilegible: se salta */
    }
  }
  return fotos;
}

// ── Conversación simulada ─────────────────────────────────────────────────────

const MENSAJES = [
  "Hola, buenas tardes",
  "Vi su anuncio en Instagram",
  "Tengo una clínica dental, somos 4 personas",
  "El problema es que se nos acumulan los mensajes en WhatsApp",
  "A veces contestamos al otro día y ya perdimos al paciente",
  "¿Ustedes qué hacen exactamente?",
  "¿Y eso contesta solo o hay alguien detrás?",
  "¿Cuánto cuesta más o menos?",
  "¿En cuánto tiempo se puede montar?",
  "¿Se conecta con el número que ya tengo?",
  "Es que ya tenemos el número puesto en volantes",
  "¿Y si el paciente pregunta algo que no sabe?",
  "¿Puede agendar citas también?",
  "Nosotros usamos una agenda en papel todavía",
  "Uy, entonces habría que cambiar eso",
  "Déjeme consultarlo con mi socia",
  "¿Tienen algún ejemplo que pueda ver?",
  "¿Y esto funciona los fines de semana?",
  "Los sábados es cuando más nos escriben",
  "Perfecto, me interesa",
  "¿Qué necesitan de mi parte para empezar?",
  "¿Y la información de mis pacientes dónde queda?",
  "Eso me preocupa un poco la verdad",
  "¿Alguien más puede ver esas conversaciones?",
  "Ok, me deja más tranquilo",
  "¿Se puede apagar si algo sale mal?",
  "¿Y si quiero contestar yo un mensaje?",
  "Buenísimo",
  "¿Me manda la propuesta por acá?",
  "¿A qué hora podríamos hablar mañana?",
];

const PIES_DE_FOTO = [
  "Mire esto",
  "Le mando una foto",
  "Esto es lo que le decía",
  "¿Esto se puede hacer?",
  "Así se ve ahorita",
  "Le paso la captura",
  "Aquí está",
  "Esto me mandaron",
  "¿Ve el problema?",
  "Una más",
  "",
];

// ── Medición ──────────────────────────────────────────────────────────────────

interface Fila {
  conv: number;
  turno: number;
  tipo: "texto" | "imagen";
  archivo: string;
  origen: string;
  ancho: number | null;
  alto: number | null;
  kb: number;
  historialTurnos: number;
  inputTokens: number;
  cacheEscritura: number;
  cacheLectura: number;
  promptTotal: number;
  salida: number;
  tokensImagen: number;
  tokensTexto: number;
  costoTotal: number;
  ms: number;
}

function num(n: number, d = 6) {
  return n.toFixed(d);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falta ANTHROPIC_API_KEY. Corré con: node --env-file=.env.local ...");
    process.exit(1);
  }

  const modelo = process.env.AI_MODEL || "claude-haiku-4-5";
  const tarifa = tarifaDe(modelo);
  console.log(`\nModelo: ${modelo}`);
  console.log(
    tarifa
      ? `Tarifa: $${tarifa.input}/M entrada · $${tarifa.output}/M salida\n`
      : "Tarifa NO registrada para este modelo: el costo saldría en cero.\n",
  );

  const fotos = juntarFotos(IMAGENES_OBJETIVO);
  console.log(`Fotos cargadas: ${fotos.length}`);
  if (fotos.length === 0) {
    console.error("No se encontró ninguna imagen legible.");
    process.exit(1);
  }

  const filas: Fila[] = [];
  let iFoto = 0;
  let iMensaje = 0;

  for (let conv = 1; conv <= CONVERSACIONES; conv++) {
    // Cada conversación arranca limpia, como pasa de verdad: el corte de sesión
    // (4 h) hace que el agente no arrastre el hilo anterior.
    const historial: TurnoIA[] = [];

    for (let turno = 1; turno <= TURNOS_POR_CONV; turno++) {
      // Se alternan: turno impar con foto, par solo texto.
      const conFoto = turno % 2 === 1 && iFoto < fotos.length;
      const foto = conFoto ? fotos[iFoto++] : null;

      const texto = foto
        ? PIES_DE_FOTO[(conv + turno) % PIES_DE_FOTO.length]
        : MENSAJES[iMensaje++ % MENSAJES.length];

      const nuevo: TurnoIA = { autor: "cliente", texto: texto || "[imagen]" };
      if (foto) {
        nuevo.imagenes = [{ base64: foto.base64, mime: foto.mime }];
      }
      historial.push(nuevo);

      const t0 = Date.now();
      let r;
      try {
        r = await generarRespuesta(historial, undefined, {
          telefono: TELEFONO,
          tenantId: TENANT,
          sucursal: null,
        });
      } catch (e) {
        console.error(`  conv ${conv} turno ${turno}: falló`, (e as Error).message);
        historial.pop();
        continue;
      }
      const ms = Date.now() - t0;

      const uso: UsoTokens = r.uso;
      const prompt = tokensPrompt(uso);
      const costo = costoDeUso(uso, r.modelo);

      filas.push({
        conv,
        turno,
        tipo: foto ? "imagen" : "texto",
        archivo: foto?.archivo ?? "",
        origen: foto?.origen ?? "",
        ancho: foto?.w ?? null,
        alto: foto?.h ?? null,
        kb: foto ? Math.round(foto.bytes / 1024) : 0,
        historialTurnos: historial.length,
        inputTokens: uso.input_tokens ?? 0,
        cacheEscritura: uso.cache_creation_input_tokens ?? 0,
        cacheLectura: uso.cache_read_input_tokens ?? 0,
        promptTotal: prompt,
        salida: uso.output_tokens ?? 0,
        tokensImagen: r.tokensImagen,
        tokensTexto: Math.max(prompt - r.tokensImagen, 0),
        costoTotal: costo.total,
        ms,
      });

      // La respuesta entra al historial, igual que en producción.
      historial.push({ autor: "staff", texto: r.texto });

      const etiqueta = foto
        ? `IMG ${foto.w ?? "?"}x${foto.h ?? "?"} ${foto.archivo.slice(0, 28)}`
        : "texto";
      process.stdout.write(
        `\r  conv ${conv}/${CONVERSACIONES} turno ${turno}/${TURNOS_POR_CONV} · ${etiqueta.padEnd(46)}`,
      );
    }
    process.stdout.write("\n");
  }

  // ── Reporte ──
  if (filas.length === 0) {
    console.error(
      [
        "",
        "Ningun turno respondio, asi que no hay nada que reportar.",
        "Si el error decia 'credit balance is too low', hay que cargar saldo en la",
        "cuenta de Anthropic y volver a correr esto tal cual.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const dir = path.join(process.cwd(), "medicion");
  fs.mkdirSync(dir, { recursive: true });

  const cols = Object.keys(filas[0]) as (keyof Fila)[];
  const csv = [
    cols.join(","),
    ...filas.map((f) =>
      cols
        .map((c) => {
          const v = f[c];
          return typeof v === "string" && v.includes(",") ? `"${v}"` : String(v ?? "");
        })
        .join(","),
    ),
  ].join("\n");
  fs.writeFileSync(path.join(dir, "turnos.csv"), csv, "utf8");

  const conImg = filas.filter((f) => f.tipo === "imagen");
  const soloTexto = filas.filter((f) => f.tipo === "texto");
  const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const tarifaEntrada = tarifa?.input ?? 0;
  const costoImagenSola = prom(conImg.map((f) => f.tokensImagen)) * (tarifaEntrada / 1_000_000);

  const resumen = `# Costo por mensaje y por imagen

Medido con el mismo \`generarRespuesta\` que corre en producción.
Modelo **${modelo}**${tarifa ? ` · $${tarifa.input}/M entrada · $${tarifa.output}/M salida` : ""}.

Turnos medidos: **${filas.length}** (${soloTexto.length} de solo texto, ${conImg.length} con foto)
en ${CONVERSACIONES} conversaciones de ${TURNOS_POR_CONV} turnos.

## Lo que hay que saber

| | Solo texto | Con foto |
|---|---|---|
| Costo promedio del turno | **$${num(prom(soloTexto.map((f) => f.costoTotal)))}** | **$${num(prom(conImg.map((f) => f.costoTotal)))}** |
| Tokens de entrada | ${Math.round(prom(soloTexto.map((f) => f.promptTotal)))} | ${Math.round(prom(conImg.map((f) => f.promptTotal)))} |
| De esos, de la imagen | 0 | ${Math.round(prom(conImg.map((f) => f.tokensImagen)))} |
| Tokens de salida | ${Math.round(prom(soloTexto.map((f) => f.salida)))} | ${Math.round(prom(conImg.map((f) => f.salida)))} |
| Segundos por respuesta | ${(prom(soloTexto.map((f) => f.ms)) / 1000).toFixed(1)} | ${(prom(conImg.map((f) => f.ms)) / 1000).toFixed(1)} |

**Ver una foto cuesta en promedio $${num(costoImagenSola)} extra**, o sea
${Math.round(prom(conImg.map((f) => f.tokensImagen)))} tokens de entrada.

Gasto total de esta corrida: **$${num(suma(filas.map((f) => f.costoTotal)), 4)}**

## El costo de una foto depende de su tamaño

Claude cobra la imagen por área, así que una captura de escritorio cuesta varias
veces lo que una foto ya reducida.

| Tamaño | Fotos | Tokens promedio | Costo de la foto |
|---|---|---|---|
${[
  { n: "hasta 0.5 MP", f: (f: Fila) => (f.ancho ?? 0) * (f.alto ?? 0) <= 500_000 },
  {
    n: "0.5 a 2 MP",
    f: (f: Fila) =>
      (f.ancho ?? 0) * (f.alto ?? 0) > 500_000 && (f.ancho ?? 0) * (f.alto ?? 0) <= 2_000_000,
  },
  { n: "más de 2 MP", f: (f: Fila) => (f.ancho ?? 0) * (f.alto ?? 0) > 2_000_000 },
]
  .map(({ n, f }) => {
    const g = conImg.filter((x) => x.ancho && x.alto && f(x));
    if (!g.length) return `| ${n} | 0 | — | — |`;
    const t = prom(g.map((x) => x.tokensImagen));
    return `| ${n} | ${g.length} | ${Math.round(t)} | $${num(t * (tarifaEntrada / 1_000_000))} |`;
  })
  .join("\n")}

## Con otros modelos

La misma conversación, cambiando solo el modelo:

| Modelo | Turno de texto | Turno con foto | 1000 turnos con foto |
|---|---|---|---|
${["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"]
  .map((m) => {
    const t = tarifaDe(m);
    if (!t) return `| ${m} | — | — | — |`;
    const ct =
      prom(soloTexto.map((f) => f.promptTotal)) * (t.input / 1e6) +
      prom(soloTexto.map((f) => f.salida)) * (t.output / 1e6);
    const ci =
      prom(conImg.map((f) => f.promptTotal)) * (t.input / 1e6) +
      prom(conImg.map((f) => f.salida)) * (t.output / 1e6);
    return `| \`${m}\` | $${num(ct)} | $${num(ci)} | $${(ci * 1000).toFixed(2)} |`;
  })
  .join("\n")}

El detalle turno por turno está en \`turnos.csv\`.
`;

  fs.writeFileSync(path.join(dir, "RESUMEN.md"), resumen, "utf8");
  console.log(`\n${resumen}`);
  console.log(`Archivos: medicion/RESUMEN.md y medicion/turnos.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
