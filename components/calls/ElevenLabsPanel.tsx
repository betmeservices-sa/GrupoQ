"use client";

import { useEffect, useMemo, useState } from "react";
import { Mic } from "lucide-react";
import { resumirLlamadas } from "@/lib/calls-metrics";
import type { ConsumoEleven, CuotaEleven } from "@/lib/elevenlabs";
import type { CallRecord } from "@/lib/data/types";

interface Respuesta {
  configurado: boolean;
  cuota: CuotaEleven | null;
  consumo: ConsumoEleven | null;
  error?: string;
}

interface Props {
  calls: CallRecord[];
  tarifaCarrier: number;
}

type Rango =
  | "hoy"
  | "ayer"
  | "7dias"
  | "semana-pasada"
  | "mes"
  | "mes-pasado"
  | "todo"
  | "personalizado";

const ETIQUETAS: { valor: Rango; texto: string }[] = [
  { valor: "hoy", texto: "Hoy" },
  { valor: "ayer", texto: "Ayer" },
  { valor: "7dias", texto: "Últimos 7 días" },
  { valor: "semana-pasada", texto: "Semana pasada" },
  { valor: "mes", texto: "Este mes" },
  { valor: "mes-pasado", texto: "Mes pasado" },
  { valor: "todo", texto: "Todo el tiempo" },
  { valor: "personalizado", texto: "Personalizado" },
];

const fmtNum = (n: number) => n.toLocaleString("es-SV");
const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

function fmtFecha(unix: number | null): string {
  if (!unix) return "sin fecha";
  return new Date(unix * 1000).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "2026-08-14" -> "14 ago". Se parte el texto en vez de usar Date para que no
// lo interprete como UTC medianoche y muestre el dia anterior.
function fmtDiaCorto(dia: string): string {
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [, m, d] = dia.split("-").map(Number);
  return `${d} ${MESES[m - 1] ?? ""}`;
}

function fmtDuracion(seg: number): string {
  if (seg <= 0) return "0s";
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const inicioDia = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const finDia = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const masDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

// Los limites se calculan en la hora LOCAL de quien mira y recien ahi se
// mandan como unix. Resolverlos en el servidor daria el "hoy" de UTC.
function limites(rango: Rango, desdeTxt: string, hastaTxt: string): [number | null, number | null] {
  const hoy = new Date();
  switch (rango) {
    case "hoy":
      return [unix(inicioDia(hoy)), unix(finDia(hoy))];
    case "ayer": {
      const a = masDias(hoy, -1);
      return [unix(inicioDia(a)), unix(finDia(a))];
    }
    case "7dias":
      return [unix(inicioDia(masDias(hoy, -6))), unix(finDia(hoy))];
    case "semana-pasada": {
      const dowLunes = (hoy.getDay() + 6) % 7; // 0 = lunes
      const lunesEsta = inicioDia(masDias(hoy, -dowLunes));
      return [unix(masDias(lunesEsta, -7)), unix(finDia(masDias(lunesEsta, -1)))];
    }
    case "mes": {
      const p = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return [unix(inicioDia(p)), unix(finDia(hoy))];
    }
    case "mes-pasado": {
      const p = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const u = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return [unix(inicioDia(p)), unix(finDia(u))];
    }
    case "personalizado": {
      // input type=date entrega YYYY-MM-DD; se parsea por partes para que no
      // lo tome como UTC medianoche y corra un dia.
      const parse = (s: string) => {
        const [a, m, d] = s.split("-").map(Number);
        return a && m && d ? new Date(a, m - 1, d) : null;
      };
      const d1 = parse(desdeTxt);
      const d2 = parse(hastaTxt);
      return [d1 ? unix(inicioDia(d1)) : null, d2 ? unix(finDia(d2)) : null];
    }
    case "todo":
    default:
      return [null, null];
  }
}

const claveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Rellena los dias sin consumo. Un histórico con huecos saltados miente sobre
// el ritmo: se veria igual de denso un mes activo que uno con tres dias sueltos.
//
// Cuando hay rango pedido, el eje va de punta a punta del RANGO y no del primer
// al ultimo dia con datos. Si no, elegir "mes pasado" y ver el eje arrancando
// el 5 de agosto haria pensar que agosto empezo ahi. En "todo el tiempo" no hay
// limites, asi que ahi si manda la extension de los datos.
function serieContinua(
  porDia: { dia: string; caracteres: number }[],
  desdeUnix: number | null,
  hastaUnix: number | null,
) {
  if (porDia.length === 0) return [];
  const aFecha = (s: string) => {
    const [a, m, d] = s.split("-").map(Number);
    return new Date(a, m - 1, d);
  };
  const mapa = new Map(porDia.map((p) => [p.dia, p.caracteres]));

  const arranque = desdeUnix !== null ? inicioDia(new Date(desdeUnix * 1000)) : aFecha(porDia[0].dia);
  // Nunca pasado hoy: un mes en curso no debe dibujar los dias que no llegaron.
  const cierre =
    hastaUnix !== null
      ? inicioDia(new Date(Math.min(hastaUnix * 1000, Date.now())))
      : aFecha(porDia[porDia.length - 1].dia);

  const salida: { dia: string; caracteres: number }[] = [];
  for (let d = arranque; d <= cierre; d = masDias(d, 1)) {
    const clave = claveDia(d);
    salida.push({ dia: clave, caracteres: mapa.get(clave) ?? 0 });
  }
  return salida;
}

export function ElevenLabsPanel({ calls, tarifaCarrier }: Props) {
  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rango, setRango] = useState<Rango>("todo");
  const [desdeTxt, setDesdeTxt] = useState("");
  const [hastaTxt, setHastaTxt] = useState("");
  const [hover, setHover] = useState<number | null>(null);

  const [desde, hasta] = useMemo(
    () => limites(rango, desdeTxt, hastaTxt),
    [rango, desdeTxt, hastaTxt],
  );

  // En personalizado no se pide nada hasta que estén las dos fechas: si no,
  // cada tecla dispararia una consulta con un rango a medio escribir.
  const listo = rango !== "personalizado" || (Boolean(desdeTxt) && Boolean(hastaTxt));

  useEffect(() => {
    if (!listo) return;
    let cancelado = false;
    setCargando(true);
    const q = new URLSearchParams({ offset: String(new Date().getTimezoneOffset()) });
    if (desde !== null) q.set("desde", String(desde));
    if (hasta !== null) q.set("hasta", String(hasta));
    fetch(`/api/elevenlabs?${q.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelado) {
          setData(d);
          setCargando(false);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setData(null);
          setCargando(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [desde, hasta, listo]);

  const consumo = data?.consumo;

  // Las llamadas del MISMO rango, con el mismo criterio de fecha que usa el
  // resto de la pagina (creada, y si no hay, inicio).
  const metricas = useMemo(() => {
    const dentro = calls.filter((c) => {
      const ts = c.creada ?? c.inicio;
      if (!ts) return false;
      const t = new Date(ts).getTime() / 1000;
      if (desde !== null && t < desde) return false;
      if (hasta !== null && t > hasta) return false;
      return true;
    });
    return resumirLlamadas(dentro, tarifaCarrier);
  }, [calls, desde, hasta, tarifaCarrier]);

  const serie = useMemo(
    () => serieContinua(consumo?.porDia ?? [], desde, hasta),
    [consumo, desde, hasta],
  );
  const tope = useMemo(() => Math.max(1, ...serie.map((p) => p.caracteres)), [serie]);

  const etiquetaRango = ETIQUETAS.find((o) => o.valor === rango)?.texto.toLowerCase() ?? "";

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Mic size={16} />
          </span>
          <h2 className="text-sm font-bold text-[var(--text)]">Voz (ElevenLabs)</h2>
        </div>
        <select
          value={rango}
          onChange={(e) => setRango(e.target.value as Rango)}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-[var(--text)] outline-none"
          aria-label="Rango de fechas"
        >
          {ETIQUETAS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      </div>

      {rango === "personalizado" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={desdeTxt}
            max={hastaTxt || undefined}
            onChange={(e) => setDesdeTxt(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-[var(--text)] outline-none"
            aria-label="Desde"
          />
          <span className="text-xs text-[var(--text-3)]">a</span>
          <input
            type="date"
            value={hastaTxt}
            min={desdeTxt || undefined}
            onChange={(e) => setHastaTxt(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-[var(--text)] outline-none"
            aria-label="Hasta"
          />
        </div>
      )}

      {!listo && (
        <p className="text-xs text-[var(--text-3)]">Elegí las dos fechas para ver el consumo.</p>
      )}

      {listo && cargando && (
        <p className="text-xs text-[var(--text-3)]">Cargando consumo de voz...</p>
      )}

      {listo && !cargando && data && !data.configurado && (
        <p className="text-xs text-[var(--text-3)]">
          Cuota no disponible: falta <code>ELEVENLABS_API_KEY</code> en este entorno.
        </p>
      )}

      {listo && !cargando && data?.configurado && !data.cuota && !data.consumo && (
        <p className="text-xs text-amber-700">
          No se pudo leer la cuota de ElevenLabs{data.error ? ` (${data.error})` : ""}.
        </p>
      )}

      {listo && !cargando && consumo && (
        <>
          <p className="text-[26px] font-extrabold leading-none tracking-tight text-[var(--text)]">
            {fmtNum(consumo.caracteres)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-3)]">
            caracteres en {etiquetaRango}
            {consumo.generaciones > 0 && ` · ${fmtNum(consumo.generaciones)} generaciones`}
          </p>

          {/* Histórico diario. Una sola serie, asi que no lleva leyenda: el
              titulo la nombra. El valor exacto vive en el hover. */}
          {serie.length > 1 && (
            <div className="relative mt-4">
              {hover !== null && serie[hover] && (
                <div className="pointer-events-none absolute -top-1 left-0 right-0 z-10 flex justify-center">
                  <span className="rounded-lg border border-line bg-card px-2 py-1 text-[11px] font-semibold text-[var(--text)] shadow-sm">
                    {fmtDiaCorto(serie[hover].dia)}: {fmtNum(serie[hover].caracteres)} caracteres
                  </span>
                </div>
              )}
              <div className="flex h-16 items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
                {serie.map((p, i) => (
                  <div
                    key={p.dia}
                    onMouseEnter={() => setHover(i)}
                    className="flex h-full flex-1 cursor-default items-end"
                    title={`${fmtDiaCorto(p.dia)}: ${fmtNum(p.caracteres)}`}
                  >
                    <div
                      className={`w-full rounded-t ${
                        hover === i ? "bg-brand" : "bg-brand/55"
                      } transition-colors`}
                      style={{
                        height:
                          p.caracteres > 0
                            ? `${Math.max(6, (p.caracteres / tope) * 100)}%`
                            : "2px",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--text-3)]">
                <span>{fmtDiaCorto(serie[0].dia)}</span>
                <span>pico {fmtNum(tope)}</span>
                <span>{fmtDiaCorto(serie[serie.length - 1].dia)}</span>
              </div>
            </div>
          )}

          {/* Notas de análisis: cruce con las llamadas del MISMO rango. */}
          <div className="mt-4 rounded-xl bg-surface p-3 text-[11px] leading-relaxed text-[var(--text-3)]">
            {metricas.conectadas > 0 ? (
              <>
                <p>
                  <strong className="text-[var(--text)]">{fmtNum(metricas.conectadas)}</strong>{" "}
                  llamadas conectadas de{" "}
                  <strong className="text-[var(--text)]">
                    {fmtDuracion(metricas.duracionPromedioSeg)}
                  </strong>{" "}
                  en promedio consumieron{" "}
                  <strong className="text-[var(--text)]">{fmtNum(consumo.caracteres)}</strong>{" "}
                  caracteres de voz y costaron{" "}
                  <strong className="text-[var(--text)]">{fmtUsd(metricas.costoTotal)}</strong> en
                  Vapi.
                </p>
                <p className="mt-1">
                  Son {fmtNum(Math.round(consumo.caracteres / metricas.conectadas))} caracteres y{" "}
                  {fmtUsd(metricas.costoTotal / metricas.conectadas)} por llamada
                  {metricas.minutosTotales > 0 && (
                    <>
                      , sobre {fmtNum(Math.round(metricas.minutosTotales))} minutos hablados (
                      {fmtNum(Math.round(consumo.caracteres / metricas.minutosTotales))} caracteres
                      por minuto)
                    </>
                  )}
                  .
                </p>
                {metricas.caracteresTTS > 0 && (
                  <p className="mt-1">
                    Vapi contó {fmtNum(metricas.caracteresTTS)} caracteres para estas llamadas. La
                    diferencia con los {fmtNum(consumo.caracteres)} de arriba es normal: Vapi cuenta
                    el texto que manda a sintetizar y ElevenLabs factura lo que realmente genera.
                  </p>
                )}
              </>
            ) : (
              <p>Sin llamadas conectadas en {etiquetaRango}, así que no hay nada que cruzar.</p>
            )}
          </div>
        </>
      )}

      {listo && !cargando && data?.cuota && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-2 flex items-end justify-between">
            <p className="text-xs font-semibold text-[var(--text)]">Plan {data.cuota.tier}</p>
            <span className="text-xs font-bold text-[var(--text)]">
              {(data.cuota.porcentaje * 100).toFixed(1)}%
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-surface">
            <div
              className={`h-2 rounded-full ${
                data.cuota.porcentaje >= 0.9
                  ? "bg-red-500"
                  : data.cuota.porcentaje >= 0.75
                    ? "bg-amber-500"
                    : "bg-brand"
              }`}
              style={{ width: `${Math.min(100, data.cuota.porcentaje * 100)}%` }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-[var(--text)]">{fmtNum(data.cuota.restantes)}</p>
              <p className="text-[var(--text-3)]">Caracteres restantes</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--text)]">{fmtFecha(data.cuota.reinicioUnix)}</p>
              <p className="text-[var(--text-3)]">Reinicio de cuota</p>
            </div>
          </div>

          <p className="mt-3 rounded-xl bg-surface p-2 text-[11px] text-[var(--text-3)]">
            La barra es del período de facturación en curso y no sigue al filtro: ElevenLabs la
            entrega como un solo acumulado. Si esta cuota se agota, las llamadas fallan con voz. Ya
            pasó el 9 de julio.
          </p>
        </div>
      )}
    </div>
  );
}
