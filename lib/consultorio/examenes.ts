// El catálogo de exámenes que el doctor marca en la hoja.
//
// Va en columnas por área porque así es como se piensa al indicarlos: nadie
// busca "TSH" en una lista alfabética de ciento veinte estudios, lo busca en
// hormonas. Cada área es una columna en pantalla y el doctor solo da check.
//
// Son estudios estándar de laboratorio clínico, con el nombre como se pide en
// El Salvador (TGO/TGP y no AST/ALT a secas, VDRL, examen general de orina).
// No lleva precios ni laboratorio: eso cambia por convenio y no es del doctor.

export interface Examen {
  id: string;
  nombre: string;
  /** Lo que hay que advertirle al paciente. Sale impreso en la orden. */
  nota?: string;
}

export interface AreaExamenes {
  id: string;
  nombre: string;
  examenes: Examen[];
}

export const AREAS: AreaExamenes[] = [
  {
    id: "hematologia",
    nombre: "Hematología",
    examenes: [
      { id: "hemograma", nombre: "Hemograma completo" },
      { id: "hb_hto", nombre: "Hemoglobina y hematocrito" },
      { id: "plaquetas", nombre: "Recuento de plaquetas" },
      { id: "ves", nombre: "Velocidad de eritrosedimentación (VES)" },
      { id: "tp_inr", nombre: "Tiempo de protrombina (TP/INR)" },
      { id: "tpt", nombre: "Tiempo de tromboplastina (TPT)" },
      { id: "tipeo", nombre: "Tipeo sanguíneo y Rh" },
    ],
  },
  {
    id: "quimica",
    nombre: "Química sanguínea",
    examenes: [
      { id: "glucosa", nombre: "Glucosa en ayunas", nota: "ayuno de 8 horas" },
      { id: "hba1c", nombre: "Hemoglobina glicosilada (HbA1c)" },
      { id: "creatinina", nombre: "Creatinina" },
      { id: "bun", nombre: "Nitrógeno ureico (BUN)" },
      { id: "acido_urico", nombre: "Ácido úrico" },
      { id: "perfil_lipidico", nombre: "Perfil lipídico completo", nota: "ayuno de 12 horas" },
      { id: "tgo", nombre: "Transaminasa TGO (AST)" },
      { id: "tgp", nombre: "Transaminasa TGP (ALT)" },
      { id: "fosfatasa", nombre: "Fosfatasa alcalina" },
      { id: "bilirrubinas", nombre: "Bilirrubinas total y fraccionada" },
      { id: "amilasa", nombre: "Amilasa" },
      { id: "electrolitos", nombre: "Electrolitos (Na, K, Cl)" },
      { id: "calcio", nombre: "Calcio" },
      { id: "proteinas", nombre: "Proteínas totales y albúmina" },
    ],
  },
  {
    id: "orina_heces",
    nombre: "Orina y heces",
    examenes: [
      { id: "ego", nombre: "Examen general de orina" },
      { id: "urocultivo", nombre: "Urocultivo con antibiograma" },
      { id: "egh", nombre: "Examen general de heces" },
      { id: "sangre_oculta", nombre: "Sangre oculta en heces" },
      { id: "coprocultivo", nombre: "Coprocultivo" },
    ],
  },
  {
    id: "hormonas",
    nombre: "Hormonas y vitaminas",
    examenes: [
      { id: "tsh", nombre: "TSH" },
      { id: "t4l", nombre: "T4 libre" },
      { id: "t3", nombre: "T3" },
      { id: "prolactina", nombre: "Prolactina" },
      { id: "testosterona", nombre: "Testosterona total" },
      { id: "estradiol", nombre: "Estradiol" },
      { id: "fsh_lh", nombre: "FSH y LH" },
      { id: "psa", nombre: "Antígeno prostático (PSA)" },
      { id: "bhcg", nombre: "Beta HCG cuantitativa" },
      { id: "insulina", nombre: "Insulina basal", nota: "ayuno de 8 horas" },
      { id: "vit_d", nombre: "Vitamina D (25-OH)" },
      { id: "vit_b12", nombre: "Vitamina B12" },
      { id: "ferritina", nombre: "Ferritina" },
    ],
  },
  {
    id: "serologia",
    nombre: "Serología e infecciosas",
    examenes: [
      { id: "vih", nombre: "VIH" },
      { id: "vdrl", nombre: "VDRL / RPR" },
      { id: "hbsag", nombre: "Hepatitis B (HBsAg)" },
      { id: "hep_c", nombre: "Hepatitis C (anti-VHC)" },
      { id: "dengue", nombre: "Dengue NS1 e IgM" },
      { id: "pcr", nombre: "Proteína C reactiva" },
      { id: "factor_reumatoideo", nombre: "Factor reumatoideo" },
      { id: "aso", nombre: "Antiestreptolisina O (ASO)" },
      { id: "h_pylori", nombre: "Helicobacter pylori" },
    ],
  },
  {
    id: "imagenes",
    nombre: "Imágenes y gabinete",
    examenes: [
      { id: "rx_torax", nombre: "Radiografía de tórax" },
      { id: "us_abdominal", nombre: "Ultrasonido abdominal", nota: "ayuno de 6 horas" },
      { id: "us_pelvico", nombre: "Ultrasonido pélvico", nota: "vejiga llena" },
      { id: "us_tiroides", nombre: "Ultrasonido de tiroides" },
      { id: "mamografia", nombre: "Mamografía" },
      { id: "ekg", nombre: "Electrocardiograma" },
      { id: "densitometria", nombre: "Densitometría ósea" },
    ],
  },
];

/** Todos los exámenes en una sola lista, para resolver ids sin recorrer áreas. */
export const EXAMENES: Record<string, Examen & { area: string }> = Object.fromEntries(
  AREAS.flatMap((a) => a.examenes.map((e) => [e.id, { ...e, area: a.nombre }])),
);

export function esExamen(id: string): boolean {
  return id in EXAMENES;
}

/** Los exámenes marcados, agrupados por área y en el orden del catálogo. */
export function agrupar(ids: string[]): { area: string; examenes: Examen[] }[] {
  const marcados = new Set(ids);
  return AREAS.map((a) => ({
    area: a.nombre,
    examenes: a.examenes.filter((e) => marcados.has(e.id)),
  })).filter((g) => g.examenes.length > 0);
}

/**
 * Las advertencias de la orden, sin repetir.
 *
 * Si el doctor marca glucosa y perfil lipídico, el paciente no necesita leer
 * dos veces que tiene que venir en ayunas; necesita saber que son doce horas,
 * que es el ayuno más largo de los dos.
 */
export function preparacion(ids: string[]): string[] {
  const notas = ids.map((id) => EXAMENES[id]?.nota).filter((n): n is string => Boolean(n));
  const ayunos = notas
    .map((n) => /ayuno de (\d+) horas/.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  const otras = [...new Set(notas.filter((n) => !/ayuno de \d+ horas/.test(n)))];
  return [...(ayunos.length ? [`ayuno de ${Math.max(...ayunos)} horas`] : []), ...otras];
}
