// El catálogo de exámenes del laboratorio.
//
// Sale de la lista del propio laboratorio (PRECIOS DE EXAMENES DE LABORATORIO,
// 10 de septiembre de 2026): 152 exámenes en 12 áreas, con su CÓDIGO real, el
// tiempo de respuesta y la indicación previa tal como la da el laboratorio.
//
// SOBRE LOS PRECIOS: el archivo trae el precio de 14 de ellos (los que venían
// cotizados). Los demás llevan un estimado por área y están marcados con
// `estimado: true`, que es lo que la pantalla usa para no vender como firme un
// precio que nadie confirmó. En cuanto llegue la lista completa se cambian acá
// y no hay que tocar nada más.
//
// Va en columnas por área porque así es como se piensa al indicarlos: nadie
// busca "TSH" en una lista alfabética de ciento cincuenta estudios, lo busca en
// endocrinología.

export interface Examen {
  id: string;
  /** El código con el que el laboratorio lo factura y lo reporta. */
  codigo: string;
  nombre: string;
  /** En dólares. */
  precio: number;
  /** true si el precio es un estimado nuestro y no del laboratorio. */
  estimado?: boolean;
  /** La indicación previa: ayuno, suspender medicamentos, abstinencia. */
  nota?: string;
  /** Cuánto tarda el resultado, como lo dice el laboratorio. */
  tiempo?: string;
  /**
   * Si hay que decir de qué lado.
   *
   * En la orden de imagenología impresa son los que llevan "Der Izq" para
   * circular. Sin lado, la placa se toma de la rodilla equivocada y el paciente
   * vuelve otro día.
   */
  lado?: boolean;
}

export interface AreaExamenes {
  id: string;
  nombre: string;
  examenes: Examen[];
}

export const AREAS: AreaExamenes[] = [
  {
    "id": "hematologia",
    "nombre": "Hematología",
    "examenes": [
      {
        "id": "e01001",
        "codigo": "01001",
        "nombre": "Hemograma (recuento de plaquetas)",
        "precio": 8.2,
        "tiempo": "1 Hora"
      },
      {
        "id": "e01002",
        "codigo": "01002",
        "nombre": "Hematocrito y hemoglobina",
        "precio": 9,
        "estimado": true,
        "tiempo": "1 Hora"
      },
      {
        "id": "e01003",
        "codigo": "01003",
        "nombre": "Leucograma adulto",
        "precio": 9,
        "estimado": true,
        "tiempo": "1 Hora"
      },
      {
        "id": "e01004",
        "codigo": "01004",
        "nombre": "Recuento de plaquetas",
        "precio": 9,
        "estimado": true
      },
      {
        "id": "e01005",
        "codigo": "01005",
        "nombre": "Reticulocitos",
        "precio": 9,
        "estimado": true,
        "tiempo": "1 Hora"
      },
      {
        "id": "e01006",
        "codigo": "01006",
        "nombre": "Frotis de sangre periferica hematologa",
        "precio": 9,
        "estimado": true,
        "tiempo": "3 días hábiles (es realizado por médico hematologo)"
      },
      {
        "id": "e01007",
        "codigo": "01007",
        "nombre": "Eritrosedimentacion (seomegtacion) (VSG)",
        "precio": 9,
        "estimado": true
      },
      {
        "id": "e01008",
        "codigo": "01008",
        "nombre": "Gota gruesa",
        "precio": 9,
        "estimado": true,
        "tiempo": "2 horas"
      },
      {
        "id": "e01009",
        "codigo": "01009",
        "nombre": "Celulas l.e",
        "precio": 9,
        "estimado": true,
        "tiempo": "2 horas"
      },
      {
        "id": "e01010",
        "codigo": "01010",
        "nombre": "Recuento eosinofilos en sangre",
        "precio": 9,
        "estimado": true,
        "nota": "Ayuno de 8 a 12h o según indicación medica"
      },
      {
        "id": "e01011",
        "codigo": "01011",
        "nombre": "Eosinofilos en secrecion nasal",
        "precio": 9,
        "estimado": true,
        "nota": "Evitar el uso de spray nasales, y terapias respiratorias por lo menos 3 horas antes de realizar el examen",
        "tiempo": "1 Hora"
      },
      {
        "id": "e01012",
        "codigo": "01012",
        "nombre": "Tiempo de sangramiento",
        "precio": 9,
        "estimado": true
      },
      {
        "id": "e01013",
        "codigo": "01013",
        "nombre": "Tiempo de coagulacion",
        "precio": 9,
        "estimado": true
      },
      {
        "id": "e01014",
        "codigo": "01014",
        "nombre": "Tiempo y valor protrombina (TVP)",
        "precio": 8.5
      },
      {
        "id": "e01015",
        "codigo": "01015",
        "nombre": "Tiempo tromboplastina parcial (TTP)",
        "precio": 8.8
      },
      {
        "id": "e01016",
        "codigo": "01016",
        "nombre": "Tiempo de trombina",
        "precio": 9,
        "estimado": true
      },
      {
        "id": "e01017",
        "codigo": "01017",
        "nombre": "Fibrinogeno",
        "precio": 17.5
      }
    ]
  },
  {
    "id": "inmunohematologia",
    "nombre": "Inmunohematología",
    "examenes": [
      {
        "id": "e02001",
        "codigo": "02001",
        "nombre": "Grupo sanguineo y RH",
        "precio": 12,
        "estimado": true,
        "tiempo": "1 A 3 HORAS"
      },
      {
        "id": "e02002",
        "codigo": "02002",
        "nombre": "Prueba cruzada",
        "precio": 12,
        "estimado": true
      },
      {
        "id": "e02003",
        "codigo": "02003",
        "nombre": "Coombs directo",
        "precio": 12,
        "estimado": true
      },
      {
        "id": "e02004",
        "codigo": "02004",
        "nombre": "Coombs indirecto",
        "precio": 12,
        "estimado": true
      },
      {
        "id": "e02005",
        "codigo": "02005",
        "nombre": "Anticuerpos anti-RH",
        "precio": 12,
        "estimado": true
      }
    ]
  },
  {
    "id": "quimicasanguinea",
    "nombre": "Química sanguínea",
    "examenes": [
      {
        "id": "e03001",
        "codigo": "03001",
        "nombre": "Glucosa en sangre",
        "precio": 6.4,
        "nota": "Ayuno de 8 a 12h o según indicación medica",
        "tiempo": "3 horas"
      },
      {
        "id": "e03002",
        "codigo": "03002",
        "nombre": "Glucosa post-prandial (2 horas)",
        "precio": 8,
        "estimado": true,
        "nota": "El paciente debe de venir en ayuno de 10 horas minimo y 12 horas maximo. Le tomaran las muestras en ayuno, luego la m…"
      },
      {
        "id": "e03003",
        "codigo": "03003",
        "nombre": "Tolerancia glucosa 2 horas",
        "precio": 8,
        "estimado": true,
        "nota": "Permanecera en el laboratorio 2:30h y cada hora entregara muestra en orina",
        "tiempo": "3 horas"
      },
      {
        "id": "e03004",
        "codigo": "03004",
        "nombre": "Tolerancia glucosa 3 horas con prudex",
        "precio": 8,
        "estimado": true,
        "nota": "Permanecera en el laboratorio 3:30h y cada hora entregara muestra en orina",
        "tiempo": "4 horas"
      },
      {
        "id": "e03005",
        "codigo": "03005",
        "nombre": "Tolerancia glucosa 5 horas con prudex",
        "precio": 8,
        "estimado": true,
        "nota": "Permanecera en el laboratorio 5:30h y cada hora entregara muestra de orina.",
        "tiempo": "6 horas"
      },
      {
        "id": "e03006",
        "codigo": "03006",
        "nombre": "Glucosa post-ingesto dextrosa 75 gr.",
        "precio": 8,
        "estimado": true,
        "nota": "Ayuno de 8 a 12h o según indicación medica",
        "tiempo": "3 horas"
      },
      {
        "id": "e03007",
        "codigo": "03007",
        "nombre": "Hemoglobina a1c",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03008",
        "codigo": "03008",
        "nombre": "Test de o'sullivan",
        "precio": 8,
        "estimado": true,
        "nota": "Permanecer en el laboratorio 1 hora posterior a la toma de prudex",
        "tiempo": "2 horas"
      },
      {
        "id": "e03009",
        "codigo": "03009",
        "nombre": "Nitrogeno ureico (bun)",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e03010",
        "codigo": "03010",
        "nombre": "Creatinina en sangre",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e03011",
        "codigo": "03011",
        "nombre": "Depuracion de creatinina. orina en 24 h. mujer",
        "precio": 8,
        "estimado": true,
        "nota": "Para poder recolectar, lo puede hacer en un galón de agua, ejemplo: el galón de agua alpina , la primera orina debe d…"
      },
      {
        "id": "e03012",
        "codigo": "03012",
        "nombre": "Trigliceridos",
        "precio": 8,
        "estimado": true,
        "nota": "Ayuno de 8 a 14h o según indicación medica",
        "tiempo": "1 hora"
      },
      {
        "id": "e03013",
        "codigo": "03013",
        "nombre": "Colesterol total",
        "precio": 8,
        "estimado": true,
        "nota": "Ayuno de 8 a 14h o según indicación medica",
        "tiempo": "1 hora"
      },
      {
        "id": "e03014",
        "codigo": "03014",
        "nombre": "Colesterol alta densidad ( h.d.l ) (baja densidad)",
        "precio": 8,
        "estimado": true,
        "nota": "Ayuno de 8 a 14h o según indicación medica",
        "tiempo": "1 hora"
      },
      {
        "id": "e03015",
        "codigo": "03015",
        "nombre": "Colesterol baja densidad ( l.d.l ) (alta densidad)",
        "precio": 8,
        "estimado": true,
        "nota": "Ayuno de 8 a 14h o según indicación medica",
        "tiempo": "1 hora"
      },
      {
        "id": "e03016",
        "codigo": "03016",
        "nombre": "Colesterol muy baja densidad (vldl)",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03017",
        "codigo": "03017",
        "nombre": "Proteina serica y relacion a/g",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03018",
        "codigo": "03018",
        "nombre": "Acido urico en sangre",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e03019",
        "codigo": "03019",
        "nombre": "Sodio en sangre",
        "precio": 8,
        "estimado": true,
        "tiempo": "45 minutos"
      },
      {
        "id": "e03020",
        "codigo": "03020",
        "nombre": "Electrolitos en orina de 24 horas",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03021",
        "codigo": "03021",
        "nombre": "Potasio en sangre",
        "precio": 8,
        "estimado": true,
        "tiempo": "45 minutos"
      },
      {
        "id": "e03022",
        "codigo": "03022",
        "nombre": "Cloro en sangre",
        "precio": 8,
        "estimado": true,
        "tiempo": "45 minutos"
      },
      {
        "id": "e03023",
        "codigo": "03023",
        "nombre": "Calcio en sangre",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03024",
        "codigo": "03024",
        "nombre": "Fosforo en sangre",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03025",
        "codigo": "03025",
        "nombre": "Magnesio en sangre",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03026",
        "codigo": "03026",
        "nombre": "Bilirrubina diferencial (bb.:t.d.i.)",
        "precio": 8,
        "estimado": true,
        "nota": "Ninguna o según indicación médica",
        "tiempo": "1 hora"
      },
      {
        "id": "e03027",
        "codigo": "03027",
        "nombre": "Hierro total",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e03028",
        "codigo": "03028",
        "nombre": "Captacion y fijacion de hierro",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03029",
        "codigo": "03029",
        "nombre": "Ferritina",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e03030",
        "codigo": "03030",
        "nombre": "Transferrina",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e03031",
        "codigo": "03031",
        "nombre": "Vitamina b-12",
        "precio": 8,
        "estimado": true,
        "nota": "Ayuno de 8 a 12h o según indicación medica",
        "tiempo": "2 o 3 horas"
      },
      {
        "id": "e03032",
        "codigo": "03032",
        "nombre": "Proteina en orina de 24 horas",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03033",
        "codigo": "03033",
        "nombre": "Micro albuminuria en orina de 24 horas",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03034",
        "codigo": "03034",
        "nombre": "Fosforo en orina de 24 horas",
        "precio": 8,
        "estimado": true
      },
      {
        "id": "e03035",
        "codigo": "03035",
        "nombre": "Niveles de vitamina d",
        "precio": 8,
        "estimado": true,
        "tiempo": "2 o 3 horas"
      }
    ]
  },
  {
    "id": "enzimas",
    "nombre": "Enzimas",
    "examenes": [
      {
        "id": "e04001",
        "codigo": "04001",
        "nombre": "S.g.o.t",
        "precio": 10,
        "estimado": true
      },
      {
        "id": "e04002",
        "codigo": "04002",
        "nombre": "S.g.p.t",
        "precio": 10,
        "estimado": true
      },
      {
        "id": "e04003",
        "codigo": "04003",
        "nombre": "Fosfatasa alcalina",
        "precio": 10,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e04004",
        "codigo": "04004",
        "nombre": "Amilasa en sangre",
        "precio": 10,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e04005",
        "codigo": "04005",
        "nombre": "Lipasa",
        "precio": 10,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e04006",
        "codigo": "04006",
        "nombre": "Gamma glutamil transferrasa (ggt)",
        "precio": 10,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e04007",
        "codigo": "04007",
        "nombre": "Deshidrogenasa lactica ( l.d.h )",
        "precio": 10,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e04008",
        "codigo": "04008",
        "nombre": "Creatino fosfoquinasa total ( cpk )",
        "precio": 10,
        "estimado": true
      },
      {
        "id": "e04009",
        "codigo": "04009",
        "nombre": "Creatino fosfoquinasa fraccion mb (cpk/m",
        "precio": 10,
        "estimado": true
      },
      {
        "id": "e04010",
        "codigo": "04010",
        "nombre": "Proteina c. reactiva cardiaca",
        "precio": 10,
        "estimado": true,
        "tiempo": "1 hora"
      }
    ]
  },
  {
    "id": "inmunologia",
    "nombre": "Inmunología",
    "examenes": [
      {
        "id": "e05001",
        "codigo": "05001",
        "nombre": "Antigenos febriles",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05002",
        "codigo": "05002",
        "nombre": "Gonadotropina corionica cuantit.(bhcg)",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05003",
        "codigo": "05003",
        "nombre": "Monotest(mononucleosis) ac.heterofilo",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05004",
        "codigo": "05004",
        "nombre": "Anti-estreptolisina \"o\" (a.s.t.o.)",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05005",
        "codigo": "05005",
        "nombre": "Prueba de artritis reumatoidea.latex ra",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05006",
        "codigo": "05006",
        "nombre": "Prueba de latex l.e.",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05007",
        "codigo": "05007",
        "nombre": "Proteina c. reactiva (p.c.r)",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05008",
        "codigo": "05008",
        "nombre": "Prueba de embarazo en sangre",
        "precio": 24,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e05009",
        "codigo": "05009",
        "nombre": "Anticuerpos antinucleares (ana)",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05010",
        "codigo": "05010",
        "nombre": "Anticardiolipina IGG",
        "precio": 24,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e05011",
        "codigo": "05011",
        "nombre": "Anticardiolipina IGM",
        "precio": 24,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e05012",
        "codigo": "05012",
        "nombre": "Ac. lupus anticoagulante",
        "precio": 24,
        "estimado": true,
        "tiempo": "Si se lo realiza en la mañana el resultado esta en la tarde y si se lo realiza en la tarde esta hasta el siguiente día"
      },
      {
        "id": "e05013",
        "codigo": "05013",
        "nombre": "Anticuerpos antifosfolipidos",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05014",
        "codigo": "05014",
        "nombre": "Anticuerpos antimitocondriales",
        "precio": 24,
        "estimado": true
      },
      {
        "id": "e05016",
        "codigo": "05016",
        "nombre": "Prueba de chagas",
        "precio": 24,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e05017",
        "codigo": "05017",
        "nombre": "H. pylori /en suero",
        "precio": 41.5
      },
      {
        "id": "e05019",
        "codigo": "05019",
        "nombre": "Espermograma",
        "precio": 17.5,
        "nota": "Abstinencia sexual y de masturbaciones mínimo de 3 días y un máximo de 5 días",
        "tiempo": "8 horas"
      }
    ]
  },
  {
    "id": "endocrinologia",
    "nombre": "Endocrinología",
    "examenes": [
      {
        "id": "e06001",
        "codigo": "06001",
        "nombre": "Insulina en ayuno",
        "precio": 26,
        "estimado": true,
        "nota": "Ayuno de 8 a 12h o según indicación medica",
        "tiempo": "2 o 3 horas"
      },
      {
        "id": "e06002",
        "codigo": "06002",
        "nombre": "T-3",
        "precio": 26,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e06003",
        "codigo": "06003",
        "nombre": "T3- libre",
        "precio": 26,
        "estimado": true
      },
      {
        "id": "e06004",
        "codigo": "06004",
        "nombre": "T-4",
        "precio": 26,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e06005",
        "codigo": "06005",
        "nombre": "T-4 libre",
        "precio": 26,
        "estimado": true
      },
      {
        "id": "e06006",
        "codigo": "06006",
        "nombre": "TSH 3ra. generacion (ultrasensitiva)",
        "precio": 26,
        "estimado": true
      },
      {
        "id": "e06007",
        "codigo": "06007",
        "nombre": "Hormona foliculo estimulante (FSH)",
        "precio": 26,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e06008",
        "codigo": "06008",
        "nombre": "Hormona luteinizante (LH)",
        "precio": 26,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e06009",
        "codigo": "06009",
        "nombre": "Prolactina",
        "precio": 26,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e06010",
        "codigo": "06010",
        "nombre": "Insulina post-prandial",
        "precio": 26,
        "estimado": true,
        "nota": "Ayuno de 8 a 12h o según indicación medica"
      }
    ]
  },
  {
    "id": "biologiamolecular",
    "nombre": "Biología molecular",
    "examenes": [
      {
        "id": "e07001",
        "codigo": "07001",
        "nombre": "Virus del papiloma humano",
        "precio": 90,
        "nota": "* No realizarse lavados vaginales. * No utilizar tampones. * No usar medicamentos vaginales durante al menos 48 horas…",
        "tiempo": "8 DIAS"
      },
      {
        "id": "e07002",
        "codigo": "07002",
        "nombre": "Chlamydia trachomatis (c.t)",
        "precio": 85,
        "estimado": true,
        "nota": "* No realizarse lavados vaginales. * No utilizar tampones. * No usar medicamentos vaginales durante al menos 48 horas…"
      },
      {
        "id": "e07003",
        "codigo": "07003",
        "nombre": "Neisseria gonorrhoeae",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07004",
        "codigo": "07004",
        "nombre": "Streptococus",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07005",
        "codigo": "07005",
        "nombre": "CA- 15-3 mama",
        "precio": 85,
        "estimado": true,
        "tiempo": "3 Horas"
      },
      {
        "id": "e07006",
        "codigo": "07006",
        "nombre": "Brca 1, 2 y tp53",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07007",
        "codigo": "07007",
        "nombre": "CA de prostata (pca3)",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07008",
        "codigo": "07008",
        "nombre": "Visibilit (trisomia 18 y 21)",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07009",
        "codigo": "07009",
        "nombre": "Maternit21 (trisomia 13, 18 y 21)",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07010",
        "codigo": "07010",
        "nombre": "Cariotipo mas fish en liquido amniotico",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07011",
        "codigo": "07011",
        "nombre": "Fibrosis quistica",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07012",
        "codigo": "07012",
        "nombre": "Cariotipo",
        "precio": 85,
        "estimado": true
      },
      {
        "id": "e07013",
        "codigo": "07013",
        "nombre": "Hormona antimulleriana",
        "precio": 85,
        "estimado": true
      }
    ]
  },
  {
    "id": "marcadorestumorales",
    "nombre": "Marcadores tumorales",
    "examenes": [
      {
        "id": "e08001",
        "codigo": "08001",
        "nombre": "Antigeno prostatico especifico total(PSA)",
        "precio": 62,
        "estimado": true,
        "nota": "Ayuno de 8 a 12 horas y evitar relaciones sexuales y masturbaciones por 24h antes de la prueba",
        "tiempo": "2 o 3 horas"
      },
      {
        "id": "e08002",
        "codigo": "08002",
        "nombre": "Antigeno prostatico especifico libre (PSA libre)",
        "precio": 62,
        "estimado": true,
        "nota": "Ayuno de 8 a 12 horas y evitar relaciones sexuales y masturbaciones por 24h antes de la prueba",
        "tiempo": "2 o 3 horas"
      },
      {
        "id": "e08003",
        "codigo": "08003",
        "nombre": "Antigeno carbohidrato CA 19-9 estomago",
        "precio": 81.9,
        "tiempo": "3 horas"
      },
      {
        "id": "e08004",
        "codigo": "08004",
        "nombre": "CEA (antigeno carcinoembrionario)",
        "precio": 62,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e08005",
        "codigo": "08005",
        "nombre": "CA-125 ovario",
        "precio": 62,
        "estimado": true
      },
      {
        "id": "e08006",
        "codigo": "08006",
        "nombre": "CA- 15-3 seno",
        "precio": 62,
        "estimado": true
      },
      {
        "id": "e08007",
        "codigo": "08007",
        "nombre": "Alfa feto proteina (AFP)",
        "precio": 62,
        "estimado": true
      }
    ]
  },
  {
    "id": "infecciosas",
    "nombre": "Infecciosas",
    "examenes": [
      {
        "id": "e09001",
        "codigo": "09001",
        "nombre": "H.i.v.",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09003",
        "codigo": "09003",
        "nombre": "Fta/abs",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09004",
        "codigo": "09004",
        "nombre": "Antigeno australiano.ag.hbs p.hepatitis",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09005",
        "codigo": "09005",
        "nombre": "Anticuerpos toxoplasmosis ig \"g\"",
        "precio": 32,
        "estimado": true,
        "tiempo": "3 horas"
      },
      {
        "id": "e09006",
        "codigo": "09006",
        "nombre": "Anticuerpos toxoplasmosis ig \"m\"",
        "precio": 40.9,
        "tiempo": "3 horas"
      },
      {
        "id": "e09007",
        "codigo": "09007",
        "nombre": "Anticuerpos rubeola ig \"g\"",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09008",
        "codigo": "09008",
        "nombre": "Anticuerpos rubeola ig \"m\"",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09009",
        "codigo": "09009",
        "nombre": "Anticuerpos ig \"m\" para hepatitis \"a\"",
        "precio": 32,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e09010",
        "codigo": "09010",
        "nombre": "Anticuerpos p/ hepatitis \"c\"",
        "precio": 32,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e09011",
        "codigo": "09011",
        "nombre": "Prueba rápida p/anticuerpos covid-19 IGG e IGM",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09012",
        "codigo": "09012",
        "nombre": "Prueba rápida p/antígeno covid-19",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09013",
        "codigo": "09013",
        "nombre": "P.r.s. (prueba rápida para sífilis) VDRL",
        "precio": 11.7,
        "tiempo": "1 hora"
      },
      {
        "id": "e09014",
        "codigo": "09014",
        "nombre": "Prueba rápida p/antígeno covid-19 (internos)",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09015",
        "codigo": "09015",
        "nombre": "Prueba rápida p/antígeno covid-19 (empresarial)",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09016",
        "codigo": "09016",
        "nombre": "Hisopado para covid impressa repuestos",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09017",
        "codigo": "09017",
        "nombre": "Antigeno covid para estudiantes",
        "precio": 32,
        "estimado": true
      },
      {
        "id": "e09018",
        "codigo": "09018",
        "nombre": "Prueba rapida covid (a)",
        "precio": 32,
        "estimado": true
      }
    ]
  },
  {
    "id": "bacteriologia",
    "nombre": "Bacteriología",
    "examenes": [
      {
        "id": "e10001",
        "codigo": "10001",
        "nombre": "Cultivo y antibiograma para no bar",
        "precio": 26,
        "estimado": true
      },
      {
        "id": "e10002",
        "codigo": "10002",
        "nombre": "Coloracion de gram",
        "precio": 26,
        "estimado": true
      },
      {
        "id": "e10003",
        "codigo": "10003",
        "nombre": "Cultivo p/acido resistente - baar",
        "precio": 26,
        "estimado": true
      },
      {
        "id": "e10004",
        "codigo": "10004",
        "nombre": "Directo al fresco secrecion",
        "precio": 26,
        "estimado": true
      },
      {
        "id": "e10005",
        "codigo": "10005",
        "nombre": "Directo al fresco secrecion vaginal",
        "precio": 26,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e10006",
        "codigo": "10006",
        "nombre": "Urocultivo",
        "precio": 25.7,
        "nota": "Realizar aseo, preferiblemente la primera muestra de la mañana o según indicación médica.",
        "tiempo": "48 horas (3 días)"
      },
      {
        "id": "e10007",
        "codigo": "10007",
        "nombre": "Coprocultivo",
        "precio": 26,
        "estimado": true,
        "nota": "no supositorios, que contenga orina la muestra",
        "tiempo": "48 horas"
      },
      {
        "id": "e10008",
        "codigo": "10008",
        "nombre": "Hemocultivo",
        "precio": 26,
        "estimado": true,
        "tiempo": "6 días"
      },
      {
        "id": "e10009",
        "codigo": "10009",
        "nombre": "Cultivo y antibiograma semen",
        "precio": 25.7
      }
    ]
  },
  {
    "id": "heces",
    "nombre": "Heces",
    "examenes": [
      {
        "id": "e11001",
        "codigo": "11001",
        "nombre": "General de heces",
        "precio": 9,
        "estimado": true,
        "nota": "No hacer uso de supositorios",
        "tiempo": "1 hora"
      },
      {
        "id": "e11002",
        "codigo": "11002",
        "nombre": "Sangre oculta en heces",
        "precio": 9,
        "estimado": true,
        "nota": "72 horas antes no ingerir carnes rojas, remolacha, aspirinas, vitamina c y los suplementos medicamentos que contengan…",
        "tiempo": "1 hora"
      },
      {
        "id": "e11003",
        "codigo": "11003",
        "nombre": "Citologia moco fecal-azul de metileno",
        "precio": 9,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e11004",
        "codigo": "11004",
        "nombre": "Rotavirus en heces",
        "precio": 9,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e11005",
        "codigo": "11005",
        "nombre": "Sustancias reductoras en heces",
        "precio": 9,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e11006",
        "codigo": "11006",
        "nombre": "Ph en heces",
        "precio": 9,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e11007",
        "codigo": "11007",
        "nombre": "Inmunofluorescencia/salmonella tiphy",
        "precio": 9,
        "estimado": true,
        "tiempo": "2 horas"
      },
      {
        "id": "e11008",
        "codigo": "11008",
        "nombre": "Helicobacter pilory en heces",
        "precio": 58.5,
        "nota": "Dejar de tomar cualquier antibiotico 2 semanas antes o medicamentos que contengan bismuto como peptobismol",
        "tiempo": "1 hora"
      },
      {
        "id": "e11009",
        "codigo": "11009",
        "nombre": "Antígeno para salmonella tiphy en heces",
        "precio": 9,
        "estimado": true,
        "tiempo": "2 horas"
      }
    ]
  },
  {
    "id": "orina",
    "nombre": "Orina",
    "examenes": [
      {
        "id": "e12001",
        "codigo": "12001",
        "nombre": "General de orina",
        "precio": 8,
        "estimado": true,
        "nota": "Realizar aseo, no usar cremas vaginales y la paciente no debe de andar con el periodo mestrual, (o según indicación m…",
        "tiempo": "1 hora"
      },
      {
        "id": "e12002",
        "codigo": "12002",
        "nombre": "Prueba de embarazo en orina",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      },
      {
        "id": "e12003",
        "codigo": "12003",
        "nombre": "Albumina en orina al azar",
        "precio": 8,
        "estimado": true,
        "tiempo": "1 hora"
      }
    ]
  }
];

/** Índice plano, para resolver un id sin recorrer las áreas. */
export const EXAMENES: Record<string, Examen & { area: string }> = Object.fromEntries(
  AREAS.flatMap((a) => a.examenes.map((e) => [e.id, { ...e, area: a.nombre }])),
);

export function esExamen(id: string): boolean {
  return id in EXAMENES;
}

/** Lo que cuesta un examen, en dólares. */
export function precioDe(id: string): number {
  return EXAMENES[id]?.precio ?? 0;
}

/** Lo que cuesta una lista de exámenes. */
export function valorDe(ids: string[]): number {
  return Math.round(ids.reduce((n, id) => n + precioDe(id), 0) * 100) / 100;
}

/** Agrupa una lista de ids por área, respetando el orden del catálogo. */
export function agrupar(ids: string[]): { area: string; examenes: Examen[] }[] {
  return AREAS.map((a) => ({
    area: a.nombre,
    examenes: a.examenes.filter((e) => ids.includes(e.id)),
  })).filter((g) => g.examenes.length > 0);
}

/**
 * Las indicaciones previas de una lista de exámenes, sin repetir.
 *
 * El ayuno se resuelve aparte: si hay varios, manda el más largo. Mandar los
 * dos ("ayuno de 8 horas" y "ayuno de 12 horas") es la forma más rápida de que
 * alguien llegue con el ayuno equivocado.
 */
export function preparacion(ids: string[]): string[] {
  const notas = ids.map((id) => EXAMENES[id]?.nota).filter((n): n is string => Boolean(n));
  const horas = notas
    .map((n) => Number((n.match(/ayuno de (\d+)/i) ?? [])[1]))
    .filter((h) => Number.isFinite(h) && h > 0);
  const otras = [...new Set(notas.filter((n) => !/ayuno de \d+/i.test(n)))];
  const ayuno = horas.length ? [`ayuno de ${Math.max(...horas)} horas`] : [];
  return [...ayuno, ...otras];
}
