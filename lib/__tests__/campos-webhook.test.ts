// A qué avisos se suscribe una página de Meta.
//
// Esto se prueba porque falla callado y tarde. Todo se ve bien: la página queda
// conectada, los mensajes del huésped entran, el panel funciona. Lo que no
// llega es la respuesta que alguien del hotel escribió desde la bandeja de
// Facebook, así que el hilo se ve abandonado y lo contestan dos veces. Nadie
// relaciona eso con una lista de campos.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CAMPOS_WEBHOOK } from "@/lib/meta-oauth";

const RUTAS = [
  "app/api/meta/callback/route.ts",
  "app/api/meta/connections/route.ts",
];

describe("campos del webhook de Meta", () => {
  it("pide el eco de los mensajes salientes", () => {
    // Sin esto, contestar desde Facebook o desde el celular no se ve en el panel.
    expect(CAMPOS_WEBHOOK.split(",")).toContain("message_echoes");
  });

  it("sigue pidiendo lo demás que ya funcionaba", () => {
    const campos = CAMPOS_WEBHOOK.split(",");
    expect(campos).toContain("messages"); // mensajes del huésped
    expect(campos).toContain("feed"); // comentarios en las publicaciones
  });

  it("ninguna ruta arma su propia lista", () => {
    // Estaban escritas a mano en tres lugares y ya se habían separado: una
    // pedía `feed` y otra no, así que una página conectada por un camino
    // recibía los comentarios y por el otro no.
    for (const r of RUTAS) {
      const src = fs.readFileSync(path.join(process.cwd(), r), "utf8");
      expect(src, r).not.toMatch(/subscribed_fields:\s*"/);
      expect(src, r).toMatch(/subscribed_fields:\s*CAMPOS_WEBHOOK/);
    }
  });
});
