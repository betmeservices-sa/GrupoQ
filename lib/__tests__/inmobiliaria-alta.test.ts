// El alta desde el teléfono: qué se le exige al agente antes de guardar, cómo
// se arma la ficha y que la propiedad nueva aparezca de verdad en la cartera.
import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizarTelefono,
  propiedadDesdeAlta,
  resumenDesdeAlta,
  siguienteCodigo,
  telefonoValido,
  tituloDesdeAlta,
  validarAlta,
  type AltaPropiedad,
} from "@/lib/inmobiliaria-alta";
import {
  agregarPropiedad,
  buscarPropiedad,
  cargarCartera,
  guardarFoto,
  limpiarDemo,
  marcarPublicada,
  propiedadesDelDemo,
  todasLasPropiedades,
} from "@/lib/inmobiliaria-store";
import { armarAnuncio } from "@/lib/inmobiliaria-publicacion";
import { PROPIEDADES } from "@/lib/inmobiliaria-datos";
import type { Foto } from "@/lib/inmobiliaria-tipos";

const FOTO: Foto = { src: "/api/inmobiliaria/foto/f1", ambiente: "fachada", ancho: 1440, alto: 1080 };

function alta(over: Partial<AltaPropiedad> = {}): AltaPropiedad {
  return {
    operacion: "venta",
    tipo: "casa",
    precio: 165000,
    zona: "Residencial Las Colinas",
    municipio: "Santa Tecla",
    habitaciones: 3,
    banos: 2.5,
    parqueos: 2,
    areaConstruccion: 160,
    areaTerreno: 200,
    descripcion: "Casa con patio grande y cocina remodelada.",
    propietario: { nombre: "Ana Cecilia Reyes", telefono: "7412 8890" },
    exclusiva: false,
    fotos: [FOTO],
    ...over,
  };
}

describe("lo que se le exige al agente antes de guardar", () => {
  it("una ficha completa pasa", () => {
    expect(validarAlta(alta())).toEqual([]);
  });

  it("devuelve todos los problemas juntos, no de a uno", () => {
    const malos = validarAlta({ operacion: "venta", tipo: "casa", fotos: [] });
    const campos = malos.map((m) => m.campo);
    expect(malos.length).toBeGreaterThan(4);
    expect(campos).toContain("precio");
    expect(campos).toContain("zona");
    expect(campos).toContain("propietario");
    expect(campos).toContain("fotos");
  });

  it("sin una sola foto no se guarda: el anuncio no existe sin fotos", () => {
    expect(validarAlta(alta({ fotos: [] })).some((m) => m.campo === "fotos")).toBe(true);
  });

  it("a un terreno no se le piden habitaciones ni baños", () => {
    const t = alta({ tipo: "terreno", habitaciones: 0, banos: 0, areaConstruccion: 0, areaTerreno: 800 });
    expect(validarAlta(t)).toEqual([]);
  });

  it("a un terreno sin medida sí se le reclama el área", () => {
    const t = alta({ tipo: "terreno", habitaciones: 0, banos: 0, areaConstruccion: 0, areaTerreno: 0 });
    expect(validarAlta(t).map((m) => m.campo)).toContain("areaTerreno");
  });

  // Una renta de cinco cifras casi siempre es el precio de venta mal metido.
  it("avisa cuando la renta se ve como precio de venta", () => {
    const r = validarAlta(alta({ operacion: "alquiler", precio: 165000 }));
    expect(r.some((m) => m.campo === "precio")).toBe(true);
    expect(validarAlta(alta({ operacion: "alquiler", precio: 650 }))).toEqual([]);
  });

  it("el teléfono del propietario es salvadoreño de ocho dígitos", () => {
    expect(telefonoValido("7412 8890")).toBe(true);
    expect(telefonoValido("+503 2264 7719")).toBe(true);
    expect(telefonoValido("50376294980")).toBe(true);
    expect(telefonoValido("1234")).toBe(false);
    expect(telefonoValido("9412 8890")).toBe(false);
    expect(normalizarTelefono("74128890")).toBe("+503 7412 8890");
  });
});

describe("la ficha que se arma con lo que dijo", () => {
  it("el título sale de los datos, sin adjetivos que nadie dijo", () => {
    expect(tituloDesdeAlta(alta())).toBe("Casa de 3 habitaciones en Residencial Las Colinas, Santa Tecla");
    expect(tituloDesdeAlta(alta({ tipo: "terreno" }))).toBe("Terreno en Residencial Las Colinas, Santa Tecla");
  });

  it("sin descripción dictada, el resumen repite la ficha y nada más", () => {
    expect(resumenDesdeAlta(alta({ descripcion: "  " }))).toBe(
      "Casa de 3 habitaciones en Residencial Las Colinas, Santa Tecla.",
    );
    expect(resumenDesdeAlta(alta())).toBe("Casa con patio grande y cocina remodelada.");
  });

  it("entra disponible y SIN publicar: publicada se marca cuando el post sale", () => {
    const p = propiedadDesdeAlta(alta(), { id: "n1", codigo: "TZ-201" });
    expect(p.estado).toBe("disponible");
    expect(p.publicada).toBe(false);
    expect(p.caracteristicas).toEqual([]);
  });

  it("el depósito y el plazo solo viajan si es alquiler", () => {
    const renta = propiedadDesdeAlta(
      alta({ operacion: "alquiler", precio: 650, deposito: 650, plazoMinimoMeses: 12 }),
      { id: "n2", codigo: "TZ-202" },
    );
    expect(renta.deposito).toBe(650);
    expect(renta.plazoMinimoMeses).toBe(12);

    const venta = propiedadDesdeAlta(alta({ deposito: 650, plazoMinimoMeses: 12 }), {
      id: "n3",
      codigo: "TZ-203",
    });
    expect(venta.deposito).toBeUndefined();
    expect(venta.plazoMinimoMeses).toBeUndefined();
  });

  it("el teléfono se guarda como se marca, no como lo escribió", () => {
    const p = propiedadDesdeAlta(alta(), { id: "n4", codigo: "TZ-204" });
    expect(p.propietario.telefono).toBe("+503 7412 8890");
  });

  it("el código sigue la serie que el agente dice por teléfono", () => {
    expect(siguienteCodigo(["TZ-101", "TZ-112", "TZ-103"])).toBe("TZ-113");
    expect(siguienteCodigo([])).toBe("TZ-101");
    expect(siguienteCodigo(["otra-cosa"])).toBe("TZ-101");
  });
});

describe("la propiedad nueva vive en el mismo almacén del demo", () => {
  beforeEach(() => limpiarDemo());

  it("aparece en la cartera y se abre por id y por código", () => {
    const codigo = siguienteCodigo(todasLasPropiedades().map((p) => p.codigo));
    const semilla = propiedadDesdeAlta(alta(), { id: "nueva1", codigo });
    agregarPropiedad(semilla);

    const cartera = cargarCartera("2026-08-12");
    expect(cartera.resumen.total).toBe(PROPIEDADES.length + 1);
    expect(cartera.propiedades[0].codigo).toBe(codigo); // lo nuevo va primero
    expect(buscarPropiedad("nueva1")?.codigo).toBe(codigo);
    expect(buscarPropiedad(codigo)?.id).toBe("nueva1");
    expect(propiedadesDelDemo()).toHaveLength(1);
  });

  it("la nueva arma su anuncio como cualquier otra", () => {
    const semilla = propiedadDesdeAlta(alta(), { id: "nueva2", codigo: "TZ-301" });
    agregarPropiedad(semilla);
    const a = armarAnuncio(buscarPropiedad("nueva2")!);
    expect(a.bloqueo).toBeNull();
    expect(a.portada.foto?.src).toBe(FOTO.src);
    expect(a.titulo).toContain("Santa Tecla");
    expect(a.descripcion).toContain("$165,000");
  });

  it("se marca publicada cuando el post sale, no antes", () => {
    agregarPropiedad(propiedadDesdeAlta(alta(), { id: "nueva3", codigo: "TZ-302" }));
    expect(buscarPropiedad("nueva3")?.publicada).toBe(false);
    marcarPublicada("nueva3");
    expect(buscarPropiedad("nueva3")?.publicada).toBe(true);
    expect(marcarPublicada("no-existe")).toBeNull();
  });

  it("las semillas no se tocan", () => {
    agregarPropiedad(propiedadDesdeAlta(alta(), { id: "nueva4", codigo: "TZ-303" }));
    expect(PROPIEDADES.some((p) => p.id === "nueva4")).toBe(false);
    limpiarDemo();
    expect(cargarCartera("2026-08-12").resumen.total).toBe(PROPIEDADES.length);
  });
});

describe("las fotos que llegan del teléfono", () => {
  beforeEach(() => limpiarDemo());

  it("una foto de verdad se guarda y queda con su ruta para servirla", () => {
    // Un JPEG mínimo en base64 (los primeros bytes de cabecera alcanzan: aquí
    // solo se prueba el guardado, no el decodificado).
    const dataUrl = `data:image/jpeg;base64,${Buffer.from("fotito").toString("base64")}`;
    const g = guardarFoto(dataUrl, 1440, 1080);
    expect(g?.src).toMatch(/^\/api\/inmobiliaria\/foto\//);
  });

  it("lo que no es una imagen no entra", () => {
    expect(guardarFoto("javascript:alert(1)", 100, 100)).toBeNull();
    expect(guardarFoto("data:text/html;base64,PGI+", 100, 100)).toBeNull();
    expect(guardarFoto("", 100, 100)).toBeNull();
  });
});
