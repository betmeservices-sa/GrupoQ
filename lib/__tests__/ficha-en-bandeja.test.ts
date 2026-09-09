// La bandeja mostrando el nombre de la ficha en vez del número.
//
// El caso real: en Contactos la persona aparece como "Karla Menjívar" y en la
// bandeja como "7539-1721". Son dos almacenes distintos y el teléfono no está
// guardado igual en los dos, que es lo que hacía que no cruzaran.

import { describe, expect, it } from "vitest";
import {
  claveTelefono,
  conFicha,
  esSoloElNumero,
  indexarFichas,
  nombreDeFicha,
  type ContactoBandeja,
} from "@/lib/ficha-en-bandeja";

/** Como llega un contacto de la bandeja: el nombre puede ser solo el numero. */
const deBandeja = (c: ContactoBandeja): ContactoBandeja => c;

const FICHAS = indexarFichas([
  { telefono: "50370020001", nombre: "Karla", apellido: "Menjívar", correo: "karla@correo.com" },
  // Como la guarda el CSV: sin país. Es la misma persona que la de arriba en
  // otro formato, y este es justo el cruce que fallaba.
  { telefono: "75391721", nombre: "Bryan", notas: "Interesado en Tucson" },
]);

describe("el teléfono, venga como venga escrito", () => {
  it("los últimos ocho son la llave", () => {
    for (const t of ["+503 7539 1721", "50375391721", "75391721", "(503) 7539-1721"]) {
      expect(claveTelefono(t), t).toBe("75391721");
    }
  });

  it("sin teléfono no hay llave", () => {
    expect(claveTelefono("")).toBe("");
    expect(claveTelefono(null)).toBe("");
    expect(claveTelefono(undefined)).toBe("");
  });
});

describe("qué es un nombre y qué es un número disfrazado", () => {
  it('"7539-1721" no es un nombre', () => {
    expect(esSoloElNumero("7539-1721", "50375391721")).toBe(true);
    expect(esSoloElNumero("+50375391721", "50375391721")).toBe(true);
  });

  it("un nombre de verdad sí lo es, aunque lleve números", () => {
    expect(esSoloElNumero("Karla Menjívar", "50375391721")).toBe(false);
    expect(esSoloElNumero("Taller 2000", "50375391721")).toBe(false);
  });

  it("un número que NO es el suyo tampoco se reemplaza", () => {
    // Si alguien puso otro teléfono como nombre, no es "el número de este chat"
    // y no se toca: no sabemos qué quiso decir.
    expect(esSoloElNumero("2222-3333", "50375391721")).toBe(false);
  });
});

describe("la bandeja con la ficha encima", () => {
  it("cambia el número por el nombre completo de la ficha", () => {
    const r = conFicha({ nombre: "7002-0001", telefono: "50370020001", canal: "whatsapp" }, FICHAS);
    expect(r.nombre).toBe("Karla Menjívar");
  });

  it("cruza aunque la ficha esté guardada sin el país", () => {
    const r = conFicha({ nombre: "7539-1721", telefono: "50375391721", canal: "whatsapp" }, FICHAS);
    expect(r.nombre).toBe("Bryan");
  });

  it("NO pisa el nombre que ya mostraba la bandeja", () => {
    // Si Meta mandó el nombre del perfil de WhatsApp, ese es el que la persona
    // eligió mostrar y vale más que lo que alguien tecleó en Contactos.
    const r = conFicha({ nombre: "Karlita", telefono: "50370020001", canal: "whatsapp" }, FICHAS);
    expect(r.nombre).toBe("Karlita");
  });

  it("trae también el correo y las notas, para el panel de la derecha", () => {
    const r = conFicha(deBandeja({ nombre: "7002-0001", telefono: "50370020001" }), FICHAS);
    expect(r.correo).toBe("karla@correo.com");
    const b = conFicha(deBandeja({ nombre: "7539-1721", telefono: "50375391721" }), FICHAS);
    expect(b.notas).toBe("Interesado en Tucson");
  });

  it("lo que ya tenía la bandeja gana sobre lo de la ficha", () => {
    const r = conFicha(
      { nombre: "7002-0001", telefono: "50370020001", correo: "el-que-escribio@chat.com", canal: "whatsapp" },
      FICHAS,
    );
    expect(r.correo).toBe("el-que-escribio@chat.com");
  });

  it("sin ficha, el contacto sale intacto y es el MISMO objeto", () => {
    // Devolver una copia haría que React redibujara la bandeja entera en cada
    // sondeo, cada cuatro segundos, sin que hubiera cambiado nada.
    const c = { nombre: "2222-3333", telefono: "50322223333", canal: "whatsapp" as const };
    expect(conFicha(c, FICHAS)).toBe(c);
  });

  it("con ficha que no agrega nada, también devuelve el mismo objeto", () => {
    const c = { nombre: "Karlita", telefono: "50370020001", correo: "ya@tengo.com", canal: "whatsapp" as const };
    expect(conFicha(c, FICHAS)).toBe(c);
  });
});

describe("indexar", () => {
  it("entre dos fichas del mismo número, gana la que tiene nombre", () => {
    const m = indexarFichas([
      { telefono: "50370020009", nombre: "" },
      { telefono: "70020009", nombre: "Rina", apellido: "Castellanos" },
    ]);
    expect(nombreDeFicha(m.get("70020009"))).toBe("Rina Castellanos");
  });

  it("una ficha sin teléfono no entra", () => {
    expect(indexarFichas([{ telefono: "", nombre: "Nadie" }]).size).toBe(0);
  });

  it("una ficha sin nombre no devuelve nada que mostrar", () => {
    expect(nombreDeFicha({ telefono: "70020001" })).toBe("");
    expect(nombreDeFicha(undefined)).toBe("");
  });
});
