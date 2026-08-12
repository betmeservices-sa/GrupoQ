// El dictado del teléfono, sin la bola de nieve.
//
// EL BUG QUE ARREGLA: SpeechRecognition con interimResults manda, en cada
// evento, la frase completa que lleva reconocida hasta ese momento. Y en Android
// muchas veces la manda marcada como definitiva, una y otra vez, mientras crece.
// Quien concatene lo que llega termina con esto, que es lo que le salió al
// agente en su teléfono:
//
//   es una / es una casa / es una casa de / es una casa de 600 / ...
//
// LA REGLA: lo definitivo se ESCRIBE en su índice de resultado, nunca se suma;
// lo provisional se REEMPLAZA en cada evento y solo sirve para ver en vivo lo
// que se está diciendo. Al juntar los tramos, el que empieza con el anterior lo
// pisa: así, aunque el motor mande la frase que crece en índices distintos, el
// texto queda UNA sola vez.
//
// LOS REINICIOS: en el teléfono el reconocimiento se corta solo a los pocos
// segundos y hay que reanudarlo. Al reanudar, el motor vuelve al índice 0 con
// resultados nuevos. Por eso lo ya dicho se CIERRA en una lista aparte y el
// tramo nuevo sigue desde ahí, en vez de reiniciar el acumulado (que duplicaría
// todo) o de pisarlo (que lo perdería).

import { normalizar } from "./inmobiliaria-dictado";

// La forma mínima de lo que manda el navegador. Se declara aquí para poder
// inyectar eventos a mano en los tests sin arrastrar los tipos del DOM.
export interface AlternativaVoz {
  transcript: string;
}

export type ResultadoVoz = ArrayLike<AlternativaVoz> & { isFinal: boolean };

export interface EventoVoz {
  results: ArrayLike<ResultadoVoz>;
  resultIndex?: number;
}

// Para comparar dos tramos sin que la puntuación que mete el motor ("es una
// casa." contra "es una casa") los haga parecer distintos.
function clave(s: string): string {
  return normalizar(s)
    .replace(/[.,;:!?¿¡]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Junta los tramos resolviendo el solapamiento:
//   - si el tramo nuevo es el anterior pero más largo, lo reemplaza;
//   - si lo que trae ya está al final de lo que hay, se descarta;
//   - si no, se agrega.
// El corte se exige en palabra completa: "es un" NO se considera comienzo de
// "es una casa" (sería otra frase), pero "es una" sí lo es de "es una casa".
export function fusionar(partes: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  for (const cruda of partes) {
    const frase = (cruda ?? "").replace(/\s+/g, " ").trim();
    if (!frase) continue;
    const previa = out[out.length - 1];
    if (previa) {
      const a = clave(previa);
      const b = clave(frase);
      if (!b) continue;
      if (a === b || a.endsWith(` ${b}`)) continue; // ya lo dijo
      if (b.startsWith(`${a} `)) {
        out[out.length - 1] = frase; // la misma frase, ahora completa
        continue;
      }
    }
    out.push(frase);
  }
  return out;
}

export function unirFrases(partes: Array<string | undefined | null>): string {
  return fusionar(partes).join(" ");
}

export interface Acumulador {
  // Procesa un evento del motor y devuelve el texto para mostrar.
  recibir(e: EventoVoz): string;
  // Cierra el tramo: lo dicho queda firme. Se llama en cada reinicio del motor
  // y al terminar el dictado.
  cerrar(): string;
  // Lo que el agente escribió o corrigió a mano pasa a ser el punto de partida.
  fijar(texto: string): void;
  texto(): string;
}

export function crearAcumulador(inicial = ""): Acumulador {
  // Tramos ya firmes: lo de sesiones anteriores del motor y lo escrito a mano.
  let cerrados: string[] = inicial.trim() ? [inicial.trim()] : [];
  // Definitivos de la sesión en curso, POR ÍNDICE de resultado. Escribir en el
  // índice (y no empujar al final) es lo que hace que reenviar el mismo
  // resultado más largo lo corrija en vez de duplicarlo.
  let finales: string[] = [];
  // Lo que se está diciendo ahora mismo. Se reemplaza entero en cada evento.
  let provisional = "";

  const armar = () => unirFrases([...cerrados, ...finales, provisional]);

  return {
    recibir(e) {
      const total = e.results?.length ?? 0;
      const crudo = Number(e.resultIndex);
      const pedido = Number.isFinite(crudo) && crudo > 0 ? Math.floor(crudo) : 0;
      // Al abrir la sesión todavía no hay nada guardado: se lee desde el
      // principio aunque el motor diga que arranque más adelante.
      const desde = finales.length === 0 ? 0 : Math.min(pedido, total);

      const enVivo: string[] = [];
      for (let i = desde; i < total; i++) {
        const r = e.results[i];
        const frase = (r?.[0]?.transcript ?? "").replace(/\s+/g, " ").trim();
        if (!frase) continue;
        if (r.isFinal) {
          finales[i] = frase;
        } else {
          enVivo.push(frase);
        }
      }
      provisional = enVivo.join(" ");
      return armar();
    },

    cerrar() {
      // Se guardan como tramos sueltos, no como un solo texto: así el primer
      // resultado del motor reanudado todavía puede corregir al último tramo si
      // resulta ser la misma frase, ahora completa.
      cerrados = fusionar([...cerrados, ...finales, provisional]);
      finales = [];
      provisional = "";
      return cerrados.join(" ");
    },

    fijar(texto) {
      const limpio = (texto ?? "").trim();
      cerrados = limpio ? [limpio] : [];
      finales = [];
      provisional = "";
    },

    texto: armar,
  };
}
