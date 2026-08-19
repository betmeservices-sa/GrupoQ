/**
 * Cuánto cuesta que el agente VEA una foto, calculado sobre imágenes reales.
 *
 * No llama a la API: aplica la regla publicada por Anthropic. Claude no mira
 * píxeles sino parches de 28x28, así que una imagen cuesta
 *
 *     ceil(ancho / 28) * ceil(alto / 28)   tokens visuales
 *
 * con dos límites por nivel de modelo. Si la imagen se pasa de cualquiera de
 * los dos, se reduce (manteniendo proporción) hasta que entre:
 *
 *   Alta resolución  · Claude 4.7 en adelante · lado máx 2576 px · tope 4784 tokens
 *   Estándar         · el resto               · lado máx 1568 px · tope 1568 tokens
 *
 * OJO CON ESTO: no es solo que Opus cueste más por token. En alta resolución la
 * MISMA foto gasta hasta 3 veces MÁS tokens. El salto de modelo se paga dos
 * veces.
 *
 * La implementación se valida contra la tabla de ejemplos de la documentación
 * antes de tocar ninguna imagen. Si algún día cambia la regla, esto grita.
 *
 * Uso:  node node_modules/tsx/dist/cli.mjs scripts/costo-imagenes.ts
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PRECIOS_POR_MILLON, tarifaDe } from "../lib/tokens-precios";
import { medidasDeImagen } from "./medidas-imagen";

const PARCHE = 28;

export interface Nivel {
  nombre: string;
  ladoMax: number;
  tokensMax: number;
}

export const ALTA: Nivel = { nombre: "alta", ladoMax: 2576, tokensMax: 4784 };
export const ESTANDAR: Nivel = { nombre: "estandar", ladoMax: 1568, tokensMax: 1568 };

/** Modelos de 4.7 en adelante van en alta resolución. */
export function nivelDe(modelo: string): Nivel {
  return /opus-5|sonnet-5|opus-4-(7|8)|fable-5/.test(modelo) ? ALTA : ESTANDAR;
}

function parches(w: number, h: number): number {
  return Math.ceil(w / PARCHE) * Math.ceil(h / PARCHE);
}

/**
 * Tokens visuales de una imagen en un nivel dado, aplicando la reducción.
 * Se busca la escala más grande que entre en los dos límites; con pasos de 1px
 * sobre el lado largo alcanza y sobra, y evita depender de una fórmula cerrada
 * que podría no coincidir con la de ellos.
 */
export function tokensVisuales(w: number, h: number, nivel: Nivel): { tokens: number; w: number; h: number } {
  if (w <= 0 || h <= 0) return { tokens: 0, w, h };

  const cabe = (ww: number, hh: number) =>
    Math.max(ww, hh) <= nivel.ladoMax && parches(ww, hh) <= nivel.tokensMax;

  if (cabe(w, h)) return { tokens: parches(w, h), w, h };

  const proporcion = h / w;
  const horizontal = w >= h;
  // Se arranca desde el lado máximo permitido y se baja hasta que entre.
  let largo = Math.min(Math.max(w, h), nivel.ladoMax);
  for (; largo > 28; largo--) {
    const ww = horizontal ? largo : Math.max(1, Math.round(largo / proporcion));
    const hh = horizontal ? Math.max(1, Math.round(largo * proporcion)) : largo;
    if (cabe(ww, hh)) return { tokens: parches(ww, hh), w: ww, h: hh };
  }
  return { tokens: nivel.tokensMax, w: 0, h: 0 };
}

// ── Validación contra la tabla de la documentación ────────────────────────────

const TABLA_OFICIAL: { w: number; h: number; estandar: number; alta: number }[] = [
  { w: 200, h: 200, estandar: 64, alta: 64 },
  { w: 1000, h: 1000, estandar: 1296, alta: 1296 },
  { w: 1092, h: 1092, estandar: 1521, alta: 1521 },
  { w: 1920, h: 1080, estandar: 1560, alta: 2691 },
  { w: 2000, h: 1500, estandar: 1564, alta: 3888 },
  { w: 3840, h: 2160, estandar: 1560, alta: 4784 },
];

function validar(): boolean {
  let ok = true;
  console.log("Validación contra la tabla oficial de Anthropic:\n");
  console.log("  imagen           estándar (esperado)   alta (esperado)");
  for (const c of TABLA_OFICIAL) {
    const e = tokensVisuales(c.w, c.h, ESTANDAR).tokens;
    const a = tokensVisuales(c.w, c.h, ALTA).tokens;
    const bienE = e === c.estandar;
    const bienA = a === c.alta;
    if (!bienE || !bienA) ok = false;
    console.log(
      `  ${`${c.w}x${c.h}`.padEnd(16)} ${String(e).padStart(5)} (${c.estandar})${bienE ? " ok " : " NO "}` +
        `      ${String(a).padStart(5)} (${c.alta})${bienA ? " ok" : " NO"}`,
    );
  }
  console.log("");
  return ok;
}

// ── Imágenes reales del disco ─────────────────────────────────────────────────

const CARPETAS = [
  path.join(os.homedir(), "Pictures", "Screenshots"),
  path.join(os.homedir(), "Downloads"),
];

const EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

interface Img {
  archivo: string;
  origen: string;
  w: number;
  h: number;
  kb: number;
}

function leerImagenes(limite: number): Img[] {
  const out: Img[] = [];
  for (const carpeta of CARPETAS) {
    if (!fs.existsSync(carpeta)) continue;
    const origen = path.basename(carpeta);
    const nombres = fs.readdirSync(carpeta).filter((n) => EXT[path.extname(n).toLowerCase()]);
    // Repartidas a lo largo de la carpeta: archivos vecinos suelen ser casi
    // idénticos y sesgarían la muestra.
    const paso = Math.max(1, Math.floor(nombres.length / (limite / CARPETAS.length)));
    for (let i = 0; i < nombres.length && out.length < limite; i += paso) {
      const ruta = path.join(carpeta, nombres[i]);
      try {
        const st = fs.statSync(ruta);
        if (st.size < 1024) continue;
        const mime = EXT[path.extname(ruta).toLowerCase()];
        // Con los primeros 64 KB alcanza para el encabezado.
        const fd = fs.openSync(ruta, "r");
        const buf = Buffer.alloc(Math.min(65536, st.size));
        fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const m = medidasDeImagen(buf, mime);
        if (!m || !m.w || !m.h) continue;
        out.push({ archivo: nombres[i], origen, w: m.w, h: m.h, kb: Math.round(st.size / 1024) });
      } catch {
        /* se salta */
      }
    }
  }
  return out;
}

// ── Reporte ───────────────────────────────────────────────────────────────────

const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const mediana = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const d = (n: number, k = 4) => n.toFixed(k);

function main() {
  if (!validar()) {
    console.error("La implementación NO reproduce la tabla oficial. No se sigue.");
    process.exit(1);
  }
  console.log("Implementación validada.\n");

  const imgs = leerImagenes(600);
  if (!imgs.length) {
    console.error("No se pudo leer ninguna imagen.");
    process.exit(1);
  }

  const filas = imgs.map((i) => {
    const est = tokensVisuales(i.w, i.h, ESTANDAR);
    const alt = tokensVisuales(i.w, i.h, ALTA);
    return { ...i, mp: (i.w * i.h) / 1e6, tokEst: est.tokens, tokAlta: alt.tokens };
  });

  const dir = path.join(process.cwd(), "medicion");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "imagenes.csv"),
    [
      "archivo,origen,ancho,alto,megapixeles,kb,tokens_estandar,tokens_alta",
      ...filas.map((f) =>
        [
          `"${f.archivo.replace(/"/g, "")}"`,
          f.origen,
          f.w,
          f.h,
          f.mp.toFixed(2),
          f.kb,
          f.tokEst,
          f.tokAlta,
        ].join(","),
      ),
    ].join("\n"),
    "utf8",
  );

  const modeloActual = process.env.AI_MODEL || "claude-haiku-4-5";
  const tarifaActual = tarifaDe(modeloActual);
  const nivelActual = nivelDe(modeloActual);
  const tokActual = filas.map((f) => (nivelActual === ALTA ? f.tokAlta : f.tokEst));

  const lineas: string[] = [];
  const P = (s = "") => lineas.push(s);

  P("# Cuánto cuesta que el agente vea una foto");
  P("");
  P(`Calculado sobre **${filas.length} imágenes reales** de tu disco (capturas y descargas),`);
  P("aplicando la regla publicada por Anthropic. La implementación reproduce exacto");
  P("la tabla de ejemplos de su documentación, así que los números son de fiar.");
  P("");
  P("## La regla, en corto");
  P("");
  P("Claude no mira píxeles, mira parches de 28x28. Una imagen cuesta");
  P("`ceil(ancho/28) * ceil(alto/28)` tokens, y si se pasa de los límites del modelo");
  P("se reduce antes. Los límites cambian según el modelo:");
  P("");
  P("| Nivel | Modelos | Lado máximo | Tope de tokens |");
  P("|---|---|---|---|");
  P("| Alta resolución | Opus 5, Sonnet 5, Opus 4.7 y 4.8 | 2576 px | 4784 |");
  P("| Estándar | Haiku 4.5 y anteriores | 1568 px | 1568 |");
  P("");
  P("**Esto es lo que más importa del reporte:** cambiar de Haiku a Opus no solo sube");
  P("el precio por token, también hace que la MISMA foto gaste hasta 3 veces más");
  P("tokens. El salto se paga dos veces.");
  P("");
  P("## Tus imágenes");
  P("");
  P(`| | Valor |`);
  P(`|---|---|`);
  P(`| Imágenes analizadas | ${filas.length} |`);
  P(`| Resolución mediana | ${mediana(filas.map((f) => f.mp)).toFixed(2)} MP |`);
  P(`| Tokens por foto, nivel estándar | ${Math.round(prom(filas.map((f) => f.tokEst)))} promedio |`);
  P(`| Tokens por foto, alta resolución | ${Math.round(prom(filas.map((f) => f.tokAlta)))} promedio |`);
  P("");
  P("## Costo por foto y por cada mil fotos");
  P("");
  P("| Modelo | Nivel | Tokens por foto | 1 foto | 1000 fotos |");
  P("|---|---|---|---|---|");
  for (const m of Object.keys(PRECIOS_POR_MILLON)) {
    const t = tarifaDe(m);
    if (!t) continue;
    const nv = nivelDe(m);
    const tk = prom(filas.map((f) => (nv === ALTA ? f.tokAlta : f.tokEst)));
    const costo = tk * (t.input / 1e6);
    P(
      `| \`${m}\` | ${nv.nombre} | ${Math.round(tk)} | $${d(costo, 5)} | $${(costo * 1000).toFixed(2)} |`,
    );
  }
  P("");
  P(`Con el modelo que corre hoy (\`${modeloActual}\`, nivel ${nivelActual.nombre}), ver una foto`);
  P(
    `cuesta **$${d(prom(tokActual) * ((tarifaActual?.input ?? 0) / 1e6), 5)}** en promedio, o sea **${Math.round(prom(tokActual))} tokens** de entrada.`,
  );
  P("");
  P("## Por tamaño de imagen");
  P("");
  P("| Tamaño | Cuántas | Tokens estándar | Tokens alta | Se reduce |");
  P("|---|---|---|---|---|");
  const rangos: [string, (f: (typeof filas)[number]) => boolean][] = [
    ["hasta 0.5 MP", (f) => f.mp <= 0.5],
    ["0.5 a 1.2 MP", (f) => f.mp > 0.5 && f.mp <= 1.2],
    ["1.2 a 2.5 MP", (f) => f.mp > 1.2 && f.mp <= 2.5],
    ["más de 2.5 MP", (f) => f.mp > 2.5],
  ];
  for (const [nombre, filtro] of rangos) {
    const g = filas.filter(filtro);
    if (!g.length) {
      P(`| ${nombre} | 0 | — | — | — |`);
      continue;
    }
    const reduce = g.filter((f) => Math.max(f.w, f.h) > ESTANDAR.ladoMax || parches(f.w, f.h) > ESTANDAR.tokensMax);
    P(
      `| ${nombre} | ${g.length} | ${Math.round(prom(g.map((f) => f.tokEst)))} | ${Math.round(
        prom(g.map((f) => f.tokAlta)),
      )} | ${Math.round((reduce.length / g.length) * 100)}% |`,
    );
  }
  P("");
  P("## Lo accionable");
  P("");
  P("Una foto grande **no cuesta más** en el nivel estándar: al pasarse del límite se");
  P("reduce y termina topada cerca de 1560 tokens. O sea que con Haiku, una captura de");
  P("4K y una foto de 1.2 MP cuestan casi lo mismo. Reducir antes de mandar no ahorra");
  P("dinero ahí; sirve para que la respuesta llegue más rápido y para que el texto de");
  P("la captura siga siendo legible después de que Claude la achique.");
  P("");
  P("Donde sí duele es en alta resolución. Ahí la foto grande no se topa tan pronto y");
  P("llega hasta 4784 tokens. Si algún día se mueve el agente a Opus o Sonnet, el costo");
  P("por foto se multiplica por el precio Y por los tokens.");
  P("");
  P("El detalle imagen por imagen está en `imagenes.csv`.");

  const md = lineas.join("\n");
  fs.writeFileSync(path.join(dir, "COSTO-IMAGENES.md"), md, "utf8");
  console.log(md);
  console.log("\nArchivos: medicion/COSTO-IMAGENES.md y medicion/imagenes.csv");
}

// Solo corre si se invoca directo; el simulador lo importa por sus funciones.
if (process.argv[1]?.includes("costo-imagenes")) main();
