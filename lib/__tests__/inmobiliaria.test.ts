import { describe, it, expect } from "vitest";
import { DEMO_LOGINS, TENANTS, isTenantId, resolveTenantByLogin } from "@/lib/tenants";
import { MODULO_RUTA, moduloDeRuta, ROLES } from "@/lib/roles";
import { LEADS, PROPIEDADES } from "@/lib/inmobiliaria-datos";
import {
  agruparPorEtapa,
  agruparPorPagoYEtapa,
  construirPipeline,
  contarSinTocar,
  dineroEnJuego,
  diasEntre,
  ordenarPorAbandono,
  restarDias,
  resolverLead,
  resumirPorEtapa,
  resumirPorFormaPago,
  sumarDias,
  urgenciaDe,
} from "@/lib/inmobiliaria-pipeline";
import {
  construirCartera,
  filtrarCartera,
  resolverPropiedad,
} from "@/lib/inmobiliaria-cartera";
import {
  armarAnuncio,
  datosDePortada,
  departamentoDe,
  descripcionDe,
  encuentra24De,
  ordenarFotos,
  tituloDe,
} from "@/lib/inmobiliaria-publicacion";
import { dinero, dineroCorto, desdeHace, varas } from "@/lib/inmobiliaria-formato";
import { ETAPAS, FORMAS_PAGO, type LeadSemilla, type PropiedadSemilla } from "@/lib/inmobiliaria-tipos";

const HOY = "2026-08-12";

describe("tenant inmobiliaria", () => {
  it("la contraseña miagentiabienes entra a la inmobiliaria", () => {
    expect(resolveTenantByLogin("demoagentia", "miagentiabienes")).toBe("inmobiliaria");
  });

  it("usa el mismo usuario que los demás clientes", () => {
    const usuarios = new Set(
      DEMO_LOGINS.filter((l) => l.usuario === "demoagentia").map((l) => l.tenant),
    );
    expect(usuarios.has("inmobiliaria")).toBe(true);
  });

  it("no le roba la contraseña a ninguno de los otros cinco", () => {
    expect(resolveTenantByLogin("demoagentia", "demoh")).toBe("hospital");
    expect(resolveTenantByLogin("demoagentia", "demoi")).toBe("grupoq");
    expect(resolveTenantByLogin("demoagentia", "demoj")).toBe("excel");
    expect(resolveTenantByLogin("demoagentia", "demok")).toBe("miagentia");
    expect(resolveTenantByLogin("demoagentia", "miagentiahotel")).toBe("hotel");
  });

  it("cada contraseña resuelve a un solo cliente", () => {
    const porClave = new Map<string, string>();
    for (const l of DEMO_LOGINS.filter((x) => x.usuario === "demoagentia")) {
      expect(porClave.has(l.password)).toBe(false);
      porClave.set(l.password, l.tenant);
    }
  });

  it("queda registrado como tenant válido", () => {
    expect(isTenantId("inmobiliaria")).toBe(true);
    expect(TENANTS.inmobiliaria.id).toBe("inmobiliaria");
    expect(TENANTS.inmobiliaria.seed.staff.length).toBeGreaterThan(0);
    expect(TENANTS.inmobiliaria.tags.length).toBeGreaterThan(0);
    expect(TENANTS.inmobiliaria.brand.nombre).toBe("Terrazul Bienes Raíces");
  });

  it("ningún texto del cliente usa guiones largos ni agendamiento", () => {
    const t = TENANTS.inmobiliaria;
    const textos = [
      t.ai.systemPrompt,
      t.brand.nombre,
      t.brand.tagline,
      ...t.tags,
      ...t.waTemplates.flatMap((w) => w.components.map((c) => c.text ?? "")),
      ...t.seed.messages.map((m) => m.texto),
      ...t.seed.internalMessages.map((m) => m.texto),
      ...t.seed.socialPosts.map((p) => p.texto),
      ...PROPIEDADES.map((p) => `${p.titulo} ${p.resumen} ${p.caracteristicas.join(" ")}`),
      ...LEADS.map((l) => `${l.busca} ${l.nota ?? ""}`),
    ];
    for (const texto of textos) {
      expect(texto).not.toContain("—");
      expect(texto.toLowerCase()).not.toContain("agendamiento");
    }
  });
});

describe("el guion de Marcela califica antes de vender", () => {
  const p = TENANTS.inmobiliaria.ai.systemPrompt;

  it("pide siempre la forma de pago y nombra las tres del mercado", () => {
    expect(p).toMatch(/LA FORMA DE PAGO ES LO MÁS IMPORTANTE/);
    expect(p).toContain("Fondo Social para la Vivienda");
    expect(p).toContain("crédito de banco");
    expect(p).toContain("de contado");
  });

  it("no descarta al que todavía no puede comprar", () => {
    expect(p).toMatch(/NO lo despidas/);
    expect(p).toMatch(/vuelven en unos meses/i);
  });

  it("prohíbe inventar propiedades y prometer créditos o rebajas", () => {
    expect(p).toMatch(/NUNCA inventes propiedades, precios, medidas, direcciones ni fotos/);
    expect(p).toMatch(/NUNCA prometas que le van a aprobar un crédito/);
    expect(p).toMatch(/NUNCA prometas rebajas/);
    expect(p).toMatch(/NUNCA des el nombre ni el teléfono del propietario/);
  });

  it("manda decir de una vez si algo está apartado o vendido", () => {
    expect(p).toMatch(/apartada o vendida, dilo de una vez/);
  });

  it("nombra las herramientas exactamente como están cableadas", () => {
    for (const t of ["guardar_datos_contacto", "consultar_disponibilidad", "confirmar_cita", "reaccionar"]) {
      expect(p).toContain(t);
    }
    expect(p).not.toContain("reservar_habitacion");
  });
});

describe("navegación propia de la inmobiliaria", () => {
  it("las tres pantallas tienen ruta y se resuelven desde el pathname", () => {
    expect(MODULO_RUTA.pipeline).toBe("/pipeline");
    expect(MODULO_RUTA.cartera).toBe("/cartera");
    expect(MODULO_RUTA.publicacion).toBe("/publicacion");
    expect(moduloDeRuta("/pipeline")).toBe("pipeline");
    expect(moduloDeRuta("/cartera")).toBe("cartera");
    expect(moduloDeRuta("/cartera/p1")).toBe("cartera");
    expect(moduloDeRuta("/publicacion")).toBe("publicacion");
  });

  it("el pipeline es de quien vende, no de marketing", () => {
    for (const rol of ["medico", "jefe", "gerente_marketing", "admin", "recepcion"] as const) {
      expect(ROLES[rol].ve).toContain("pipeline");
    }
    expect(ROLES.marketing.ve).not.toContain("pipeline");
  });

  it("marketing sí arma publicaciones y ve la cartera", () => {
    expect(ROLES.marketing.ve).toContain("cartera");
    expect(ROLES.marketing.ve).toContain("publicacion");
  });

  it("las rutas de los demás módulos no se movieron", () => {
    expect(MODULO_RUTA.bandeja).toBe("/");
    expect(MODULO_RUTA.habitaciones).toBe("/habitaciones");
    expect(moduloDeRuta("/")).toBe("bandeja");
    expect(moduloDeRuta("/settings")).toBe("settings");
    expect(moduloDeRuta("/privacy")).toBeNull();
  });
});

// ── Pipeline ──

function lead(over: Partial<LeadSemilla> = {}): LeadSemilla {
  return {
    id: "x1",
    nombre: "Prueba",
    canal: "whatsapp",
    etapa: "nuevo",
    formaPago: "banco",
    presupuesto: 100000,
    zona: "Santa Tecla",
    busca: "Casa",
    hace: 0,
    asesorId: "s2",
    ...over,
  };
}

describe("fechas del pipeline", () => {
  it("resta y suma días cruzando fin de mes", () => {
    expect(restarDias("2026-08-02", 5)).toBe("2026-07-28");
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("cuenta los días entre dos fechas", () => {
    expect(diasEntre("2026-08-01", "2026-08-12")).toBe(11);
    expect(diasEntre("2026-08-12", "2026-08-01")).toBe(-11);
  });

  it("el último contacto se calcula contra hoy, así el demo no envejece", () => {
    expect(resolverLead(lead({ hace: 4 }), HOY).ultimoContacto).toBe("2026-08-08");
    expect(resolverLead(lead({ hace: 0 }), HOY).ultimoContacto).toBe(HOY);
  });
});

describe("urgencia de un lead", () => {
  it("el que está vivo se enfría en días", () => {
    expect(urgenciaDe("calificado", 1)).toBe("al_dia");
    expect(urgenciaDe("calificado", 4)).toBe("enfriando");
    expect(urgenciaDe("visita", 12)).toBe("abandonado");
  });

  // "No calificado" no es basura: no puede comprar TODAVÍA, así que su reloj es
  // de meses. Medirlo con la misma vara pintaría de rojo a medio tablero.
  it("el no calificado se mide en meses, no en días", () => {
    expect(urgenciaDe("no_calificado", 12)).toBe("al_dia");
    expect(urgenciaDe("no_calificado", 50)).toBe("enfriando");
    expect(urgenciaDe("no_calificado", 95)).toBe("abandonado");
  });

  it("el cerrado ya no corre", () => {
    expect(urgenciaDe("cerrado", 300)).toBe("al_dia");
  });
});

describe("resúmenes del pipeline", () => {
  const leads = [
    lead({ id: "a", formaPago: "contado", presupuesto: 400000, etapa: "oferta" }),
    lead({ id: "b", formaPago: "fsv", presupuesto: 78000, etapa: "calificado" }),
    lead({ id: "c", formaPago: "fsv", presupuesto: 82000, etapa: "visita" }),
    lead({ id: "d", formaPago: "banco", presupuesto: 200000, etapa: "cerrado" }),
    lead({ id: "e", formaPago: "sin_definir", presupuesto: 95000, etapa: "no_calificado", hace: 100 }),
  ].map((l) => resolverLead(l, HOY));

  it("cuenta leads y dinero por forma de pago, con las cuatro siempre presentes", () => {
    const r = resumirPorFormaPago(leads);
    expect(r.map((x) => x.formaPago)).toEqual(FORMAS_PAGO);
    expect(r.find((x) => x.formaPago === "fsv")!.leads).toBe(2);
    expect(r.find((x) => x.formaPago === "fsv")!.monto).toBe(160000);
    expect(r.find((x) => x.formaPago === "contado")!.monto).toBe(400000);
  });

  it("cuenta leads y dinero por etapa, con las seis siempre presentes", () => {
    const r = resumirPorEtapa(leads);
    expect(r.map((x) => x.etapa)).toEqual(ETAPAS);
    expect(r.find((x) => x.etapa === "oferta")!.leads).toBe(1);
    expect(r.find((x) => x.etapa === "nuevo")!.leads).toBe(0);
  });

  // Lo que se puede ganar hoy: ni el cerrado ni el que no califica.
  it("el dinero en juego deja fuera al cerrado y al no calificado", () => {
    expect(dineroEnJuego(leads)).toBe(400000 + 78000 + 82000);
  });

  it("cuenta los que ya se enfriaron, sin contar cerrados", () => {
    const frios = [
      resolverLead(lead({ id: "f", hace: 20 }), HOY),
      resolverLead(lead({ id: "g", hace: 20, etapa: "cerrado" }), HOY),
      resolverLead(lead({ id: "h", hace: 1 }), HOY),
    ];
    expect(contarSinTocar(frios)).toBe(1);
  });
});

describe("armado del tablero", () => {
  const leads = [
    lead({ id: "a", hace: 2, presupuesto: 100000 }),
    lead({ id: "b", hace: 20, presupuesto: 90000 }),
    lead({ id: "c", hace: 2, presupuesto: 300000 }),
  ].map((l) => resolverLead(l, HOY));

  it("dentro de una columna manda el abandono", () => {
    expect(ordenarPorAbandono(leads).map((l) => l.id)).toEqual(["b", "c", "a"]);
  });

  it("agrupa por etapa sin perder a nadie", () => {
    const grupos = agruparPorEtapa(leads);
    expect(Object.keys(grupos)).toEqual(ETAPAS);
    expect(grupos.nuevo).toHaveLength(3);
    expect(grupos.oferta).toHaveLength(0);
  });

  // La vista de forma de pago NO puede perder la de etapas: es una matriz.
  it("agrupa por forma de pago sin perder la etapa", () => {
    const mixtos = [
      resolverLead(lead({ id: "a", formaPago: "fsv", etapa: "visita" }), HOY),
      resolverLead(lead({ id: "b", formaPago: "fsv", etapa: "oferta" }), HOY),
      resolverLead(lead({ id: "c", formaPago: "contado", etapa: "visita" }), HOY),
    ];
    const matriz = agruparPorPagoYEtapa(mixtos);
    expect(Object.keys(matriz)).toEqual(FORMAS_PAGO);
    expect(Object.keys(matriz.fsv)).toEqual(ETAPAS);
    expect(matriz.fsv.visita.map((l) => l.id)).toEqual(["a"]);
    expect(matriz.fsv.oferta.map((l) => l.id)).toEqual(["b"]);
    expect(matriz.contado.visita.map((l) => l.id)).toEqual(["c"]);
    expect(matriz.banco.visita).toHaveLength(0);
  });
});

describe("leads sembrados", () => {
  const pipeline = construirPipeline({ leads: LEADS, hoy: HOY });

  it("cubren las cuatro formas de pago y las seis etapas", () => {
    for (const p of FORMAS_PAGO) {
      expect(pipeline.leads.some((l) => l.formaPago === p)).toBe(true);
    }
    for (const e of ETAPAS) {
      expect(pipeline.leads.some((l) => l.etapa === e)).toBe(true);
    }
  });

  it("hay leads en rojo, que es lo que hace actuar al agente", () => {
    expect(pipeline.sinTocar).toBeGreaterThan(0);
    expect(pipeline.leads.some((l) => l.urgencia === "abandonado")).toBe(true);
  });

  it("cada lead trae lo que el agente necesita para llamar", () => {
    for (const l of pipeline.leads) {
      expect(l.nombre.length).toBeGreaterThan(2);
      expect(l.presupuesto).toBeGreaterThan(0);
      expect(l.zona.length).toBeGreaterThan(0);
      expect(l.busca.length).toBeGreaterThan(0);
      expect(["whatsapp", "messenger", "instagram", "comentario"]).toContain(l.canal);
    }
  });

  it("la propiedad de interés existe en la cartera", () => {
    const ids = new Set(PROPIEDADES.map((p) => p.id));
    for (const l of LEADS) {
      if (l.propiedadId) expect(ids.has(l.propiedadId)).toBe(true);
    }
  });
});

// ── Cartera ──

function propiedad(over: Partial<PropiedadSemilla> = {}): PropiedadSemilla {
  return {
    id: "x",
    codigo: "TZ-900",
    tipo: "casa",
    titulo: "Casa de prueba",
    zona: "Santa Tecla",
    municipio: "Santa Tecla",
    precio: 150000,
    estado: "disponible",
    publicada: true,
    habitaciones: 3,
    banos: 2,
    parqueos: 2,
    areaConstruccion: 150,
    areaTerreno: 200,
    propietario: { nombre: "Propietario Demo", telefono: "+503 7000 0000" },
    exclusiva: false,
    caracteristicas: ["Algo"],
    resumen: "Resumen",
    fotos: [
      { src: "/a.jpg", ambiente: "bano", ancho: 1080, alto: 810 },
      { src: "/b.jpg", ambiente: "fachada", ancho: 1080, alto: 810 },
      { src: "/c.jpg", ambiente: "sala", ancho: 1080, alto: 810 },
    ],
    ...over,
  };
}

describe("alertas de la cartera", () => {
  it("apartada o vendida y todavía publicada es la alerta cara", () => {
    expect(resolverPropiedad(propiedad({ estado: "apartada" }), HOY, []).publicadaSinEstar).toBe(true);
    expect(resolverPropiedad(propiedad({ estado: "vendida" }), HOY, []).publicadaSinEstar).toBe(true);
    expect(resolverPropiedad(propiedad({ estado: "disponible" }), HOY, []).publicadaSinEstar).toBe(false);
    expect(
      resolverPropiedad(propiedad({ estado: "apartada", publicada: false }), HOY, []).publicadaSinEstar,
    ).toBe(false);
  });

  it("la exclusiva se resuelve contra hoy y avisa antes de vencer", () => {
    const vencida = resolverPropiedad(
      propiedad({ exclusiva: true, exclusivaEnDias: -3 }),
      HOY,
      [],
    );
    expect(vencida.exclusivaHasta).toBe("2026-08-09");
    expect(vencida.exclusivaVencida).toBe(true);
    expect(vencida.exclusivaPorVencer).toBe(false);

    const porVencer = resolverPropiedad(propiedad({ exclusiva: true, exclusivaEnDias: 10 }), HOY, []);
    expect(porVencer.exclusivaPorVencer).toBe(true);
    expect(porVencer.exclusivaVencida).toBe(false);

    const tranquila = resolverPropiedad(propiedad({ exclusiva: true, exclusivaEnDias: 90 }), HOY, []);
    expect(tranquila.exclusivaPorVencer).toBe(false);
  });

  it("una propiedad sin exclusiva no inventa fecha", () => {
    const p = resolverPropiedad(propiedad(), HOY, []);
    expect(p.exclusivaHasta).toBeUndefined();
    expect(p.exclusivaVencida).toBe(false);
  });

  it("cuenta como interesados solo a los que pueden comprarla", () => {
    const leads = [
      lead({ id: "1", propiedadId: "x", etapa: "visita" }),
      lead({ id: "2", propiedadId: "x", etapa: "cerrado" }),
      lead({ id: "3", propiedadId: "x", etapa: "no_calificado" }),
      lead({ id: "4", propiedadId: "otra", etapa: "oferta" }),
    ];
    expect(resolverPropiedad(propiedad(), HOY, leads).interesados).toBe(1);
  });
});

describe("cartera sembrada", () => {
  const cartera = construirCartera({ propiedades: PROPIEDADES, leads: LEADS, hoy: HOY });

  it("resume lo que está a la venta", () => {
    expect(cartera.resumen.total).toBe(PROPIEDADES.length);
    expect(cartera.resumen.disponibles).toBeGreaterThan(0);
    expect(cartera.resumen.valorDisponible).toBeGreaterThan(0);
  });

  it("trae el error caro sembrado, para que se vea en el demo", () => {
    expect(cartera.alertas.publicadasSinEstar.length).toBeGreaterThan(0);
    expect(cartera.alertas.exclusivasVencidas.length).toBeGreaterThan(0);
    expect(cartera.alertas.exclusivasPorVencer.length).toBeGreaterThan(0);
  });

  it("cubre los cuatro tipos de propiedad", () => {
    for (const t of ["casa", "apartamento", "terreno", "local"]) {
      expect(cartera.propiedades.some((p) => p.tipo === t)).toBe(true);
    }
  });

  it("cada ficha trae fotos y propietario", () => {
    for (const p of cartera.propiedades) {
      expect(p.fotos.length).toBeGreaterThan(0);
      expect(p.propietario.nombre.length).toBeGreaterThan(3);
      for (const f of p.fotos) expect(f.src.startsWith("/inmobiliaria/")).toBe(true);
    }
  });

  it("los precios se mueven en el rango salvadoreño", () => {
    for (const p of cartera.propiedades) {
      expect(p.precio).toBeGreaterThanOrEqual(50000);
      expect(p.precio).toBeLessThanOrEqual(700000);
    }
  });
});

describe("filtros de la cartera", () => {
  const propiedades = [
    resolverPropiedad(propiedad({ id: "1", codigo: "TZ-901", tipo: "casa", municipio: "Santa Tecla" }), HOY, []),
    resolverPropiedad(
      propiedad({ id: "2", codigo: "TZ-902", tipo: "terreno", municipio: "La Libertad", estado: "vendida" }),
      HOY,
      [],
    ),
  ];

  it("filtra por tipo, estado y zona", () => {
    expect(filtrarCartera(propiedades, { tipo: "casa" })).toHaveLength(1);
    expect(filtrarCartera(propiedades, { estado: "vendida" })[0].codigo).toBe("TZ-902");
    expect(filtrarCartera(propiedades, { zona: "La Libertad" })).toHaveLength(1);
    expect(filtrarCartera(propiedades, {})).toHaveLength(2);
  });

  it("busca por código, zona o propietario", () => {
    expect(filtrarCartera(propiedades, { texto: "tz-902" })).toHaveLength(1);
    expect(filtrarCartera(propiedades, { texto: "propietario demo" })).toHaveLength(2);
    expect(filtrarCartera(propiedades, { texto: "nada" })).toHaveLength(0);
  });
});

// ── Publicación ──

describe("orden de las fotos del carrusel", () => {
  it("en una casa abre la fachada, no lo que subió primero el agente", () => {
    const p = resolverPropiedad(propiedad(), HOY, []);
    expect(ordenarFotos(p.fotos, "casa").map((f) => f.ambiente)).toEqual([
      "fachada",
      "sala",
      "bano",
    ]);
  });

  it("en un apartamento abre la sala, porque la fachada del edificio no vende", () => {
    const p = resolverPropiedad(propiedad(), HOY, []);
    expect(ordenarFotos(p.fotos, "apartamento")[0].ambiente).toBe("sala");
  });

  it("no pierde ni duplica fotos", () => {
    const p = resolverPropiedad(propiedad(), HOY, []);
    const ordenadas = ordenarFotos(p.fotos, "casa");
    expect(ordenadas).toHaveLength(p.fotos.length);
    expect(new Set(ordenadas.map((f) => f.src)).size).toBe(p.fotos.length);
  });

  it("respeta el orden de carga entre fotos del mismo ambiente", () => {
    const fotos = [
      { src: "/1.jpg", ambiente: "terreno" as const, ancho: 1080, alto: 810 },
      { src: "/2.jpg", ambiente: "terreno" as const, ancho: 1080, alto: 810 },
    ];
    expect(ordenarFotos(fotos, "terreno").map((f) => f.src)).toEqual(["/1.jpg", "/2.jpg"]);
  });
});

describe("texto del anuncio", () => {
  const casa = resolverPropiedad(propiedad({ anio: 2015 }), HOY, []);
  const terreno = resolverPropiedad(
    propiedad({ tipo: "terreno", habitaciones: 0, banos: 0, parqueos: 0, areaConstruccion: 0, areaTerreno: 850 }),
    HOY,
    [],
  );

  it("el título dice tipo, zona y lo que define a ese tipo", () => {
    expect(tituloDe(casa)).toBe("Casa en venta en Santa Tecla, Santa Tecla, 3 habitaciones");
    expect(tituloDe(terreno)).toContain("850 v²");
  });

  it("la descripción sale de la ficha, sin inventar nada", () => {
    const d = descripcionDe(casa);
    expect(d).toContain("Resumen");
    expect(d).toContain("3 habitaciones");
    expect(d).toContain("150 m² de construcción");
    expect(d).toContain("200 v² de terreno");
    expect(d).toContain("$150,000");
    expect(d).toContain("TZ-900");
  });

  it("un terreno no habla de habitaciones ni de baños", () => {
    const d = descripcionDe(terreno);
    expect(d).not.toContain("habitacion");
    expect(d).not.toContain("baño");
    expect(datosDePortada(terreno)).toEqual(["850 v²"]);
  });

  it("la versión del portal trae los campos y el departamento correcto", () => {
    const t = encuentra24De(casa);
    expect(t).toContain("Título: Casa en venta en Santa Tecla");
    expect(t).toContain("Precio: US$ 150,000");
    expect(t).toContain("Departamento: La Libertad");
    expect(t).toContain("Área de terreno: 200 v²");
    expect(t).toContain("Código: TZ-900");
    expect(departamentoDe("San Salvador")).toBe("San Salvador");
    expect(departamentoDe("Antiguo Cuscatlán")).toBe("La Libertad");
    expect(departamentoDe("Colón")).toBe("La Libertad");
  });
});

describe("anuncio completo", () => {
  it("la portada se arma con la primera foto ordenada y los datos de la ficha", () => {
    const a = armarAnuncio(resolverPropiedad(propiedad(), HOY, []));
    expect(a.portada.foto?.ambiente).toBe("fachada");
    expect(a.portada.precio).toBe("$150,000");
    expect(a.portada.zona).toBe("Santa Tecla, Santa Tecla");
    expect(a.portada.datos).toEqual(["3 hab", "2 baños", "150 m²"]);
    expect(a.carrusel[0]).toEqual(a.portada.foto);
  });

  it("una propiedad vendida se bloquea, no se publica", () => {
    const a = armarAnuncio(resolverPropiedad(propiedad({ estado: "vendida" }), HOY, []));
    expect(a.bloqueo).toContain("TZ-900");
    expect(a.bloqueo).toContain("vendida");
  });

  it("una apartada se advierte, pero se puede publicar diciéndolo", () => {
    const a = armarAnuncio(resolverPropiedad(propiedad({ estado: "apartada" }), HOY, []));
    expect(a.bloqueo).toBeNull();
    expect(a.advertencia).toContain("apartada");
  });

  it("avisa de la exclusiva vencida antes de gastar en pauta", () => {
    const a = armarAnuncio(
      resolverPropiedad(propiedad({ exclusiva: true, exclusivaEnDias: -5 }), HOY, []),
    );
    expect(a.advertencia).toContain("exclusiva venció");
  });

  it("una disponible sin líos no trae bloqueo ni advertencia", () => {
    const a = armarAnuncio(resolverPropiedad(propiedad(), HOY, []));
    expect(a.bloqueo).toBeNull();
    expect(a.advertencia).toBeNull();
  });

  it("nunca mete el teléfono ni el nombre del propietario en el anuncio", () => {
    const p = resolverPropiedad(propiedad(), HOY, []);
    const a = armarAnuncio(p);
    const todo = `${a.titulo} ${a.descripcion} ${a.encuentra24} ${a.hashtags.join(" ")}`;
    expect(todo).not.toContain(p.propietario.nombre);
    expect(todo).not.toContain(p.propietario.telefono);
  });

  it("todas las propiedades sembradas arman anuncio sin romperse", () => {
    for (const semilla of PROPIEDADES) {
      const a = armarAnuncio(resolverPropiedad(semilla, HOY, LEADS));
      expect(a.titulo.length).toBeGreaterThan(10);
      expect(a.carrusel.length).toBeGreaterThan(0);
      expect(a.portada.foto).not.toBeNull();
      expect(a.hashtags.length).toBeGreaterThan(3);
    }
  });
});

describe("formato de dinero y medidas", () => {
  it("el dólar va sin centavos", () => {
    expect(dinero(425000)).toBe("$425,000");
    expect(dinero(76500.4)).toBe("$76,500");
  });

  it("los totales de columna se acortan", () => {
    expect(dineroCorto(89000)).toBe("$89k");
    expect(dineroCorto(1460000)).toBe("$1.5M");
    expect(dineroCorto(750)).toBe("$750");
  });

  it("el tiempo sin contacto se dice como lo diría el agente", () => {
    expect(desdeHace(0)).toBe("hoy");
    expect(desdeHace(1)).toBe("ayer");
    expect(desdeHace(9)).toBe("hace 9 días");
    expect(desdeHace(31)).toBe("hace un mes");
    expect(desdeHace(95)).toBe("hace 3 meses");
  });

  it("el terreno se mide en varas, como en la escritura", () => {
    expect(varas(850)).toBe("850 v²");
  });
});
