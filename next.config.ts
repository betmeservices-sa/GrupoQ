import type { NextConfig } from "next";
import path from "path";

// Headers de seguridad minimos para un panel interno (no se embebe en iframes,
// no se infiere el tipo MIME, referrer acotado, HTTPS forzado).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // Este proyecto vive anidado dentro de otro repo. Fijamos la raíz de
  // Turbopack para que no infiera mal el workspace por lockfiles vecinos.
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
