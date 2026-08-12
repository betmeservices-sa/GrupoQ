/* eslint-disable @next/next/no-img-element */
"use client";

// Alta de una propiedad parado frente a la casa, con el teléfono en la mano.
//
// Todo el diseño sale de ahí: una sola columna, botones que se alcanzan con el
// pulgar, texto de 16 px para arriba (menos de eso, iOS hace zoom al tocar un
// campo), contraste alto porque hay sol pegando, y la acción principal fija
// abajo para no tener que buscarla.
//
// Las tres piezas delicadas, y por qué están así:
//   1. FOTOS: <input type="file" capture="environment"> abre la cámara nativa y
//      funciona AUNQUE el sitio se sirva por http (que es como se ve desde el
//      teléfono contra la IP local). getUserMedia exigiría HTTPS y fallaría
//      justo en la prueba de campo.
//   2. VOZ: la grabación del navegador y el dictado exigen contexto seguro. Si
//      no lo hay, se cae a <input type="file" accept="audio/*" capture>, que
//      abre la grabadora del teléfono y sí funciona por http. Nunca queda un
//      botón muerto.
//   3. LO QUE SE ENTIENDE: lo llena el lector de reglas (lib/inmobiliaria-
//      dictado). Lo que no dijo se queda vacío y se marca con "Falta".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Camera,
  Check,
  Images,
  Loader2,
  Mic,
  Minus,
  Plus,
  Square,
  Trash2,
  TreePine,
  Store,
  Home,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { AMBIENTES_ALTA, telefonoValido, type AltaPropiedad, type ProblemaAlta } from "@/lib/inmobiliaria-alta";
import { extraerDeDictado, ETIQUETA_CAMPO, type CampoAlta, type Extraccion } from "@/lib/inmobiliaria-dictado";
import { elegirFotos, juzgarFoto, medirImageData, type JuicioFoto, type MedidaFoto } from "@/lib/inmobiliaria-fotos";
import { componerCarrusel } from "@/lib/inmobiliaria-lienzo";
import { armarAnuncio } from "@/lib/inmobiliaria-publicacion";
import { dinero } from "@/lib/inmobiliaria-formato";
import {
  AMBIENTE_NOMBRE,
  FORMATOS,
  TIPO_NOMBRE,
  type Ambiente,
  type Propiedad,
  type TipoOperacion,
  type TipoPropiedad,
} from "@/lib/inmobiliaria-tipos";

const MARCA = "Terrazul Bienes Raíces";
const LADO_GUARDADO = 1440; // suficiente para el feed sin mandar 8 MB por dato
const LADO_MEDIDA = 220; // con esto alcanza para medir nitidez y luz

interface FotoLocal {
  id: string;
  dataUrl: string;
  ambiente: Ambiente;
  ancho: number; // el original
  alto: number;
  medida: MedidaFoto;
  juicio: JuicioFoto;
}

type Campos = Omit<AltaPropiedad, "fotos">;

const VACIO: Campos = {
  operacion: "venta",
  tipo: "casa",
  precio: 0,
  deposito: 0,
  plazoMinimoMeses: 12,
  zona: "",
  municipio: "",
  habitaciones: 0,
  banos: 0,
  parqueos: 0,
  areaConstruccion: 0,
  areaTerreno: 0,
  descripcion: "",
  propietario: { nombre: "", telefono: "" },
  exclusiva: false,
  exclusivaEnDias: 90,
};

const ICONO_TIPO: Record<TipoPropiedad, typeof Home> = {
  casa: Home,
  apartamento: Building2,
  terreno: TreePine,
  local: Store,
};

// Campos que llegaron del dictado y no se han tocado a mano: se muestran con su
// origen para que el agente los pueda corregir de un toque.
type Origen = Partial<Record<CampoAlta, string>>;

export default function NuevaPropiedadPage() {
  const router = useRouter();
  const esInmobiliaria = activeTenantId() === "inmobiliaria";
  useEffect(() => {
    if (!esInmobiliaria) router.replace("/");
  }, [esInmobiliaria, router]);

  const [campos, setCampos] = useState<Campos>(VACIO);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [origen, setOrigen] = useState<Origen>({});
  const [faltantes, setFaltantes] = useState<CampoAlta[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [problemas, setProblemas] = useState<ProblemaAlta[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [listo, setListo] = useState<{ propiedad: Propiedad; publicado: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(0);

  const set = useCallback(<K extends keyof Campos>(k: K, v: Campos[K]) => {
    setCampos((c) => ({ ...c, [k]: v }));
  }, []);

  // ── Fotos ──
  const agregarArchivos = useCallback(
    async (lista: FileList | null) => {
      if (!lista?.length) return;
      const archivos = Array.from(lista).slice(0, 12);
      setProcesando((n) => n + archivos.length);
      // Contador propio: si se eligen seis fotos de una vez, "la primera" es una
      // sola, no las seis (el largo del estado todavía no cambió).
      let indice = fotos.length;
      for (const file of archivos) {
        try {
          const foto = await procesarFoto(file, campos.tipo, indice === 0);
          indice++;
          setFotos((f) => (f.length >= 12 ? f : [...f, foto]));
        } catch {
          setError("Una de las fotos no se pudo leer. Probá de nuevo.");
        } finally {
          setProcesando((n) => Math.max(0, n - 1));
        }
      }
    },
    [campos.tipo, fotos.length],
  );

  const seleccion = useMemo(() => elegirFotos(fotos.map((f) => f.medida)), [fotos]);
  const entran = useMemo(
    () => new Set(seleccion.entran.map((j) => j.medida.src)),
    [seleccion],
  );

  // ── Dictado ──
  const aplicarDictado = useCallback((e: Extraccion) => {
    setFaltantes(e.faltantes);
    setAvisos(e.avisos);
    const nuevoOrigen: Origen = {};
    setCampos((c) => {
      const next = { ...c, propietario: { ...c.propietario } };
      const usar = <T,>(campo: CampoAlta, dato: { valor: T; dicho: string } | undefined, aplicar: (v: T) => void) => {
        if (!dato) return;
        aplicar(dato.valor);
        nuevoOrigen[campo] = dato.dicho;
      };
      usar("operacion", e.operacion, (v) => (next.operacion = v));
      usar("tipo", e.tipo, (v) => (next.tipo = v));
      usar("precio", e.precio, (v) => (next.precio = v));
      usar("deposito", e.deposito, (v) => (next.deposito = v));
      usar("plazoMinimoMeses", e.plazoMinimoMeses, (v) => (next.plazoMinimoMeses = v));
      usar("zona", e.zona, (v) => (next.zona = v));
      usar("municipio", e.municipio, (v) => (next.municipio = v));
      usar("habitaciones", e.habitaciones, (v) => (next.habitaciones = v));
      usar("banos", e.banos, (v) => (next.banos = v));
      usar("parqueos", e.parqueos, (v) => (next.parqueos = v));
      usar("areaConstruccion", e.areaConstruccion, (v) => (next.areaConstruccion = v));
      usar("areaTerreno", e.areaTerreno, (v) => (next.areaTerreno = v));
      usar("propietarioNombre", e.propietarioNombre, (v) => (next.propietario.nombre = v));
      usar("propietarioTelefono", e.propietarioTelefono, (v) => (next.propietario.telefono = v));
      if (e.exclusiva) next.exclusiva = e.exclusiva.valor;
      if (e.exclusivaEnDias) next.exclusivaEnDias = e.exclusivaEnDias.valor;
      next.descripcion = e.descripcion;
      return next;
    });
    setOrigen(nuevoOrigen);
  }, []);

  // ── Guardar y publicar ──
  async function guardar(publicar: boolean) {
    setError(null);
    setProblemas([]);
    setGuardando(true);
    try {
      const cuerpo = {
        ...campos,
        fotos: fotos
          .filter((f) => entran.has(f.medida.src))
          .map((f) => ({ dataUrl: f.dataUrl, ambiente: f.ambiente, ancho: f.ancho, alto: f.alto })),
      };
      const r = await fetch("/api/inmobiliaria/cartera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json();
      if (!d.ok) {
        setProblemas(d.problemas ?? [{ campo: "operacion", problema: d.error ?? "No se pudo guardar." }]);
        setGuardando(false);
        return;
      }
      const propiedad: Propiedad = d.propiedad;
      setListo({ propiedad, publicado: null });
      setGuardando(false);
      if (publicar) await publicarAhora(propiedad);
    } catch {
      setError("No se pudo guardar. Revisá la señal y probá de nuevo.");
      setGuardando(false);
    }
  }

  // El post se arma con el MISMO anuncio y el mismo arte de la pantalla de
  // Publicación: la fachada abre, el precio va estampado sobre la foto real.
  async function publicarAhora(propiedad: Propiedad) {
    setPublicando(true);
    setError(null);
    try {
      const anuncio = armarAnuncio(propiedad);
      const imagenes = await componerCarrusel({
        anuncio,
        marca: MARCA,
        formato: FORMATOS[0],
        fotos: anuncio.carrusel,
      });
      const r = await fetch("/api/inmobiliaria/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: propiedad.id,
          texto: `${anuncio.titulo}\n\n${anuncio.descripcion}\n\n${anuncio.hashtags.join(" ")}`,
          imagenes,
        }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "No se pudo publicar.");
      } else {
        setListo((l) =>
          l ? { ...l, publicado: d.simulado ? (d.aviso as string) : "Publicado en la página de Facebook." } : l,
        );
      }
    } catch {
      setError("No se pudo publicar. La propiedad quedó guardada en la cartera.");
    }
    setPublicando(false);
  }

  if (!esInmobiliaria) return <div className="flex-1 bg-surface" />;

  if (listo) {
    return (
      <Terminado
        propiedad={listo.propiedad}
        publicado={listo.publicado}
        publicando={publicando}
        error={error}
        onPublicar={() => publicarAhora(listo.propiedad)}
        onOtra={() => {
          setListo(null);
          setCampos(VACIO);
          setFotos([]);
          setOrigen({});
          setFaltantes([]);
          setAvisos([]);
          setError(null);
        }}
      />
    );
  }

  const esAlquiler = campos.operacion === "alquiler";
  const pideHabitaciones = campos.tipo === "casa" || campos.tipo === "apartamento";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-card px-4 py-3">
        <Link
          href="/cartera"
          aria-label="Volver a la cartera"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-[var(--text-2)] transition hover:bg-surface"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Nueva propiedad</h1>
          <p className="truncate text-[12.5px] text-[var(--text-3)]">
            Contala, tomale fotos y queda en la cartera
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[560px] space-y-4 px-4 pb-40 pt-4">
          <Dictado onExtraccion={aplicarDictado} />

          {avisos.map((a) => (
            <p
              key={a}
              className="flex items-start gap-2 rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.08] px-3.5 py-2.5 text-[13px] text-[var(--text-2)]"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
              {a}
            </p>
          ))}

          <Fotos
            fotos={fotos}
            entran={entran}
            procesando={procesando}
            onArchivos={agregarArchivos}
            onAmbiente={(id, ambiente) =>
              setFotos((f) => f.map((x) => (x.id === id ? { ...x, ambiente } : x)))
            }
            onQuitar={(id) => setFotos((f) => f.filter((x) => x.id !== id))}
          />

          <Tarjeta titulo="Operación">
            <div className="grid grid-cols-2 gap-2">
              {(["venta", "alquiler"] as TipoOperacion[]).map((o) => (
                <Segmento
                  key={o}
                  activo={campos.operacion === o}
                  onClick={() => set("operacion", o)}
                  texto={o === "venta" ? "Venta" : "Alquiler"}
                />
              ))}
            </div>
            <Marca campo="operacion" origen={origen} faltantes={faltantes} />

            <div className="mt-3 grid grid-cols-4 gap-2">
              {(Object.keys(TIPO_NOMBRE) as TipoPropiedad[]).map((t) => {
                const Icono = ICONO_TIPO[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("tipo", t)}
                    className={cn(
                      "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 text-[12px] font-bold transition",
                      campos.tipo === t
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-card text-[var(--text-2)]",
                    )}
                  >
                    <Icono size={20} />
                    <span className="leading-tight">{t === "local" ? "Local" : TIPO_NOMBRE[t]}</span>
                  </button>
                );
              })}
            </div>
            <Marca campo="tipo" origen={origen} faltantes={faltantes} />
          </Tarjeta>

          <Tarjeta titulo={esAlquiler ? "Renta y condiciones" : "Precio"}>
            <CampoNumero
              etiqueta={esAlquiler ? "Renta al mes" : "Precio"}
              valor={campos.precio}
              onValor={(v) => set("precio", v)}
              prefijo="$"
              grande
            />
            <Marca campo="precio" origen={origen} faltantes={faltantes} />
            {esAlquiler && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <CampoNumero
                    etiqueta="Depósito"
                    valor={campos.deposito ?? 0}
                    onValor={(v) => set("deposito", v)}
                    prefijo="$"
                  />
                  <Marca campo="deposito" origen={origen} faltantes={faltantes} />
                </div>
                <div>
                  <CampoNumero
                    etiqueta="Contrato mínimo"
                    valor={campos.plazoMinimoMeses ?? 0}
                    onValor={(v) => set("plazoMinimoMeses", v)}
                    sufijo="meses"
                  />
                  <Marca campo="plazoMinimoMeses" origen={origen} faltantes={faltantes} />
                </div>
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Dónde queda">
            <CampoTexto
              etiqueta="Zona o colonia"
              valor={campos.zona}
              onValor={(v) => set("zona", v)}
              placeholder="Residencial Las Colinas"
            />
            <Marca campo="zona" origen={origen} faltantes={faltantes} />
            <div className="mt-3">
              <CampoTexto
                etiqueta="Municipio"
                valor={campos.municipio}
                onValor={(v) => set("municipio", v)}
                placeholder="Santa Tecla"
              />
              <Marca campo="municipio" origen={origen} faltantes={faltantes} />
            </div>
          </Tarjeta>

          <Tarjeta titulo="La propiedad">
            {pideHabitaciones && (
              <div className="space-y-3">
                <Contador
                  etiqueta="Habitaciones"
                  valor={campos.habitaciones}
                  onValor={(v) => set("habitaciones", v)}
                />
                <Marca campo="habitaciones" origen={origen} faltantes={faltantes} />
                <Contador
                  etiqueta="Baños"
                  valor={campos.banos}
                  paso={0.5}
                  onValor={(v) => set("banos", v)}
                />
                <Marca campo="banos" origen={origen} faltantes={faltantes} />
              </div>
            )}
            <div className={cn(pideHabitaciones && "mt-3")}>
              <Contador
                etiqueta="Parqueos"
                valor={campos.parqueos}
                onValor={(v) => set("parqueos", v)}
              />
              <Marca campo="parqueos" origen={origen} faltantes={faltantes} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <CampoNumero
                  etiqueta="Construcción"
                  valor={campos.areaConstruccion}
                  onValor={(v) => set("areaConstruccion", v)}
                  sufijo="m²"
                />
                <Marca campo="areaConstruccion" origen={origen} faltantes={faltantes} />
              </div>
              <div>
                <CampoNumero
                  etiqueta="Terreno"
                  valor={campos.areaTerreno}
                  onValor={(v) => set("areaTerreno", v)}
                  sufijo="v²"
                />
                <Marca campo="areaTerreno" origen={origen} faltantes={faltantes} />
              </div>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Lo que se le cuenta al cliente">
            <textarea
              value={campos.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={5}
              placeholder="Lo que le dirías de viva voz a un interesado."
              className="w-full resize-y rounded-xl border-2 border-line bg-surface px-3 py-2.5 text-[16px] leading-relaxed text-[var(--text)] outline-none transition focus:border-brand focus:bg-card"
            />
          </Tarjeta>

          <Tarjeta titulo="Propietario">
            <CampoTexto
              etiqueta="Nombre"
              valor={campos.propietario.nombre}
              onValor={(v) => setCampos((c) => ({ ...c, propietario: { ...c.propietario, nombre: v } }))}
              placeholder="Nombre y apellido"
            />
            <Marca campo="propietarioNombre" origen={origen} faltantes={faltantes} />
            <div className="mt-3">
              <CampoTexto
                etiqueta="Teléfono"
                valor={campos.propietario.telefono}
                onValor={(v) =>
                  setCampos((c) => ({ ...c, propietario: { ...c.propietario, telefono: v } }))
                }
                placeholder="7777 7777"
                tipo="tel"
              />
              <Marca campo="propietarioTelefono" origen={origen} faltantes={faltantes} />
              {campos.propietario.telefono && !telefonoValido(campos.propietario.telefono) && (
                <p className="mt-1 text-[12.5px] font-semibold text-[var(--brand-accent)]">
                  Son ocho dígitos, empezando en 2, 6 o 7.
                </p>
              )}
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-[var(--text-3)]">
              Este dato nunca sale en el anuncio ni se le pasa al comprador.
            </p>

            <button
              type="button"
              onClick={() => set("exclusiva", !campos.exclusiva)}
              aria-pressed={campos.exclusiva}
              className={cn(
                "mt-3 flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border-2 px-3.5 text-left transition",
                campos.exclusiva ? "border-brand bg-brand/[0.06]" : "border-line bg-surface",
              )}
            >
              <span>
                <span className="block text-[15px] font-bold text-[var(--text)]">En exclusiva</span>
                <span className="block text-[12.5px] text-[var(--text-3)]">
                  {campos.exclusiva ? "Solo nosotros la manejamos" : "Otras inmobiliarias también pueden venderla"}
                </span>
              </span>
              <span
                className={cn(
                  "flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition",
                  campos.exclusiva ? "bg-brand" : "bg-[var(--border-2)]",
                )}
              >
                <span
                  className={cn(
                    "h-5 w-5 rounded-full bg-white transition",
                    campos.exclusiva && "translate-x-5",
                  )}
                />
              </span>
            </button>
            {campos.exclusiva && (
              <div className="mt-3">
                <CampoNumero
                  etiqueta="Vence en"
                  valor={campos.exclusivaEnDias ?? 0}
                  onValor={(v) => set("exclusivaEnDias", v)}
                  sufijo="días"
                />
              </div>
            )}
          </Tarjeta>

          {problemas.length > 0 && (
            <div className="rounded-2xl border-2 border-[var(--brand-red)]/50 bg-[var(--brand-red)]/[0.07] px-4 py-3">
              <p className="text-[14px] font-bold text-[var(--brand-red)]">Falta esto para guardar</p>
              <ul className="mt-1.5 space-y-1">
                {problemas.map((p) => (
                  <li key={`${p.campo}-${p.problema}`} className="text-[13.5px] text-[var(--text-2)]">
                    {p.problema}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-2xl border-2 border-[var(--brand-red)]/45 bg-[var(--brand-red)]/[0.07] px-4 py-3 text-[13.5px] text-[var(--text-2)]">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--brand-red)]" />
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Barra fija abajo: donde llega el pulgar. */}
      <div className="border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[560px] gap-2">
          <button
            type="button"
            onClick={() => guardar(false)}
            disabled={guardando || publicando}
            className="min-h-[52px] flex-1 rounded-xl border-2 border-line bg-card px-4 text-[15px] font-bold text-[var(--text-2)] transition active:scale-[0.99] disabled:opacity-60"
          >
            {guardando ? "Guardando" : "Guardar"}
          </button>
          <button
            type="button"
            onClick={() => guardar(true)}
            disabled={guardando || publicando}
            className="inline-flex min-h-[52px] flex-[1.4] items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[15px] font-extrabold text-white shadow-sm shadow-brand/30 transition active:scale-[0.99] disabled:opacity-60"
          >
            {guardando || publicando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            Guardar y publicar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bloque de dictado ──

interface ReconocimientoEvento {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
}
interface Reconocimiento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: ReconocimientoEvento) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

function Dictado({ onExtraccion }: { onExtraccion: (e: Extraccion) => void }) {
  const [texto, setTexto] = useState("");
  const [grabando, setGrabando] = useState(false);
  const [soporte, setSoporte] = useState<"voz" | "grabadora" | "escribir">("escribir");
  const [nota, setNota] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const reco = useRef<Reconocimiento | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento };
    const Motor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    // El dictado del navegador necesita micrófono, y el micrófono necesita
    // contexto seguro (https o localhost). Desde el teléfono contra la IP local
    // eso NO se cumple: ahí se usa la grabadora del teléfono.
    if (Motor && window.isSecureContext) {
      setSoporte("voz");
    } else if (!window.isSecureContext) {
      setSoporte("grabadora");
      setNota(
        "Esta conexión no es segura, así que el navegador no deja usar el micrófono. Grabá con la grabadora del teléfono y escribí lo importante: los campos se llenan igual.",
      );
    } else {
      setSoporte("grabadora");
      setNota("Este navegador no pasa la voz a texto. Grabá la nota y escribí lo importante.");
    }
  }, []);

  function arrancar() {
    const w = window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento };
    const Motor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Motor) return;
    const r = new Motor();
    r.lang = "es-SV";
    r.continuous = true;
    r.interimResults = true;
    let acumulado = texto;
    r.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const frase = e.results[i][0].transcript;
        if (e.results[i].isFinal) acumulado = `${acumulado} ${frase}`.trim();
        else parcial += frase;
      }
      setTexto(`${acumulado} ${parcial}`.trim());
    };
    r.onerror = (e) => {
      setNota(
        e.error === "not-allowed"
          ? "No diste permiso al micrófono. Podés escribir la descripción."
          : "Se cortó el dictado. Probá otra vez o escribilo.",
      );
      setGrabando(false);
    };
    r.onend = () => setGrabando(false);
    reco.current = r;
    setNota(null);
    setGrabando(true);
    r.start();
  }

  function detener() {
    reco.current?.stop();
    setGrabando(false);
    if (texto.trim()) onExtraccion(extraerDeDictado(texto));
  }

  return (
    <section className="rounded-2xl border-2 border-brand/25 bg-brand/[0.04] p-4">
      <h2 className="text-[15px] font-extrabold text-[var(--text)]">Contá la propiedad</h2>
      <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-2)]">
        Hablá como se la contarías a un cliente. Lo que se entienda llena los campos de abajo.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {soporte === "voz" ? (
          <button
            type="button"
            onClick={grabando ? detener : arrancar}
            className={cn(
              "inline-flex min-h-[56px] flex-1 items-center justify-center gap-2.5 rounded-xl px-4 text-[15px] font-extrabold text-white transition active:scale-[0.99]",
              grabando ? "bg-[var(--brand-red)]" : "bg-brand shadow-sm shadow-brand/30",
            )}
          >
            {grabando ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
            {grabando ? "Listo, ya dije todo" : "Grabar la descripción"}
          </button>
        ) : (
          <label className="inline-flex min-h-[56px] flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-brand px-4 text-[15px] font-extrabold text-white shadow-sm shadow-brand/30 transition active:scale-[0.99]">
            <Mic size={20} />
            Grabar nota de voz
            <input
              type="file"
              accept="audio/*"
              capture
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAudio(URL.createObjectURL(f));
              }}
            />
          </label>
        )}
      </div>

      {grabando && (
        <p className="mt-2 flex items-center gap-2 text-[13px] font-bold text-[var(--brand-red)]">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--brand-red)]" />
          Escuchando
        </p>
      )}

      {nota && (
        <p className="mt-2 rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.08] px-3 py-2 text-[12.5px] leading-snug text-[var(--text-2)]">
          {nota}
        </p>
      )}

      {audio && (
        <audio controls src={audio} className="mt-2 w-full">
          <track kind="captions" />
        </audio>
      )}

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder="Casa de tres habitaciones, dos baños, en Santa Tecla, cuatrocientos mil"
        className="mt-3 w-full resize-y rounded-xl border-2 border-line bg-card px-3 py-2.5 text-[16px] leading-relaxed text-[var(--text)] outline-none transition focus:border-brand"
      />

      <button
        type="button"
        onClick={() => onExtraccion(extraerDeDictado(texto))}
        disabled={!texto.trim()}
        className="mt-2 min-h-[48px] w-full rounded-xl border-2 border-brand bg-card px-4 text-[15px] font-bold text-brand transition active:scale-[0.99] disabled:opacity-50"
      >
        Llenar los campos con esto
      </button>
    </section>
  );
}

// ── Bloque de fotos ──

function Fotos({
  fotos,
  entran,
  procesando,
  onArchivos,
  onAmbiente,
  onQuitar,
}: {
  fotos: FotoLocal[];
  entran: Set<string>;
  procesando: number;
  onArchivos: (l: FileList | null) => void;
  onAmbiente: (id: string, a: Ambiente) => void;
  onQuitar: (id: string) => void;
}) {
  const dentro = fotos.filter((f) => entran.has(f.medida.src)).length;
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-extrabold text-[var(--text)]">Fotos</h2>
        {fotos.length > 0 && (
          <p className="text-[12.5px] font-semibold text-[var(--text-3)]">
            {dentro} de {fotos.length} entran al anuncio
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {/* Dos entradas distintas a propósito: en Android, capture fuerza la
            cámara y esconde la galería, así que la galería necesita su botón. */}
        <label className="inline-flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand px-3 text-[15px] font-extrabold text-white shadow-sm shadow-brand/30 active:scale-[0.99]">
          <Camera size={20} />
          Tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              onArchivos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="inline-flex min-h-[56px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-line bg-card px-3 text-[15px] font-bold text-[var(--text-2)] active:scale-[0.99]">
          <Images size={20} />
          De la galería
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onArchivos(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {procesando > 0 && (
        <p className="mt-2 flex items-center gap-2 text-[13px] text-[var(--text-2)]">
          <Loader2 size={15} className="animate-spin" />
          Revisando {procesando === 1 ? "la foto" : `${procesando} fotos`}
        </p>
      )}

      {fotos.length === 0 ? (
        <p className="mt-3 rounded-xl border-2 border-dashed border-[var(--border-2)] px-3 py-6 text-center text-[13px] text-[var(--text-3)]">
          Empezá por la fachada, que es la que decide el clic.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {fotos.map((f) => {
            const dentroAnuncio = entran.has(f.medida.src);
            return (
              <li
                key={f.id}
                className={cn(
                  "flex gap-3 rounded-xl border-2 p-2",
                  dentroAnuncio ? "border-line bg-surface/60" : "border-[var(--brand-red)]/45 bg-[var(--brand-red)]/[0.05]",
                )}
              >
                <img
                  src={f.dataUrl}
                  alt=""
                  className={cn(
                    "h-20 w-24 shrink-0 rounded-lg object-cover",
                    !dentroAnuncio && "opacity-60 saturate-50",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <select
                    value={f.ambiente}
                    onChange={(e) => onAmbiente(f.id, e.target.value as Ambiente)}
                    className="w-full rounded-lg border-2 border-line bg-card px-2 py-1.5 text-[15px] font-bold text-[var(--text)] outline-none [color-scheme:light]"
                  >
                    {AMBIENTES_ALTA.map((a) => (
                      <option key={a} value={a}>
                        {AMBIENTE_NOMBRE[a]}
                      </option>
                    ))}
                  </select>
                  <p
                    className={cn(
                      "mt-1 text-[12.5px] leading-snug",
                      dentroAnuncio ? "text-[var(--text-3)]" : "font-semibold text-[var(--brand-red)]",
                    )}
                  >
                    {dentroAnuncio
                      ? `Entra. ${f.medida.ancho}x${f.medida.alto}${f.juicio.notas.length ? ` · ${f.juicio.notas[0]}` : ""}`
                      : f.juicio.motivo}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onQuitar(f.id)}
                  aria-label="Quitar la foto"
                  className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-lg border border-line text-[var(--text-3)] transition hover:bg-card"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Pantalla de salida ──

function Terminado({
  propiedad,
  publicado,
  publicando,
  error,
  onPublicar,
  onOtra,
}: {
  propiedad: Propiedad;
  publicado: string | null;
  publicando: boolean;
  error: string | null;
  onPublicar: () => void;
  onOtra: () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-[560px] space-y-4 px-4 py-6">
        <div className="rounded-2xl border-2 border-[var(--brand-green)]/40 bg-[var(--brand-green)]/[0.07] p-5 text-center">
          <p className="text-[15px] font-extrabold text-[var(--brand-green)]">
            {propiedad.codigo} quedó en la cartera
          </p>
          <p className="mt-1 text-[13.5px] text-[var(--text-2)]">
            {propiedad.titulo} · {propiedad.operacion === "alquiler" ? `${dinero(propiedad.precio)}/mes` : dinero(propiedad.precio)}
          </p>
        </div>

        {publicando && (
          <p className="flex items-center justify-center gap-2 text-[13.5px] font-semibold text-[var(--text-2)]">
            <Loader2 size={16} className="animate-spin" />
            Armando el post con las fotos
          </p>
        )}

        {publicado && (
          <p className="rounded-2xl border border-line bg-card px-4 py-3 text-[13.5px] leading-relaxed text-[var(--text-2)]">
            {publicado}
          </p>
        )}

        {error && (
          <p className="rounded-2xl border-2 border-[var(--brand-red)]/45 bg-[var(--brand-red)]/[0.07] px-4 py-3 text-[13.5px] text-[var(--text-2)]">
            {error}
          </p>
        )}

        <div className="grid gap-2">
          {!publicado && !publicando && (
            <button
              type="button"
              onClick={onPublicar}
              className="min-h-[52px] rounded-xl bg-brand px-4 text-[15px] font-extrabold text-white shadow-sm shadow-brand/30"
            >
              Publicar ahora
            </button>
          )}
          <Link
            href={`/cartera/${propiedad.id}`}
            className="flex min-h-[52px] items-center justify-center rounded-xl border-2 border-line bg-card px-4 text-[15px] font-bold text-[var(--text-2)]"
          >
            Ver la ficha
          </Link>
          <Link
            href={`/publicacion?id=${propiedad.id}`}
            className="flex min-h-[52px] items-center justify-center rounded-xl border-2 border-line bg-card px-4 text-[15px] font-bold text-[var(--text-2)]"
          >
            Retocar el anuncio
          </Link>
          <button
            type="button"
            onClick={onOtra}
            className="min-h-[52px] rounded-xl px-4 text-[15px] font-bold text-brand"
          >
            Cargar otra propiedad
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Piezas del formulario ──

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="mb-3 text-[15px] font-extrabold text-[var(--text)]">{titulo}</h2>
      {children}
    </section>
  );
}

function Segmento({ activo, onClick, texto }: { activo: boolean; onClick: () => void; texto: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "min-h-[52px] rounded-xl border-2 px-3 text-[15px] font-bold transition",
        activo ? "border-brand bg-brand text-white" : "border-line bg-card text-[var(--text-2)]",
      )}
    >
      {texto}
    </button>
  );
}

const ENTRADA =
  "w-full rounded-xl border-2 border-line bg-surface px-3 text-[16px] font-semibold text-[var(--text)] outline-none transition focus:border-brand focus:bg-card";

function CampoTexto({
  etiqueta,
  valor,
  onValor,
  placeholder,
  tipo = "text",
}: {
  etiqueta: string;
  valor: string;
  onValor: (v: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-bold text-[var(--text-2)]">{etiqueta}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onValor(e.target.value)}
        placeholder={placeholder}
        className={cn(ENTRADA, "h-[52px]")}
      />
    </label>
  );
}

function CampoNumero({
  etiqueta,
  valor,
  onValor,
  prefijo,
  sufijo,
  grande = false,
}: {
  etiqueta: string;
  valor: number;
  onValor: (v: number) => void;
  prefijo?: string;
  sufijo?: string;
  grande?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-bold text-[var(--text-2)]">{etiqueta}</span>
      <span className="relative flex items-center">
        {prefijo && (
          <span
            className={cn(
              "pointer-events-none absolute left-3 font-extrabold text-[var(--text-3)]",
              grande ? "text-[22px]" : "text-[16px]",
            )}
          >
            {prefijo}
          </span>
        )}
        <input
          // Teclado numérico en el teléfono, sin las flechitas del de escritorio.
          inputMode="decimal"
          value={valor ? String(valor) : ""}
          onChange={(e) => onValor(Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
          placeholder="0"
          className={cn(
            ENTRADA,
            grande ? "h-[60px] text-[24px] font-extrabold" : "h-[52px]",
            prefijo && (grande ? "pl-9" : "pl-7"),
            sufijo && "pr-16",
          )}
        />
        {sufijo && (
          <span className="pointer-events-none absolute right-3 text-[14px] font-bold text-[var(--text-3)]">
            {sufijo}
          </span>
        )}
      </span>
    </label>
  );
}

// Con el dedo gordo no se acierta a un campito: más y menos, grandes.
function Contador({
  etiqueta,
  valor,
  onValor,
  paso = 1,
}: {
  etiqueta: string;
  valor: number;
  onValor: (v: number) => void;
  paso?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] font-bold text-[var(--text)]">{etiqueta}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Menos ${etiqueta}`}
          onClick={() => onValor(Math.max(0, Math.round((valor - paso) * 2) / 2))}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border-2 border-line bg-card text-[var(--text-2)] active:scale-95"
        >
          <Minus size={20} />
        </button>
        <span className="w-11 text-center text-[20px] font-extrabold tabular-nums text-[var(--text)]">
          {valor % 1 === 0 ? valor : valor.toFixed(1)}
        </span>
        <button
          type="button"
          aria-label={`Más ${etiqueta}`}
          onClick={() => onValor(Math.round((valor + paso) * 2) / 2)}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border-2 border-line bg-card text-[var(--text-2)] active:scale-95"
        >
          <Plus size={20} />
        </button>
      </span>
    </div>
  );
}

// Debajo de cada campo: de dónde salió el dato, o que falta preguntarlo.
function Marca({
  campo,
  origen,
  faltantes,
}: {
  campo: CampoAlta;
  origen: Origen;
  faltantes: CampoAlta[];
}) {
  if (origen[campo]) {
    return (
      <p className="mt-1 text-[12.5px] leading-snug text-[var(--text-3)]">
        Lo dijiste así: “{origen[campo]}”
      </p>
    );
  }
  if (faltantes.includes(campo)) {
    return (
      <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[12px] font-bold text-[var(--brand-accent)]">
        Falta {ETIQUETA_CAMPO[campo].toLowerCase()}
      </p>
    );
  }
  return null;
}

// ── Foto: reducir, medir y juzgar, todo en el navegador ──

async function procesarFoto(file: File, tipo: TipoPropiedad, primera: boolean): Promise<FotoLocal> {
  // from-image respeta la orientación del EXIF: sin esto, media foto de
  // teléfono entra acostada.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const original = { ancho: bitmap.width, alto: bitmap.height };

  const escala = Math.min(1, LADO_GUARDADO / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));
  const lienzo = document.createElement("canvas");
  lienzo.width = w;
  lienzo.height = h;
  lienzo.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  const dataUrl = lienzo.toDataURL("image/jpeg", 0.82);

  // La medición va sobre una copia chica: alcanza para nitidez y luz, y no
  // congela el teléfono con doce fotos de doce megapíxeles.
  const em = Math.min(1, LADO_MEDIDA / Math.max(w, h));
  const mw = Math.max(2, Math.round(w * em));
  const mh = Math.max(2, Math.round(h * em));
  const chico = document.createElement("canvas");
  chico.width = mw;
  chico.height = mh;
  const ctx = chico.getContext("2d", { willReadFrequently: true });
  ctx?.drawImage(bitmap, 0, 0, mw, mh);
  const datos = ctx?.getImageData(0, 0, mw, mh);
  bitmap.close?.();

  const id = `l${Math.random().toString(36).slice(2, 9)}`;
  const medida = medirImageData(id, datos?.data ?? new Uint8ClampedArray(mw * mh * 4), mw, mh, original);
  const ambiente: Ambiente =
    tipo === "terreno" ? "terreno" : tipo === "local" ? "local" : primera ? "fachada" : "sala";

  return { id, dataUrl, ambiente, ancho: original.ancho, alto: original.alto, medida, juicio: juzgarFoto(medida) };
}
