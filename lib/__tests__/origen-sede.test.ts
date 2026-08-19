// De qué hotel viene el contacto y por qué link. Lo que cuidan estas pruebas:
//   - que cada perfil tenga su link, con su frase y sus UTMs;
//   - que el mensaje que deja ese link identifique hotel Y canal;
//   - que el referral de un anuncio identifique la sede;
//   - que si el primer mensaje ya dice el hotel, el agente NO lo vuelva a
//     preguntar (era la queja: tres perfiles de Instagram, un solo WhatsApp);
//   - que cuando NO se puede saber, se siga preguntando en vez de adivinar.
import { describe, it, expect } from "vitest";
import {
  destinoWhatsApp,
  enlaceDeTexto,
  enlacePorCodigo,
  enlacesDe,
  fraseDeEnlace,
  urlDeEnlace,
} from "@/lib/enlaces";
import { origenDelContacto, sedeDeOrigen } from "@/lib/origen-sede";
import { decidirTurno } from "@/lib/sucursal-gate";
import { yalySucursales } from "@/lib/tenants/yaly-sucursales";

const [YALI, COSTA, LINDA] = yalySucursales.opciones;
const NUMERO = "+503 7629 4980";
const ENLACES = enlacesDe(yalySucursales);

describe("los links de cada perfil", () => {
  it("hay uno por sede y por canal, con código único", () => {
    expect(ENLACES).toHaveLength(9); // 3 hoteles x 3 canales
    expect(new Set(ENLACES.map((e) => e.codigo)).size).toBe(9);
    expect(new Set(ENLACES.map((e) => e.frase)).size).toBe(9);
  });

  it("el link pasa por nuestro dominio y lleva los UTMs, no por wa.me", () => {
    const ig = enlacePorCodigo("yali-ig", yalySucursales)!;
    const url = urlDeEnlace("https://demo.miagentia.com/", ig);
    expect(url).toContain("https://demo.miagentia.com/ir/yali-ig?");
    expect(url).toContain("utm_source=instagram");
    expect(url).toContain("utm_medium=bio");
    expect(url).toContain("utm_campaign=yali");
    expect(url).not.toContain("wa.me");
  });

  it("el destino final sí es wa.me, con el número limpio y el mensaje escrito", () => {
    const ig = enlacePorCodigo("costa-del-surf-ig", yalySucursales)!;
    const destino = destinoWhatsApp(NUMERO, ig);
    expect(destino.startsWith("https://wa.me/50376294980?text=")).toBe(true);
    expect(decodeURIComponent(destino)).toContain(ig.frase);
  });

  it("un código inventado no devuelve nada (nadie termina en otro WhatsApp)", () => {
    expect(enlacePorCodigo("no-existe", yalySucursales)).toBeNull();
  });

  it("la frase del link dice el hotel y el canal", () => {
    for (const e of ENLACES) {
      expect(e.frase).toContain(e.canal);
      expect(e.frase).toContain(e.sedeNombre);
      expect(enlaceDeTexto(e.frase, yalySucursales)?.codigo).toBe(e.codigo);
    }
  });

  it("un mensaje cualquiera no se confunde con un link", () => {
    expect(enlaceDeTexto("Hola, buenas tardes", yalySucursales)).toBeNull();
  });
});

describe("origen del contacto", () => {
  it("por link: sabe el hotel Y de qué perfil salió", () => {
    const o = origenDelContacto(
      { texto: fraseDeEnlace(LINDA, "Instagram") },
      yalySucursales,
    );
    expect(o?.sede.id).toBe(LINDA.id);
    expect(o?.enlace?.canal).toBe("Instagram");
    expect(o?.via).toBe("enlace");
  });

  it("por anuncio: lo saca del titular", () => {
    const o = origenDelContacto(
      { texto: "Hola", referral: { headline: "Escapate a Costa del Surf este fin de semana" } },
      yalySucursales,
    );
    expect(o?.sede.id).toBe(COSTA.id);
    expect(o?.via).toBe("anuncio");
    expect(o?.enlace).toBeNull();
  });

  it("por anuncio: lo saca de la URL si el texto no dice nada", () => {
    const o = origenDelContacto(
      { texto: "Hola", referral: { source_url: "https://www.yalihospitality.com/playa-linda" } },
      yalySucursales,
    );
    expect(o?.sede.id).toBe(LINDA.id);
  });

  it("el anuncio manda sobre el texto, que el huésped pudo editar", () => {
    const o = origenDelContacto(
      {
        texto: fraseDeEnlace(YALI, "Instagram"),
        referral: { headline: "Costa del Surf, Playa Las Flores" },
      },
      yalySucursales,
    );
    expect(o?.sede.id).toBe(COSTA.id);
  });

  it("si editó el mensaje pero dejó el nombre, al menos se saca el hotel", () => {
    const o = origenDelContacto({ texto: "hola, es playa linda?" }, yalySucursales);
    expect(o?.sede.id).toBe(LINDA.id);
    expect(o?.via).toBe("texto");
    expect(o?.enlace).toBeNull();
  });
});

describe("cuándo NO se puede saber", () => {
  it("un saludo suelto no identifica nada", () => {
    expect(origenDelContacto({ texto: "Hola, buenas tardes" }, yalySucursales)).toBeNull();
  });

  it("un anuncio que no nombra ninguna sede no inventa una", () => {
    expect(
      origenDelContacto({ referral: { headline: "Vacaciones frente al mar" } }, yalySucursales),
    ).toBeNull();
  });

  it("sin sedes declaradas no hay nada que deducir", () => {
    expect(sedeDeOrigen({ texto: "Hola, vengo del Instagram de Yalí" }, undefined)).toBeNull();
  });
});

describe("la baranda de apertura respeta lo que ya sabemos", () => {
  const base = {
    sucursales: yalySucursales,
    limite: 10,
    mensajesAgente: 0,
    mensajesSucursal: 0,
    sucursalId: null,
    intentos: 0,
  };

  it("si el mensaje del link ya dice el hotel, no lo vuelve a preguntar", () => {
    const d = decidirTurno({ ...base, textoCliente: fraseDeEnlace(LINDA, "Instagram") });
    expect(d.tipo).toBe("responder_ia");
    if (d.tipo === "responder_ia") {
      expect(d.sucursal?.id).toBe(LINDA.id);
      expect(d.recienElegida).toBe(true);
    }
  });

  it("con la sede deducida del anuncio tampoco pregunta", () => {
    const d = decidirTurno({ ...base, textoCliente: "Hola", origenSede: YALI });
    expect(d.tipo).toBe("responder_ia");
    if (d.tipo === "responder_ia") expect(d.sucursal?.id).toBe(YALI.id);
  });

  it("si el primer mensaje no dice nada, sigue preguntando como siempre", () => {
    const d = decidirTurno({ ...base, textoCliente: "Hola, buenas" });
    expect(d.tipo).toBe("preguntar_sucursal");
  });
});
