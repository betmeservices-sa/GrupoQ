// El tablero de la agencia: la plata, los tickets y la gente de cada cliente.
//
// Solo para la cuenta de la agencia (sesión con `todos`). Por cliente, en el
// periodo elegido: las estadías que apartó el agente, los tickets, y la gente
// del cliente con su último login y si está adentro ahora. Más el log de
// accesos. El consumo de la IA va aparte, en /api/agencia/consumo.
//
// GET ?periodo=hoy|ayer|7d|30d|rango&desde=AAAA-MM-DD&hasta=AAAA-MM-DD
//
// Se corta con el MISMO periodo que el consumo. Antes esto leía siempre 30
// días y el filtro de arriba movía solo la mitad del tablero.

import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { TENANTS } from "@/lib/tenants";
import type { TenantId } from "@/lib/tenants/types";
import { cuentas } from "@/lib/usuarios";
import { listarTickets } from "@/lib/tickets-store";
import { listarPreReservas } from "@/lib/yali-prereservas";
import { actividadDeUsuarios, estaActivo, listarAccesos } from "@/lib/accesos";
import { DIA, esPeriodo, rangoDePeriodo } from "@/lib/periodos";
import { enRango, reservasDelPeriodo, ticketsDelPeriodo } from "@/lib/agencia-resumen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Los clientes de verdad. Los demás tenants son demos para prospectos y no
// tienen nada que reportar acá.
const CLIENTES: TenantId[] = ["yaly"];

/** Apartados que se leen para cortar el periodo (la lista del panel de Yali sigue con 40). */
const TOPE_RESERVAS = 1000;

export async function GET(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  if (!sesion.todos && sesion.tenant !== "miagentia") {
    return NextResponse.json({ ok: false, error: "Solo para la agencia" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams;
  const periodo = q.get("periodo");
  const rango = rangoDePeriodo(esPeriodo(periodo) ? periodo : "7d", new Date(), q.get("desde"), q.get("hasta"));
  const { desde, hasta } = rango;
  const ahora = Date.now();

  // El último login se busca más atrás que el periodo: con "Hoy", quien entró
  // ayer no es alguien que "nunca ha entrado".
  const diasAtras = Math.min(366, Math.max(30, Math.ceil((ahora - Date.parse(desde)) / DIA) + 1));
  const todasLasCuentas = cuentas();
  const [actividad, accesosVentana] = await Promise.all([
    actividadDeUsuarios(),
    listarAccesos({ dias: diasAtras, tope: 1000 }),
  ]);
  const accesos = accesosVentana.filter((a) => enRango(a.ts, desde, hasta));
  const actividadPor = new Map(actividad.map((a) => [a.usuario, a]));
  const ultimoLoginPor = new Map<string, string>();
  for (const a of accesosVentana) if (!ultimoLoginPor.has(a.usuario)) ultimoLoginPor.set(a.usuario, a.ts);

  const clientes = await Promise.all(
    CLIENTES.map(async (id) => {
      const [tickets, prereservas] = await Promise.all([
        listarTickets(id).catch(() => []),
        listarPreReservas(id, undefined, TOPE_RESERVAS).catch(() => []),
      ]);
      const usuarios = todasLasCuentas
        .filter((c) => c.tenant === id && !c.todos)
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
        nombre: TENANTS[id].brand.nombreCorto || TENANTS[id].brand.nombre,
        tickets: ticketsDelPeriodo(tickets, desde, hasta),
        reservas: reservasDelPeriodo(prereservas, desde, hasta),
        usuarios,
        activosAhora: usuarios.filter((u) => u.activo).length,
      };
    }),
  );

  return NextResponse.json({
    ok: true,
    periodo: rango,
    clientes,
    accesos: accesos.slice(0, 100).map((a) => ({
      ts: a.ts,
      tenant: a.tenant,
      usuario: a.usuario,
      nombre: a.nombre,
      rol: a.rol,
      host: a.host,
      ip: a.ip,
      activo: estaActivo(actividadPor.get(a.usuario)?.ultimoVisto, ahora),
    })),
  });
}
