/**
 * Simula la conversación completa que se pidió (50 fotos + 50 mensajes de texto)
 * y calcula lo que habría costado, turno por turno.
 *
 * QUÉ ES EXACTO Y QUÉ ES ESTIMADO, porque importa:
 *
 *   Los tokens de IMAGEN son exactos. Salen de la regla publicada por Anthropic
 *   (parches de 28x28 más la reducción por nivel de modelo), y la implementación
 *   se valida contra las 6 filas de ejemplo de su documentación.
 *
 *   Los tokens de TEXTO son ESTIMADOS. Anthropic no publica un tokenizador que
 *   se pueda correr local, así que se calculan por caracteres. La cuenta de
 *   caracteres sí es exacta: sale del system prompt real del tenant y de los
 *   mensajes de la conversación. Lo que se aproxima es la conversión.
 *
 * Cuando la cuenta de Anthropic tenga saldo, `npm run costo:medir` reemplaza la
 * mitad estimada por medición real. Este script no llama a la API ni gasta nada.
 *
 * Uso:  npm run costo:simular
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { TENANTS } from "../lib/tenants";
import { PRECIOS_POR_MILLON, tarifaDe } from "../lib/tokens-precios";
import { medidasDeImagen } from "./medidas-imagen";
import { tokensVisuales, ALTA, ESTANDAR, nivelDe, type Nivel } from "./costo-imagenes";

const TENANT = "miagentia" as const;
const TELEFONO = "75391721";
const IMAGENES = 50;
const MENSAJES_TEXTO = 50;

/**
 * Caracteres por token. En español, con acentos y signos de apertura, el
 * tokenizador rinde peor que en inglés. Se reporta un RANGO en vez de un número
 * solo, para no dar una precisión que no tenemos.
 */
const CHARS_POR_TOKEN = { optimista: 4.0, probable: 3.6, pesimista: 3.2 };

// ── La conversación ───────────────────────────────────────────────────────────

const DEL_CLIENTE = [
  "Hola buenas", "Vi su anuncio en Instagram", "¿Esto qué es exactamente?",
  "Tengo una clínica dental", "Somos cuatro personas nada más",
  "El problema es que se nos acumulan los mensajes",
  "A veces contestamos al otro día", "Y ya para entonces el paciente se fue a otro lado",
  "¿Ustedes cómo lo resuelven?", "¿Contesta solo o hay alguien detrás?",
  "Ah ok", "¿Y cuánto cuesta?", "¿Eso es mensual?",
  "¿En cuánto tiempo queda montado?", "¿Se conecta al número que ya tengo?",
  "Es que el número está en volantes y en el rótulo",
  "No lo podría cambiar", "Perfecto entonces",
  "¿Y si el paciente pregunta algo que el robot no sabe?",
  "Eso me daba miedo la verdad", "¿Puede agendar citas también?",
  "Nosotros llevamos la agenda en papel", "Sí, ya sé, hay que modernizarse",
  "¿Se puede conectar con Google Calendar?", "Déjeme consultarlo con mi socia",
  "¿Tienen algún ejemplo que pueda ver?", "¿Funciona los fines de semana?",
  "Los sábados es cuando más escriben", "Y en la noche también",
  "¿La información de mis pacientes dónde queda?", "Eso es lo que más me preocupa",
  "¿Alguien más puede leer esas conversaciones?", "Ok, eso me deja tranquilo",
  "¿Se puede apagar si algo sale mal?", "¿Y si yo quiero contestar un mensaje?",
  "Buenísimo", "¿Me manda la propuesta por acá?", "¿A qué hora hablamos mañana?",
  "En la mañana mejor", "Antes de las diez si se puede", "Listo",
  "Ah, otra cosa", "¿Atiende en inglés también?", "Tenemos pacientes extranjeros",
  "Excelente", "¿Y si me arrepiento después?", "¿Hay contrato de permanencia?",
  "Ok perfecto", "Muchas gracias", "Nos hablamos mañana entonces",
];

const PIES_DE_FOTO = [
  "Mire", "Le mando esto", "Así se ve", "¿Ve el problema?", "Esto es lo que le decía",
  "Le paso la captura", "Aquí está", "Esto me mandaron", "Una más", "",
];

/** Lo que el agente contesta, para medir la salida. Largo típico de WhatsApp. */
const DEL_AGENTE = [
  "Hola, con gusto le cuento. ¿Cuál es su negocio?",
  "Claro que sí. Le explico rápido cómo funciona.",
  "Entiendo perfecto, eso nos lo dicen mucho.",
  "Sí, se conecta a su mismo número, no tiene que cambiar nada.",
  "Buena pregunta. En ese caso pasa la conversación a su equipo.",
  "Sí señor, puede agendar y le confirma al paciente.",
  "Perfecto, entonces le mando la propuesta por acá.",
  "Con mucho gusto. ¿Le queda bien mañana a las nueve?",
];

// ── Imágenes reales ───────────────────────────────────────────────────────────

const CARPETAS = [
  path.join(os.homedir(), "Pictures", "Screenshots"),
  path.join(os.homedir(), "Downloads"),
];
const EXT: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp",
};

interface Foto { archivo: string; origen: string; w: number; h: number; kb: number }

function juntarFotos(cuantas: number): Foto[] {
  const out: Foto[] = [];
  for (const carpeta of CARPETAS) {
    if (!fs.existsSync(carpeta)) continue;
    const origen = path.basename(carpeta);
    const nombres = fs.readdirSync(carpeta).filter((n) => EXT[path.extname(n).toLowerCase()]);
    const paso = Math.max(1, Math.floor(nombres.length / (cuantas / CARPETAS.length)));
    for (let i = 0; i < nombres.length && out.length < cuantas; i += paso) {
      const ruta = path.join(carpeta, nombres[i]);
      try {
        const st = fs.statSync(ruta);
        if (st.size < 1024) continue;
        const fd = fs.openSync(ruta, "r");
        const buf = Buffer.alloc(Math.min(65536, st.size));
        fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const m = medidasDeImagen(buf, EXT[path.extname(ruta).toLowerCase()]);
        if (!m) continue;
        out.push({ archivo: nombres[i], origen, w: m.w, h: m.h, kb: Math.round(st.size / 1024) });
      } catch { /* se salta */ }
    }
  }
  return out;
}

// ── Simulación ────────────────────────────────────────────────────────────────

interface Turno {
  n: number;
  conv: number;
  tipo: "texto" | "imagen";
  archivo: string;
  ancho: number | null;
  alto: number | null;
  charsPrompt: number; // system + historial + mensaje, exacto
  tokensTexto: number; // estimado
  tokensImagen: number; // exacto
  charsSalida: number;
  tokensSalida: number; // estimado
}

const prom = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const d = (n: number, k = 4) => n.toFixed(k);

function main() {
  const cfg = TENANTS[TENANT];
  const systemChars = cfg.ai.systemPrompt.length;
  const fotos = juntarFotos(IMAGENES);
  if (fotos.length < IMAGENES) {
    console.log(`Aviso: solo se pudieron leer ${fotos.length} imágenes de las ${IMAGENES} pedidas.`);
  }

  const modelo = process.env.AI_MODEL || "claude-haiku-4-5";
  const nivel = nivelDe(modelo);
  const ratio = CHARS_POR_TOKEN.probable;

  // Se arma como pasa de verdad: conversaciones de 10 turnos (el tope del
  // agente), no un solo hilo infinito. El historial crece dentro de cada una.
  const TURNOS_POR_CONV = 10;
  const total = fotos.length + MENSAJES_TEXTO;
  const turnos: Turno[] = [];

  let iFoto = 0, iTexto = 0, iAgente = 0;
  let historialChars = 0;
  let conv = 1;

  for (let n = 1; n <= total; n++) {
    if ((n - 1) % TURNOS_POR_CONV === 0) {
      historialChars = 0; // conversación nueva: el hilo arranca limpio
      if (n > 1) conv++;
    }

    const conFoto = n % 2 === 1 && iFoto < fotos.length;
    const foto = conFoto ? fotos[iFoto++] : null;
    const texto = foto
      ? PIES_DE_FOTO[n % PIES_DE_FOTO.length]
      : DEL_CLIENTE[iTexto++ % DEL_CLIENTE.length];
    const respuesta = DEL_AGENTE[iAgente++ % DEL_AGENTE.length];

    const charsPrompt = systemChars + historialChars + texto.length;
    const tokensImagen = foto ? tokensVisuales(foto.w, foto.h, nivel).tokens : 0;

    turnos.push({
      n, conv,
      tipo: foto ? "imagen" : "texto",
      archivo: foto?.archivo ?? "",
      ancho: foto?.w ?? null,
      alto: foto?.h ?? null,
      charsPrompt,
      tokensTexto: Math.round(charsPrompt / ratio),
      tokensImagen,
      charsSalida: respuesta.length,
      tokensSalida: Math.round(respuesta.length / ratio),
    });

    // El turno del cliente y el del agente quedan en el historial del siguiente.
    historialChars += texto.length + respuesta.length;
  }

  const conImg = turnos.filter((t) => t.tipo === "imagen");
  const soloTxt = turnos.filter((t) => t.tipo === "texto");

  const dir = path.join(process.cwd(), "medicion");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "conversacion-simulada.csv"),
    [
      "turno,conversacion,tipo,archivo,ancho,alto,chars_prompt,tokens_texto_est,tokens_imagen_exacto,tokens_salida_est",
      ...turnos.map((t) =>
        [t.n, t.conv, t.tipo, `"${t.archivo}"`, t.ancho ?? "", t.alto ?? "",
         t.charsPrompt, t.tokensTexto, t.tokensImagen, t.tokensSalida].join(","),
      ),
    ].join("\n"),
    "utf8",
  );

  const L: string[] = [];
  const P = (s = "") => L.push(s);

  P("# Conversación simulada: 50 fotos y 50 mensajes");
  P("");
  P(`Simulada desde el ${TELEFONO} contra el guion real del tenant \`${TENANT}\`,`);
  P(`en ${conv} conversaciones de ${TURNOS_POR_CONV} turnos (el tope del agente).`);
  P("");
  P("## Antes de leer los números");
  P("");
  P("**Los tokens de imagen son exactos.** Salen de la regla publicada por Anthropic,");
  P("y la implementación reproduce las 6 filas de ejemplo de su documentación.");
  P("");
  P("**Los tokens de texto son estimados.** Anthropic no publica un tokenizador que se");
  P(`pueda correr local, así que se calculan por caracteres (${ratio} por token). La cuenta`);
  P("de caracteres sí es exacta: sale del guion real y de los mensajes. Lo aproximado es");
  P("la conversión, y por eso más abajo va un rango en vez de un número solo.");
  P("");
  P("## El costo de la conversación completa");
  P("");
  P("| Modelo | Los 50 textos | Las 50 fotos | Total |");
  P("|---|---|---|---|");
  for (const m of Object.keys(PRECIOS_POR_MILLON)) {
    const t = tarifaDe(m);
    if (!t) continue;
    const nv = nivelDe(m);
    // Los tokens de imagen se recalculan por modelo: el nivel cambia el conteo.
    const imgTok = conImg.map((x) => (x.ancho && x.alto ? tokensVisuales(x.ancho, x.alto, nv).tokens : 0));
    const cTxt =
      suma(soloTxt.map((x) => x.tokensTexto)) * (t.input / 1e6) +
      suma(soloTxt.map((x) => x.tokensSalida)) * (t.output / 1e6);
    const cImg =
      suma(conImg.map((x) => x.tokensTexto)) * (t.input / 1e6) +
      suma(imgTok) * (t.input / 1e6) +
      suma(conImg.map((x) => x.tokensSalida)) * (t.output / 1e6);
    P(`| \`${m}\` | $${d(cTxt)} | $${d(cImg)} | **$${d(cTxt + cImg)}** |`);
  }
  P("");
  const tAct = tarifaDe(modelo)!;
  const costoTxt = prom(soloTxt.map((x) => x.tokensTexto)) * (tAct.input / 1e6) +
    prom(soloTxt.map((x) => x.tokensSalida)) * (tAct.output / 1e6);
  const costoImgExtra = prom(conImg.map((x) => x.tokensImagen)) * (tAct.input / 1e6);
  P(`Con \`${modelo}\`, que es el que corre hoy:`);
  P("");
  P(`- Contestar un mensaje de texto: **$${d(costoTxt, 5)}**`);
  P(`- Lo que suma la foto encima de eso: **$${d(costoImgExtra, 5)}**`);
  P(`- O sea que un turno con foto cuesta cerca de **${(1 + costoImgExtra / costoTxt).toFixed(1)}x** uno de texto.`);
  P("");
  P("## Qué pesa en el costo de escribir");
  P("");
  P(`El guion del agente son **${systemChars.toLocaleString("es")} caracteres** y viaja completo en CADA turno.`);
  P(`Eso solo ya son ~${Math.round(systemChars / ratio).toLocaleString("es")} tokens de entrada antes de que el cliente escriba una letra.`);
  P("");
  P("| De dónde salen los tokens de entrada | Promedio por turno | Peso |");
  P("|---|---|---|");
  const promPrompt = prom(turnos.map((t) => t.tokensTexto));
  const sysTok = systemChars / ratio;
  P(`| El guion del agente | ${Math.round(sysTok)} | ${Math.round((sysTok / promPrompt) * 100)}% |`);
  P(`| El historial de la conversación | ${Math.round(promPrompt - sysTok)} | ${Math.round(((promPrompt - sysTok) / promPrompt) * 100)}% |`);
  P("");
  P("Por eso el mensaje del cliente casi no mueve la aguja: lo caro es el guion, que se");
  P("repite entero cada vez. Ahí es donde el caché de Anthropic haría la diferencia");
  P("grande, porque leer de caché cuesta la décima parte.");
  P("");
  P("## Rango, por la parte estimada");
  P("");
  P("| Caracteres por token | Costo total de la conversación |");
  P("|---|---|");
  for (const [nombre, r] of Object.entries(CHARS_POR_TOKEN)) {
    const inTok = suma(turnos.map((t) => t.charsPrompt / r)) + suma(conImg.map((t) => t.tokensImagen));
    const outTok = suma(turnos.map((t) => t.charsSalida / r));
    P(`| ${r} (${nombre}) | $${d(inTok * (tAct.input / 1e6) + outTok * (tAct.output / 1e6))} |`);
  }
  P("");
  P("El detalle turno por turno está en `conversacion-simulada.csv`.");
  P("");
  P("Cuando la cuenta de Anthropic tenga saldo, `npm run costo:medir` corre esta misma");
  P("conversación de verdad contra la API y reemplaza la mitad estimada por medición.");

  const md = L.join("\n");
  fs.writeFileSync(path.join(dir, "CONVERSACION-SIMULADA.md"), md, "utf8");
  console.log(md);
}

main();
