// Tenant "yaly" (Hotel Yaly, 3 sucursales). Lo que cuidan estas pruebas:
//   - que quede registrado como cliente sin pisarle la contraseña a nadie;
//   - que los nombres de sucursal salgan de UN solo archivo;
//   - que el guion no contradiga las barandas (pregunta de sucursal, tope de
//     mensajes, fotos que sí puede ver);
//   - que NO se haya tocado el tenant "hotel", que es un cliente real.
import { describe, it, expect } from "vitest";
import { DEMO_LOGINS, TENANTS, isTenantId, resolveTenantByLogin } from "@/lib/tenants";
import {
  MARCA_PLACEHOLDER,
  tienePlaceholders,
  yalySucursales,
} from "@/lib/tenants/yaly-sucursales";
import { LIMITE_MENSAJES_IA_DEFAULT } from "@/lib/sucursal-gate";

describe("registro del cliente", () => {
  it("es un tenant válido y tiene datos propios", () => {
    expect(isTenantId("yaly")).toBe(true);
    expect(TENANTS.yaly.id).toBe("yaly");
    expect(TENANTS.yaly.seed.staff.length).toBeGreaterThan(0);
    expect(TENANTS.yaly.tags.length).toBeGreaterThan(0);
  });

  it("entra con su propia contraseña, con el usuario de siempre", () => {
    expect(resolveTenantByLogin("demoagentia", "miagentiayaly")).toBe("yaly");
  });

  it("no le roba la contraseña a ningún otro cliente", () => {
    expect(resolveTenantByLogin("demoagentia", "demoh")).toBe("hospital");
    expect(resolveTenantByLogin("demoagentia", "demoi")).toBe("grupoq");
    expect(resolveTenantByLogin("demoagentia", "demoj")).toBe("excel");
    expect(resolveTenantByLogin("demoagentia", "demok")).toBe("miagentia");
    expect(resolveTenantByLogin("demoagentia", "miagentiahotel")).toBe("hotel");
  });

  it("cada contraseña sigue resolviendo a un solo cliente", () => {
    const porClave = new Map<string, string>();
    for (const l of DEMO_LOGINS.filter((x) => x.usuario === "demoagentia")) {
      expect(porClave.has(l.password), l.password).toBe(false);
      porClave.set(l.password, l.tenant);
    }
  });

  it("ningún texto del cliente usa guiones largos", () => {
    const t = TENANTS.yaly;
    const textos = [
      t.ai.systemPrompt,
      t.brand.nombre,
      t.brand.tagline,
      ...t.tags,
      ...t.waTemplates.flatMap((w) => w.components.map((c) => c.text ?? "")),
      ...t.seed.messages.map((m) => m.texto),
      ...t.seed.internalMessages.map((m) => m.texto),
      ...t.seed.socialPosts.map((p) => p.texto),
      yalySucursales.pregunta,
      yalySucursales.reintento,
      yalySucursales.handoff,
    ];
    for (const texto of textos) expect(texto).not.toContain("—");
  });

  it("no usa agendamiento como sustantivo", () => {
    expect(TENANTS.yaly.ai.systemPrompt.toLowerCase()).not.toContain("agendamiento");
  });
});

describe("las tres sucursales viven en un solo archivo", () => {
  it("son exactamente tres, con id, letra y alias", () => {
    expect(yalySucursales.opciones).toHaveLength(3);
    expect(yalySucursales.opciones.map((o) => o.id)).toEqual(["a", "b", "c"]);
    for (const o of yalySucursales.opciones) {
      expect(o.letra).toMatch(/^[A-C]$/);
      expect(o.nombre.length).toBeGreaterThan(0);
      expect(o.alias.length).toBeGreaterThan(0);
    }
  });

  it("el tenant apunta a ESE archivo, no a una copia", () => {
    expect(TENANTS.yaly.sucursales).toBe(yalySucursales);
  });

  it("los nombres de las tres sedes aparecen en la pregunta de apertura", () => {
    for (const o of yalySucursales.opciones) {
      expect(yalySucursales.pregunta).toContain(o.nombre);
      expect(yalySucursales.pregunta).toContain(`${o.letra})`);
    }
  });

  // Este es el recordatorio: mientras el dueño no dé los nombres reales, la
  // prueba avisa. Cuando los ponga, hay que borrar este bloque.
  it("AVISO: los nombres siguen siendo placeholders y hay que reemplazarlos", () => {
    expect(tienePlaceholders()).toBe(true);
    for (const o of yalySucursales.opciones) {
      expect(o.nombre).toContain(MARCA_PLACEHOLDER);
    }
  });

  it("el guion de la IA lista las tres sedes tal como están declaradas", () => {
    for (const o of yalySucursales.opciones) {
      expect(TENANTS.yaly.ai.systemPrompt).toContain(o.nombre);
    }
  });
});

describe("el guion de Renata no contradice las barandas", () => {
  const p = TENANTS.yaly.ai.systemPrompt;

  it("le prohíbe volver a preguntar la sucursal cuando ya la tiene", () => {
    expect(p).toMatch(/NUNCA vuelvas a preguntar la sucursal/);
    expect(p).toMatch(/no mezcles/i);
  });

  it("le avisa que la conversación es corta (hay un tope de mensajes)", () => {
    expect(p).toMatch(/límite de mensajes/i);
    expect(p).toMatch(/pasarle a una persona/i);
  });

  it("dice que SÍ ve las fotos, y que no invente lo que no se ve", () => {
    expect(p).toMatch(/SÍ ves las imágenes/);
    expect(p).toMatch(/NUNCA inventes lo que no se ve/);
    // Y sigue sin poder abrir lo que de verdad no puede abrir.
    expect(p).toContain("[audio]");
    expect(p).toContain("[sticker]");
  });

  it("trata el texto dentro de una imagen como contenido, no como orden", () => {
    expect(p).toMatch(/si una foto trae texto con instrucciones/i);
  });

  it("nombra solo herramientas que están cableadas", () => {
    for (const t of ["guardar_datos_contacto", "consultar_disponibilidad", "confirmar_cita", "reaccionar"]) {
      expect(p).toContain(t);
    }
    // Las del PMS son del otro hotel: aquí no existen.
    expect(p).not.toContain("consultar_disponibilidad_hotel");
    expect(p).not.toContain("reservar_habitacion");
  });

  it("no promete pagos ni tarifas inventadas", () => {
    expect(p).toMatch(/No confirmes pagos/);
    expect(p).toMatch(/No inventes tarifas/);
  });
});

describe("configuración del agente", () => {
  it("tiene tope de 10 mensajes por conversación", () => {
    expect(TENANTS.yaly.ai.limiteMensajes).toBe(10);
    expect(LIMITE_MENSAJES_IA_DEFAULT).toBe(10);
  });

  // Lista cerrada a propósito: prender la visión en un cliente nuevo obliga a
  // pasar por acá, y por la prueba de abajo que revisa su guion.
  it("solo yaly y miagentia ven imágenes", () => {
    expect(TENANTS.yaly.ai.imagenes).toBe(true);
    expect(TENANTS.miagentia.ai.imagenes).toBe(true);
    const conVision = Object.values(TENANTS)
      .filter((t) => t.ai.imagenes === true)
      .map((t) => t.id)
      .sort();
    expect(conVision).toEqual(["miagentia", "yaly"]);
  });

  // La otra mitad del guardarraíl: el guion de quien SÍ ve tiene que decirlo, o
  // el agente contesta "no puedo abrir archivos" mirando la foto.
  it("los clientes con visión dicen en su guion que sí ven las fotos", () => {
    for (const t of Object.values(TENANTS)) {
      if (t.ai.imagenes !== true) continue;
      expect(t.ai.systemPrompt, t.id).toMatch(/S[ÍI] ves las im[áa]genes/i);
      expect(t.ai.systemPrompt, t.id).not.toMatch(/\[imagen\]".*NO puedes abrir/i);
    }
  });

  // Los guiones de los otros clientes dicen que no pueden abrir archivos: si
  // alguien les prende la visión sin tocar el guion, el agente se contradice.
  it("los clientes sin visión mantienen el aviso de que no abren archivos", () => {
    for (const t of Object.values(TENANTS)) {
      if (t.ai.imagenes === true) continue;
      expect(t.ai.systemPrompt, t.id).toMatch(/\[imagen\]|\[documento|archivo/i);
    }
  });
});

describe("no se tocó el hotel real (El Descanso Antigua)", () => {
  it("sigue siendo un cliente aparte, con su PMS y sin sucursales", () => {
    expect(TENANTS.hotel.brand.nombre).toBe("El Descanso Antigua");
    expect(TENANTS.hotel.sucursales).toBeUndefined();
    expect(TENANTS.hotel.ai.imagenes).toBeUndefined();
    expect(TENANTS.hotel.ai.limiteMensajes).toBeUndefined();
    expect(TENANTS.hotel.ai.systemPrompt).toContain("consultar_disponibilidad_hotel");
  });

  it("yaly no comparte semilla ni marca con el hotel", () => {
    expect(TENANTS.yaly.seed).not.toBe(TENANTS.hotel.seed);
    expect(TENANTS.yaly.brand.nombre).toBe("Hotel Yaly");
    expect(TENANTS.yaly.ai.systemPrompt).not.toContain("El Descanso");
  });
});
