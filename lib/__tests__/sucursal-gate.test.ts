// Las dos barandas del agente: pregunta de sucursal obligatoria y tope duro de
// mensajes. Son funciones puras, así que se prueban enteras sin WhatsApp ni
// Claude. Si alguien afloja una de las dos, aquí se cae.
import { describe, it, expect } from "vitest";
import {
  CIERRE_POR_LIMITE,
  LIMITE_MENSAJES_IA_DEFAULT,
  PREGUNTA_SUCURSAL_CUENTA,
  contextoSucursal,
  decidirTurno,
  interpretarSucursal,
  limiteDe,
  mensajesQueCuentan,
  type EstadoTurno,
} from "@/lib/sucursal-gate";
import { yalySucursales } from "@/lib/tenants/yaly-sucursales";
import { TENANTS } from "@/lib/tenants";

function estado(over: Partial<EstadoTurno> = {}): EstadoTurno {
  return {
    sucursales: yalySucursales,
    limite: 10,
    mensajesAgente: 0,
    mensajesSucursal: 0,
    sucursalId: null,
    intentos: 0,
    textoCliente: "",
    ...over,
  };
}

describe("la pregunta de sucursal es el primer mensaje, siempre", () => {
  it("con la conversación en blanco, lo primero es preguntar la sucursal", () => {
    const d = decidirTurno(estado({ textoCliente: "hola, quiero una habitación" }));
    expect(d.tipo).toBe("preguntar_sucursal");
    if (d.tipo === "preguntar_sucursal") expect(d.texto).toBe(yalySucursales.pregunta);
  });

  it("no importa qué escriba el contacto primero: igual se pregunta", () => {
    for (const texto of [
      "quiero reservar del 12 al 15 para 4 personas",
      "¿cuánto cuesta?",
      "hola",
      "",
    ]) {
      expect(decidirTurno(estado({ textoCliente: texto })).tipo).toBe("preguntar_sucursal");
    }
  });

  it("ese primer mensaje NO llama al modelo (sale del guion, no de Claude)", () => {
    const d = decidirTurno(estado());
    // Si la decisión trae texto, el envío es determinista: cero tokens.
    expect(d).toHaveProperty("texto");
    expect(d.tipo).not.toBe("responder_ia");
  });

  it("con la sucursal ya elegida no se vuelve a preguntar", () => {
    const d = decidirTurno(estado({ sucursalId: "b", intentos: 1, mensajesAgente: 1 }));
    expect(d.tipo).toBe("responder_ia");
    if (d.tipo === "responder_ia") {
      expect(d.sucursal?.id).toBe("b");
      expect(d.recienElegida).toBe(false);
    }
  });

  it("una respuesta válida abre la conversación con la IA", () => {
    const d = decidirTurno(estado({ intentos: 1, mensajesAgente: 1, textoCliente: "la B" }));
    expect(d.tipo).toBe("responder_ia");
    if (d.tipo === "responder_ia") {
      expect(d.sucursal?.id).toBe("b");
      expect(d.recienElegida).toBe(true);
    }
  });

  it("una respuesta que no se entiende se reformula, no se ignora", () => {
    const d = decidirTurno(estado({ intentos: 1, mensajesAgente: 1, textoCliente: "no sé" }));
    expect(d.tipo).toBe("reintentar_sucursal");
    if (d.tipo === "reintentar_sucursal") {
      expect(d.texto).toBe(yalySucursales.reintento);
      // La reformulación no es un copiar y pegar de la pregunta.
      expect(d.texto).not.toBe(yalySucursales.pregunta);
    }
  });

  it("tras agotar los reintentos pasa a una persona, no deja al lead colgado", () => {
    const d = decidirTurno(
      estado({
        intentos: yalySucursales.maxReintentos + 1,
        mensajesAgente: 3,
        textoCliente: "ninguna",
      }),
    );
    expect(d.tipo).toBe("handoff_sucursal");
    if (d.tipo === "handoff_sucursal") expect(d.texto).toBe(yalySucursales.handoff);
  });

  it("un cliente sin sedes declaradas responde normal desde el primer mensaje", () => {
    const d = decidirTurno(estado({ sucursales: undefined, textoCliente: "hola" }));
    expect(d.tipo).toBe("responder_ia");
    if (d.tipo === "responder_ia") expect(d.sucursal).toBeNull();
  });
});

describe("identificar la sucursal en lo que escribe el contacto", () => {
  const casos: Array<[string, string | null]> = [
    ["A", "a"],
    ["a", "a"],
    ["la a", "a"],
    ["A)", "a"],
    ["opción B", "b"],
    ["b por favor", "b"],
    ["3", "c"],
    ["la tercera", "c"],
    ["sucursal c", "c"],
    ["Sucursal B", "b"],
    ["hola buenas tardes", null],
    ["quiero una habitación", null],
    ["", null],
    ["no sé cuál", null],
  ];

  for (const [texto, esperado] of casos) {
    it(`"${texto}" -> ${esperado ?? "sin identificar"}`, () => {
      expect(interpretarSucursal(texto, yalySucursales)?.id ?? null).toBe(esperado);
    });
  }

  it("si el texto calza con dos sedes no adivina: prefiere volver a preguntar", () => {
    expect(interpretarSucursal("entre la a y la b", yalySucursales)).toBeNull();
    expect(interpretarSucursal("la a o la c", yalySucursales)).toBeNull();
  });

  // REGRESIÓN: con substring crudo, "hola buenas tardes" contiene "la b" y el
  // huésped terminaba en la sucursal B sin haberla pedido.
  it("un alias que cae partido dentro de otra palabra no cuenta", () => {
    expect(interpretarSucursal("hola buenas tardes", yalySucursales)).toBeNull();
    expect(interpretarSucursal("holanda", yalySucursales)).toBeNull();
  });

  // REGRESIÓN: en español "a" es preposición. Sin el tope de palabras,
  // "quiero ir a la playa" elegía la sucursal A.
  it("una letra suelta dentro de una frase larga no cuenta como elección", () => {
    expect(interpretarSucursal("quiero ir a la playa este fin", yalySucursales)).toBeNull();
    expect(interpretarSucursal("quiero reservar para agosto", yalySucursales)).toBeNull();
    expect(interpretarSucursal("cuanto cuesta", yalySucursales)).toBeNull();
  });

  // Los números en un hotel son cantidades, no sedes.
  it("no hay alias que choquen con cantidades ('dos noches', 'tres personas')", () => {
    expect(interpretarSucursal("queremos dos noches", yalySucursales)).toBeNull();
    expect(interpretarSucursal("somos tres personas", yalySucursales)).toBeNull();
    const alias = yalySucursales.opciones.flatMap((o) => o.alias);
    for (const prohibido of ["uno", "dos", "tres"]) expect(alias).not.toContain(prohibido);
  });

  // Nombrar la sede completa sí funciona aunque el mensaje sea largo.
  it("nombrar la sucursal dentro de una frase larga sí cuenta", () => {
    expect(interpretarSucursal("buenas, escribo a la sucursal b por favor", yalySucursales)?.id).toBe(
      "b",
    );
  });

  it("la sede identificada se le inyecta al guion de la IA", () => {
    const s = yalySucursales.opciones[0];
    const ctx = contextoSucursal(s);
    expect(ctx).toContain(s.nombre);
    expect(ctx).toMatch(/NO se la vuelvas a preguntar/);
    expect(contextoSucursal(null)).toBe("");
  });
});

describe("tope duro de mensajes por conversación", () => {
  it("el default es 10", () => {
    expect(LIMITE_MENSAJES_IA_DEFAULT).toBe(10);
    expect(limiteDe(undefined)).toBe(10);
    expect(limiteDe(0)).toBe(10);
    expect(limiteDe(4)).toBe(4);
  });

  // DECISIÓN: la pregunta de sucursal SÍ entra en el presupuesto de 10.
  it("la pregunta de sucursal cuenta dentro del tope", () => {
    expect(PREGUNTA_SUCURSAL_CUENTA).toBe(true);
    expect(mensajesQueCuentan({ mensajesAgente: 4, mensajesSucursal: 2 })).toBe(4);
  });

  it("con 8 mensajes enviados todavía responde normal", () => {
    const d = decidirTurno(estado({ mensajesAgente: 8, sucursalId: "a", intentos: 1 }));
    expect(d.tipo).toBe("responder_ia");
  });

  it("el último cupo se gasta en el cierre, no en media respuesta", () => {
    const d = decidirTurno(estado({ mensajesAgente: 9, sucursalId: "a", intentos: 1 }));
    expect(d.tipo).toBe("cerrar_por_limite");
    if (d.tipo === "cerrar_por_limite") expect(d.texto).toBe(CIERRE_POR_LIMITE);
  });

  it("pasado el tope se calla: ni un token más", () => {
    for (const n of [10, 11, 50]) {
      const d = decidirTurno(estado({ mensajesAgente: n, sucursalId: "a", intentos: 1 }));
      expect(d.tipo).toBe("silencio");
    }
  });

  it("el tope gana sobre la pregunta de sucursal (no se pregunta al infinito)", () => {
    const d = decidirTurno(estado({ mensajesAgente: 10, intentos: 3, textoCliente: "que?" }));
    expect(d.tipo).toBe("silencio");
  });

  it("el agente NUNCA manda más de `limite` mensajes, simulando la conversación", () => {
    // Simulación completa: el contacto nunca elige sucursal y sigue escribiendo.
    const limite = 10;
    let enviados = 0;
    let intentos = 0;
    for (let turno = 0; turno < 40; turno++) {
      const d = decidirTurno(
        estado({ limite, mensajesAgente: enviados, intentos, textoCliente: "hmm" }),
      );
      if (d.tipo === "silencio") break;
      if (d.tipo === "preguntar_sucursal" || d.tipo === "reintentar_sucursal") intentos++;
      enviados++;
    }
    expect(enviados).toBeLessThanOrEqual(limite);
  });

  it("un tope propio del tenant manda sobre el default", () => {
    const d = decidirTurno(estado({ limite: 3, mensajesAgente: 2, sucursalId: "a", intentos: 1 }));
    expect(d.tipo).toBe("cerrar_por_limite");
  });
});

describe("cableado del tenant yaly", () => {
  it("declara sus sedes y su tope", () => {
    expect(TENANTS.yaly.sucursales).toBe(yalySucursales);
    expect(TENANTS.yaly.ai.limiteMensajes).toBe(LIMITE_MENSAJES_IA_DEFAULT);
  });

  it("es el único cliente con la pregunta de sucursal encendida", () => {
    const conSedes = Object.values(TENANTS).filter((t) => t.sucursales);
    expect(conSedes.map((t) => t.id)).toEqual(["yaly"]);
  });

  it("los mensajes fijos no dejan al lead sin siguiente paso", () => {
    for (const texto of [yalySucursales.handoff, CIERRE_POR_LIMITE]) {
      expect(texto.length).toBeGreaterThan(30);
      expect(texto.toLowerCase()).toMatch(/persona|equipo/);
      expect(texto).not.toContain("—");
    }
  });
});
