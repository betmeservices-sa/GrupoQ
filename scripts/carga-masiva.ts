/**
 * Banco de pruebas de carga: cuánto cuesta atender volumen de verdad.
 *
 * Corre el MISMO código que producción (lib/ai.ts para responder,
 * con el guion de Sofía, sus
 * herramientas y su inventario. Lo único que no toca es WhatsApp: no se manda
 * ni un mensaje a Meta.
 *
 * Por qué no se pasa por el webhook: mandar 3000 mensajes reales cuesta
 * conversaciones de Meta, tarda horas por el debounce del agente, castiga la
 * calificación del número y le llena el teléfono a alguien. El costo que se
 * quiere medir es el de los modelos, y ese se mide llamándolos.
 *
 * NO escribe en la tabla de consumo: 3000 filas de prueba arruinarían el panel
 * del cliente. Todo se acumula acá y sale en un informe.
 *
 * Uso:
 *   node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/carga-masiva.ts \
 *     --texto 3000 --imagenes 100
 *
 *   --texto N      mensajes de texto respondidos por el agente
 *   --imagenes N   fotos enviadas al agente
 *   --conc N       cuántas en paralelo (por defecto 6)
 *   --salida ruta  dónde escribir el informe JSON
 */
import fs from "node:fs";
import path from "node:path";
import { generarRespuesta, type TurnoIA } from "../lib/ai";
import { costoDeUso, tokensPrompt, type UsoTokens } from "../lib/tokens-precios";
import { TENANTS } from "../lib/tenants";

const TENANT = "yaly" as const;
const SEDES = TENANTS.yaly.sucursales!.opciones;

// ── Corpus: lo que de verdad le escriben a un hotel de playa ──
// Mezcla a propósito mensajes de una línea y otros con fechas y cantidades, que
// es lo que dispara las herramientas y encarece el turno.
const APERTURAS = [
  "Hola, buenas tardes",
  "Buenas, quisiera información",
  "Hola! vi su Instagram",
  "Buen día",
  "Hola, me recomendaron el hotel",
];

const CUERPOS = [
  "¿Tienen habitaciones disponibles para el fin de semana?",
  "Somos 2 adultos y 2 niños, ¿qué me recomienda?",
  "Quiero reservar del 22 al 26 de agosto, somos cuatro",
  "¿Cuánto sale la noche para dos personas?",
  "¿El desayuno está incluido?",
  "¿Tienen piscina?",
  "¿Aceptan mascotas?",
  "¿A qué hora es el check in?",
  "¿Hay parqueo?",
  "¿Queda lejos de San Salvador?",
  "¿Tienen habitación con vista al mar?",
  "Necesito dos habitaciones con camas dobles",
  "¿Puedo pagar con tarjeta?",
  "¿Tienen salón para un evento de 40 personas?",
  "¿Se puede llegar en carro normal o necesito 4x4?",
  "¿Hay wifi en las habitaciones?",
  "¿Cuál es la política de cancelación?",
  "Vamos por el fin de semana largo, ¿queda algo?",
  "¿Tienen alguna promoción este mes?",
  "¿El restaurante abre para los que no se hospedan?",
  "Quiero algo tranquilo, sin niños alrededor",
  "¿Cuántas personas caben en el apartamento?",
  "Somos un grupo de 8, ¿nos pueden acomodar?",
  "¿Se puede hacer check out tarde?",
  "¿Hay tabla de surf para alquilar?",
];

const SEGUIMIENTOS = [
  "Perfecto, ¿y cuánto sería el total?",
  "Me interesa, ¿cómo hago la reserva?",
  "Déjeme consultarlo con mi esposa",
  "¿Y si somos uno más?",
  "¿Tiene algo más económico?",
  "Ok, resérvemela por favor",
  "¿Me lo puede confirmar por escrito?",
  "Gracias, lo pienso y le aviso",
];

function elegir<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** Conversación realista: apertura, consulta, y a veces seguimiento. */
function conversacion(i: number): { sede: (typeof SEDES)[number]; turnos: string[] } {
  const largo = 1 + (i % 4); // de 1 a 4 mensajes del huésped
  const turnos: string[] = [];
  turnos.push(`${elegir(APERTURAS, i)}. ${elegir(CUERPOS, i)}`);
  for (let t = 1; t < largo; t++) {
    turnos.push(t === 1 ? elegir(CUERPOS, i + t * 7) : elegir(SEGUIMIENTOS, i + t));
  }
  return { sede: elegir(SEDES, i), turnos };
}

// ── Acumulador ──
/** Una unidad medida: un mensaje, una nota de voz o una foto. */
interface Unidad {
  i: number;
  que: string; // qué se le mandó, en corto
  modelo: string;
  llamadas: number;
  entrada: number;
  salida: number;
  tokensImagen: number;
  costo: number;
  ms: number;
}

interface Acumulado {
  n: number;
  llamadas: number;
  entrada: number;
  salida: number;
  tokensImagen: number;
  costo: number;
  ms: number[];
  errores: number;
  /** Fila por fila. Es lo que permite mirar UNA unidad y no solo el promedio. */
  unidades: Unidad[];
}

function vacio(): Acumulado {
  return { n: 0, llamadas: 0, entrada: 0, salida: 0, tokensImagen: 0, costo: 0, ms: [], errores: 0, unidades: [] };
}

function sumar(
  a: Acumulado,
  uso: UsoTokens,
  modelo: string,
  llamadas: number,
  ms: number,
  tokensImagen = 0,
  que = "",
) {
  a.n += 1;
  a.llamadas += llamadas;
  a.entrada += tokensPrompt(uso);
  a.salida += uso.output_tokens;
  a.tokensImagen += tokensImagen;
  const costo = costoDeUso(uso, modelo).total;
  a.costo += costo;
  a.ms.push(ms);
  a.unidades.push({
    i: a.n,
    que,
    modelo,
    llamadas,
    entrada: tokensPrompt(uso),
    salida: uso.output_tokens,
    tokensImagen,
    costo,
    ms,
  });
}

function percentil(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const o = [...xs].sort((x, y) => x - y);
  return o[Math.min(o.length - 1, Math.floor((o.length - 1) * p))];
}

// Corre `tareas` con como mucho `conc` en vuelo. Sin esto, 3000 llamadas juntas
// se comen el rate limit y lo que se mide son los errores, no el costo.
async function enTandas<T>(tareas: (() => Promise<T>)[], conc: number, alAvanzar: () => void) {
  const resultados: T[] = [];
  let i = 0;
  const obreros = Array.from({ length: Math.min(conc, tareas.length) }, async () => {
    while (i < tareas.length) {
      const mio = i++;
      try {
        resultados[mio] = await tareas[mio]();
      } catch (e) {
        console.error("tarea", mio, "falló:", e instanceof Error ? e.message : e);
      }
      alAvanzar();
    }
  });
  await Promise.all(obreros);
  return resultados;
}

// OJO con el `||`: `--imagenes 0` es cero, no "sin valor". Con el fallback
// ingenuo, pedir cero imagenes corria el valor por defecto igual.
function arg(nombre: string, def: number): number {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i < 0) return def;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : def;
}

async function main() {
  const nTexto = arg("texto", 30);
  const nImagenes = arg("imagenes", 5);
  const conc = arg("conc", 6);
  const iSalida = process.argv.indexOf("--salida");
  const salida = iSalida > 0 ? process.argv[iSalida + 1] : "medicion/carga-masiva.json";

  const texto = vacio();
  const imagenes = vacio();
  const arranque = Date.now();

  let hechos = 0;
  const total = nTexto + nImagenes;
  const avanzar = () => {
    hechos++;
    if (hechos % 25 === 0 || hechos === total) {
      const seg = (Date.now() - arranque) / 1000;
      process.stdout.write(
        `\r  ${hechos}/${total} · ${(hechos / seg).toFixed(1)}/s · $${(texto.costo + imagenes.costo).toFixed(4)}   `,
      );
    }
  };

  // ── TEXTO ──
  if (nTexto > 0) {
    console.log(`\nTEXTO: ${nTexto} mensajes respondidos por el agente`);
    const tareas: (() => Promise<void>)[] = [];
    let mensaje = 0;
    for (let c = 0; mensaje < nTexto; c++) {
      const conv = conversacion(c);
      const historial: TurnoIA[] = [];
      for (const t of conv.turnos) {
        if (mensaje >= nTexto) break;
        mensaje++;
        const propio = [...historial, { autor: "cliente" as const, texto: t }];
        historial.push({ autor: "cliente", texto: t });
        historial.push({ autor: "staff", texto: "(respuesta)" });
        tareas.push(async () => {
          const t0 = Date.now();
          try {
            const r = await generarRespuesta(propio, undefined, {
              telefono: "50300000000",
              tenantId: TENANT,
              sucursal: conv.sede,
            });
            sumar(texto, r.uso, r.modelo, r.llamadas, Date.now() - t0, 0, t);
          } catch {
            texto.errores++;
          }
        });
      }
    }
    await enTandas(tareas, conc, avanzar);
  }

  // ── IMÁGENES ──
  if (nImagenes > 0) {
    const dir = "public/inmobiliaria";
    const fotos = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    console.log(`\nIMÁGENES: ${nImagenes} fotos al agente (de ${fotos.length} distintas)`);
    const tareas: (() => Promise<void>)[] = [];
    for (let i = 0; i < nImagenes; i++) {
      const archivo = path.join(dir, fotos[i % fotos.length]);
      const conv = conversacion(i + 500);
      tareas.push(async () => {
        const t0 = Date.now();
        try {
          const buf = fs.readFileSync(archivo);
          const historial: TurnoIA[] = [
            {
              autor: "cliente",
              texto: "[imagen] Me gustó esta habitación, ¿la tienen disponible?",
              imagenes: [{ base64: buf.toString("base64"), mime: "image/jpeg" }],
            },
          ];
          const r = await generarRespuesta(historial, undefined, {
            telefono: "50300000000",
            tenantId: TENANT,
            sucursal: conv.sede,
          });
          sumar(imagenes, r.uso, r.modelo, r.llamadas, Date.now() - t0, r.tokensImagen, path.basename(archivo));
        } catch {
          imagenes.errores++;
        }
      });
    }
    await enTandas(tareas, conc, avanzar);
  }

  // ── Informe ──
  const seg = (Date.now() - arranque) / 1000;
  const bloques = [
    { nombre: "texto", unidad: "mensaje", a: texto },
    { nombre: "imagenes", unidad: "foto", a: imagenes },
  ];

  console.log("\n\n" + "=".repeat(72));
  console.log("RESULTADO");
  console.log("=".repeat(72));
  for (const b of bloques) {
    if (b.a.n === 0) continue;
    console.log(`\n${b.nombre.toUpperCase()}  (${b.a.n} ${b.unidad}s, ${b.a.errores} fallos)`);
    console.log(`  tokens entrada  ${b.a.entrada.toLocaleString()}`);
    console.log(`  tokens salida   ${b.a.salida.toLocaleString()}`);
    if (b.a.tokensImagen) console.log(`  de imagen       ${b.a.tokensImagen.toLocaleString()}`);
    console.log(`  llamadas        ${b.a.llamadas}`);
    console.log(`  costo TOTAL     $${b.a.costo.toFixed(6)}`);
    console.log(`  costo por ${b.unidad.padEnd(12)} $${(b.a.costo / b.a.n).toFixed(6)}`);
    console.log(`  latencia        p50 ${percentil(b.a.ms, 0.5)} ms · p95 ${percentil(b.a.ms, 0.95)} ms`);
  }
  const costoTotal = bloques.reduce((s, b) => s + b.a.costo, 0);
  console.log("\n" + "-".repeat(72));
  console.log(`TOTAL: $${costoTotal.toFixed(6)}  en ${seg.toFixed(0)} s`);

  const informe = {
    generado: new Date().toISOString(),
    segundos: seg,
    bloques: bloques.map((b) => ({
      nombre: b.nombre,
      n: b.a.n,
      errores: b.a.errores,
      llamadas: b.a.llamadas,
      tokensEntrada: b.a.entrada,
      tokensSalida: b.a.salida,
      tokensImagen: b.a.tokensImagen,
      costo: b.a.costo,
      costoUnitario: b.a.n ? b.a.costo / b.a.n : 0,
      p50ms: percentil(b.a.ms, 0.5),
      p95ms: percentil(b.a.ms, 0.95),
      unidades: b.a.unidades,
    })),
    costoTotal,
  };
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, JSON.stringify(informe, null, 2), "utf8");
  console.log(`informe: ${salida}`);
}

main();
