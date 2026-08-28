// El tablero de la agencia: qué consume cada cliente y quién entra.
//
// Solo para la cuenta de la agencia (sesión con `todos`). Por cliente: tokens
// y costo del agente de IA en el periodo, tickets, y la gente del cliente con
// su último login y si está adentro ahora. Más el log de accesos.
//
// GET ?dias=7|30

import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { TENANTS } from "@/lib/tenants";
import type { TenantId } from "@/lib/tenants/types";
import { cuentas } from "@/lib/usuarios";
import { detalleConsumo } from "@/lib/tokens-store";
import { listarTickets } from "@/lib/tickets-store";
import { actividadDeUsuarios, estaActivo, listarAccesos } from "@/lib/accesos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Yali es el primer cliente oficial: va primero. El resto, en el orden del registro.
const ORDEN: TenantId[] = ["yaly"];

export async function GET(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  if (!sesion.todos && sesion.tenant !== "miagentia") {
    return NextResponse.json({ ok: false, error: "Solo para la agencia" }, { status: 403 });
  }
  const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("dias")) || 30));
  const desdeMs = Date.now() - dias * 86_400_000;
  const desde = new Date(desdeMs).toISOString();
  const ahora = Date.now();

  const ids = [...ORDEN, ...(Object.keys(TENANTS) as TenantId[]).filter((t) => !ORDEN.includes(t))];
  const todasLasCuentas = cuentas();
  const [actividad, accesos] = await Promise.all([actividadDeUsuarios(), listarAccesos({ dias, tope: 300 })]);
  const actividadPor = new Map(actividad.map((a) => [a.usuario, a]));
  const ultimoLoginPor = new Map<string, string>();
  for (const a of accesos) if (!ultimoLoginPor.has(a.usuario)) ultimoLoginPor.set(a.usuario, a.ts);

  const clientes = await Promise.all(
    ids.map(async (id) => {
      const t = TENANTS[id];
      const [filas, tickets] = await Promise.all([
        detalleConsumo(id, 5000).catch(() => []),
        listarTickets(id).catch(() => []),
      ]);
      const enPeriodo = filas.filter((f) => f.ts >= desde);
      const porDia = new Map<string, { costo: number; respuestas: number }>();
      let tokensEntrada = 0;
      let tokensSalida = 0;
      let costo = 0;
      for (const f of enPeriodo) {
        tokensEntrada += f.uso.input_tokens + f.uso.cache_creation_input_tokens + f.uso.cache_read_input_tokens;
        tokensSalida += f.uso.output_tokens;
        costo += f.costo.total;
        const dia = f.ts.slice(0, 10);
        const d = porDia.get(dia) ?? { costo: 0, respuestas: 0 };
        d.costo += f.costo.total;
        d.respuestas += 1;
        porDia.set(dia, d);
      }
      const ticketsPeriodo = tickets.filter((k) => k.creado >= desde);
      const usuarios = todasLasCuentas
        .filter((c) => (id === "miagentia" ? c.todos || c.tenant === "miagentia" : c.tenant === id && !c.todos))
        .map((c) => {
          const act = actividadPor.get(c.usuario);
          return {
            usuario: c.usuario,
            nombre: c.nombre,
            rol: c.rol,
            ultimoLogin: ultimoLoginPor.get(c.usuario) ?? null,
            ultimoVisto: act?.ultimoVisto ?? null,
            activo: estaActivo(act?.ultimoVisto, ahora),
            logins: accesos.filter((a) => a.usuario === c.usuario).length,
          };
        });
      return {
        id,
        nombre: t.brand.nombreCorto || t.brand.nombre,
        oficial: id === "yaly",
        tokens: {
          respuestas: enPeriodo.length,
          tokensEntrada,
          tokensSalida,
          costo: Math.round(costo * 1e4) / 1e4,
          porDia: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, v]) => ({ dia, costo: Math.round(v.costo * 1e4) / 1e4, respuestas: v.respuestas })),
          costoTotalHistorico: Math.round(filas.reduce((s, f) => s + f.costo.total, 0) * 1e4) / 1e4,
        },
        tickets: {
          total: tickets.length,
          periodo: ticketsPeriodo.length,
          abiertos: tickets.filter((k) => k.estado !== "resuelto").length,
          resueltos: tickets.filter((k) => k.estado === "resuelto").length,
          porSofia: tickets.filter((k) => k.creadoPor === "ia").length,
          porTipo: Object.entries(
            ticketsPeriodo.reduce<Record<string, number>>((acc, k) => {
              acc[k.tipo] = (acc[k.tipo] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .map(([tipo, n]) => ({ tipo, n }))
            .sort((a, b) => b.n - a.n),
        },
        usuarios,
        activosAhora: usuarios.filter((u) => u.activo).length,
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    dias,
    clientes,
    accesos: accesos.slice(0, 100).map((a) => ({
      ts: a.ts,
      tenant: a.tenant,
      cliente: TENANTS[a.tenant as TenantId]?.brand.nombreCorto ?? a.tenant,
      usuario: a.usuario,
      nombre: a.nombre,
      rol: a.rol,
      host: a.host,
      ip: a.ip,
      activo: estaActivo(actividadPor.get(a.usuario)?.ultimoVisto, ahora),
    })),
  });
}
