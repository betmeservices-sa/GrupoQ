// El catálogo de imagenología.
//
// Sale de la ORDEN MÉDICA impresa de la Unidad de Imagenología: los mismos
// estudios, en las mismas secciones y en el mismo orden que en el papel. Eso no
// es nostalgia: quien llena esta pantalla llenó esa hoja mil veces, y encontrar
// "Rodilla con Apoyo" donde siempre estuvo es la diferencia entre marcar y
// buscar.
//
// LADO. En el papel, veinticuatro estudios llevan "Der Izq" para circular. Acá
// eso es el campo `lado`: cuando está, la pantalla obliga a elegir antes de
// guardar. Una radiografía de la rodilla equivocada es un viaje perdido y una
// placa que se repite.
//
// PRECIOS. La hoja no los trae, así que todos van marcados como estimados, con
// el mismo criterio que el resto del módulo: se ven con ~ y se cambian acá
// cuando llegue la lista.

import type { AreaExamenes } from "./examenes";

/** Estudio con lado: el mismo nombre sirve para los dos, el lado va aparte. */
const lado = (
  id: string,
  codigo: string,
  nombre: string,
  precio: number,
  nota?: string,
): AreaExamenes["examenes"][number] => ({
  id,
  codigo,
  nombre,
  precio,
  estimado: true,
  lado: true,
  ...(nota ? { nota } : {}),
});

const est = (
  id: string,
  codigo: string,
  nombre: string,
  precio: number,
  nota?: string,
): AreaExamenes["examenes"][number] => ({
  id,
  codigo,
  nombre,
  precio,
  estimado: true,
  ...(nota ? { nota } : {}),
});

export const AREAS_IMAGEN: AreaExamenes[] = [
  {
    id: "rx_cabeza",
    nombre: "Rayos X · Cabeza",
    examenes: [
      est("rx101", "RX101", "Cráneo", 28),
      est("rx102", "RX102", "Waters", 26),
      est("rx103", "RX103", "Cavum", 26),
      lado("rx104", "RX104", "Conductos auditivos", 28),
      est("rx105", "RX105", "Senos paranasales", 26),
      est("rx106", "RX106", "Huesos nasales", 26),
      est("rx107", "RX107", "Mastoides", 28),
      est("rx108", "RX108", "Mandíbula", 28),
      est("rx109", "RX109", "Articulación TM", 30),
      est("rx110", "RX110", "Órbitas", 28),
      est("rx111", "RX111", "Silla turca", 28),
      est("rx112", "RX112", "Cuello", 28),
      est("rx113", "RX113", "Arco cigomático", 26),
      est("rx114", "RX114", "Proyección de Towne", 28),
    ],
  },
  {
    id: "rx_torax",
    nombre: "Rayos X · Tórax",
    examenes: [
      est("rx201", "RX201", "Tórax PA o AP", 25),
      lado("rx202", "RX202", "Tórax PA y lateral", 32),
      lado("rx203", "RX203", "Tórax lateral", 28),
      est("rx204", "RX204", "Tóraco-abdominal", 35),
      lado("rx205", "RX205", "Costillas", 30),
      est("rx206", "RX206", "Esternón", 28),
    ],
  },
  {
    id: "rx_abdomen",
    nombre: "Rayos X · Abdomen",
    examenes: [
      est("rx301", "RX301", "Abdomen simple", 28),
      est("rx302", "RX302", "Serie abdominal", 45),
      est("rx303", "RX303", "Abdomen simple de pie", 30),
    ],
  },
  {
    id: "rx_superiores",
    nombre: "Rayos X · Extremidades superiores",
    examenes: [
      lado("rx401", "RX401", "Clavícula", 26),
      lado("rx402", "RX402", "Escápula", 26),
      lado("rx403", "RX403", "Hombro", 26),
      lado("rx404", "RX404", "Hombro axial", 28),
      lado("rx405", "RX405", "Húmero", 26),
      lado("rx406", "RX406", "Codo", 26),
      lado("rx407", "RX407", "Antebrazo", 26),
      lado("rx408", "RX408", "Muñeca", 26),
      lado("rx409", "RX409", "Mano", 26),
      lado("rx410", "RX410", "Dedos de mano", 26),
      lado("rx411", "RX411", "Edad ósea", 30),
      lado("rx412", "RX412", "Serie de escafoides", 34),
      lado("rx413", "RX413", "Túnel del carpo", 28),
    ],
  },
  {
    id: "rx_inferiores",
    nombre: "Rayos X · Extremidades inferiores",
    examenes: [
      lado("rx501", "RX501", "Cadera", 28),
      lado("rx502", "RX502", "Cadera axial", 30),
      est("rx503", "RX503", "Serie de caderas", 38),
      lado("rx504", "RX504", "Fémur", 28),
      lado("rx505", "RX505", "Rodilla", 26),
      lado("rx506", "RX506", "Rodilla axial", 28),
      lado("rx507", "RX507", "Rodilla con apoyo", 30),
      lado("rx508", "RX508", "Pierna", 26),
      lado("rx509", "RX509", "Tobillo", 26),
      lado("rx510", "RX510", "Pie", 26),
      lado("rx511", "RX511", "Calcáneo", 26),
    ],
  },
  {
    id: "rx_columna",
    nombre: "Rayos X · Columna y pelvis",
    examenes: [
      est("rx601", "RX601", "Cervical", 30),
      est("rx602", "RX602", "Cervical flexión-extensión", 38),
      est("rx603", "RX603", "Cervical con oblicuas", 38),
      est("rx604", "RX604", "Columna dorsal", 32),
      est("rx605", "RX605", "Lumbar AP y lateral", 32),
      est("rx606", "RX606", "Lumbar flexión-extensión", 40),
      est("rx607", "RX607", "Lumbar con oblicuas", 40),
      est("rx608", "RX608", "Pelvis", 28),
      est("rx609", "RX609", "Sacro-coxis", 30),
      est("rx610", "RX610", "Columna (escoliosis)", 45),
      est("rx611", "RX611", "Dinámicas de columna lumbar", 45),
      est("rx612", "RX612", "Atlas-axis", 30),
    ],
  },
  {
    id: "rx_otros",
    nombre: "Rayos X · Otros",
    examenes: [
      est("rx701", "RX701", "Huesos largos", 40),
      est("rx702", "RX702", "Serie ósea", 95),
    ],
  },
  {
    id: "rx_especiales",
    nombre: "Estudios especiales",
    examenes: [
      est(
        "rx801",
        "RX801",
        "Histerosalpingograma",
        135,
        "Entre el día 8 y el 12 del ciclo, sin sangrado y sin relaciones desde la regla",
      ),
      est("rx802", "RX802", "Pielograma endovenoso", 150, "Ayuno de 8 horas. Traer creatinina reciente"),
      est("rx803", "RX803", "Enema baritado", 140, "Preparación intestinal el día anterior"),
      est("rx804", "RX804", "Cistograma", 110),
      est("rx805", "RX805", "Cistouretrograma", 120),
      est("rx806", "RX806", "Tubo digestivo superior", 130, "Ayuno de 8 horas"),
      est("rx807", "RX807", "Colangiograma transoperatorio", 160),
      est("rx808", "RX808", "Colangiograma por tubo en T", 150),
      est("rx809", "RX809", "Fistulograma", 130),
      est("rx810", "RX810", "Esofagograma", 120, "Ayuno de 6 horas"),
      est("rx811", "RX811", "Tránsito intestinal", 150, "Ayuno de 8 horas"),
      lado("rx812", "RX812", "Arteriografía de miembro inferior", 320),
      lado("rx813", "RX813", "Venografía de miembro inferior", 300),
    ],
  },
  {
    id: "ultrasonografia",
    nombre: "Ultrasonografía",
    examenes: [
      est("us101", "US101", "Abdominal", 45, "Ayuno de 6 horas"),
      est("us102", "US102", "Abdominal + apéndice", 55, "Ayuno de 6 horas"),
      est(
        "us103",
        "US103",
        "Abdominal + pélvica",
        60,
        "Ayuno de 6 horas y llegar con la vejiga llena",
      ),
      est("us104", "US104", "Renal", 45),
      est("us105", "US105", "Vejiga", 40, "Llegar con la vejiga llena"),
      est("us106", "US106", "Renal + vejiga", 55, "Llegar con la vejiga llena"),
      est("us107", "US107", "Hígado + vías biliares", 50, "Ayuno de 6 horas"),
      est("us108", "US108", "Tiroides", 45),
      est("us109", "US109", "Cuello", 45),
      est("us110", "US110", "Parótidas", 45),
      est("us111", "US111", "Inguinal", 45),
      est("us112", "US112", "Rodillas", 50),
      est("us113", "US113", "Pared abdominal", 45),
      est("us114", "US114", "Testicular", 50),
      est("us115", "US115", "Próstata transabdominal", 50, "Llegar con la vejiga llena"),
      est("us116", "US116", "Próstata transrectal", 85, "Enema la noche anterior"),
      est("us117", "US117", "Tejidos blandos", 45),
      est("us118", "US118", "Tórax (derrame pleural)", 50),
      est("us119", "US119", "Transfontanelar", 55),
      est("us120", "US120", "Caderas", 50),
      est("us121", "US121", "Retroperitoneo", 55, "Ayuno de 6 horas"),
    ],
  },
  {
    id: "doppler",
    nombre: "Doppler color",
    examenes: [
      lado("dp101", "DP101", "Doppler venoso de miembro inferior", 95),
      lado("dp102", "DP102", "Doppler arterial de miembro inferior", 95),
      est("dp103", "DP103", "Doppler testicular", 85),
      est("dp104", "DP104", "Doppler de carótida", 95),
      est("dp105", "DP105", "Doppler renal", 95),
      est("dp106", "DP106", "Doppler de hígado", 90),
      est("dp107", "DP107", "Doppler de aorta abdominal", 95, "Ayuno de 6 horas"),
    ],
  },
  {
    id: "procedimientos_imagen",
    nombre: "Procedimientos",
    examenes: [
      est("pi101", "PI101", "CAAF de tiroides", 160, "Suspender anticoagulantes según indique el doctor"),
      est("pi102", "PI102", "Drenaje en colecciones abdominales", 280),
    ],
  },
];
