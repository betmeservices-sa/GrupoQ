// El tablero de ventas: leer el embudo y mover un caso.
//
// GET  -> todos los casos del cliente, ya con su etapa y el estado del
//         expediente calculados, más el equipo de ventas y las alertas vivas.
// POST -> un movimiento: { accion, telefono, ... }.
//
// El tenant sale de la cookie firmada, nunca del cuerpo: si viniera del
// cliente, cualquiera movería los prospectos de otro concesionario.

import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { staffDeUsuario } from "@/lib/usuarios";
import { gerenteDe, vendedoresDe } from "@/lib/ventas-equipo";
import { sembrarVentasSiVacio } from "@/lib/ventas-seed";
import {
  alertasDe,
  detalleDocumentacion,
  etapaDe,
  expedienteDe,
  type EstadoDoc,
  type MotivoRechazo,
  type Solicitud,
} from "@/lib/ventas-pipeline";
import {
  asegurarSolicitud,
  asignarVendedor,
  cerrarSolicitud,
  eventosDe,
  listarSolicitudes,
  marcarContactado,
  marcarDocumentosPedidos,
  marcarTomado,
  moverDocumento,
  reabrirSolicitud,
} from "@/lib/ventas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ESTADOS_DOC: EstadoDoc[] = ["falta", "recibido", "aprobado", "rechazado"];

function aDTO(s: Solicitud) {
  const doc = detalleDocumentacion(s.expediente);
  return {
    ...s,
    etapa: etapaDe(s),
    doc: { sub: doc.sub, resumen: doc.resumen, aprobados: doc.aprobados, total: doc.total },
    /** Los cuatro requisitos con su estado, en orden: es lo que pinta la ficha. */
    documentos: expedienteDe(s.expediente),
  };
}

/** Quién está moviendo el caso: su ficha de equipo si la tiene, o su usuario. */
async function actorDe(req: Request): Promise<string> {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion?.usuario) return "panel";
  return staffDeUsuario(sesion.usuario) ?? sesion.usuario;
}

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const url = new URL(req.url);
  const telefono = url.searchParams.get("telefono");

  try {
    // El demo se siembra solo la primera vez: un embudo vacío no enseña nada.
    await sembrarVentasSiVacio(tenant);
    const solicitudes = await listarSolicitudes(tenant);

    if (telefono) {
      const s = solicitudes.find((x) => x.telefono === telefono);
      if (!s) return NextResponse.json({ ok: false, error: "Ese caso no existe." }, { status: 404 });
      return NextResponse.json({ ok: true, caso: aDTO(s), eventos: await eventosDe(tenant, telefono) });
    }

    return NextResponse.json({
      ok: true,
      solicitudes: solicitudes.map(aDTO),
      vendedores: vendedoresDe(tenant),
      gerente: gerenteDe(tenant),
      alertas: alertasDe(solicitudes.filter((s) => !s.cerrado)),
    });
  } catch (e) {
    console.error("ventas GET:", e);
    return NextResponse.json({ ok: false, error: "No se pudo leer el embudo." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const actor = await actorDe(req);
  let body: {
    accion?: string;
    telefono?: string;
    nombre?: string;
    vehiculo?: string;
    documento?: string;
    estado?: EstadoDoc;
    motivo?: MotivoRechazo;
    nota?: string;
    vendedor?: string;
    resultado?: "venta" | "perdido";
    motivoCierre?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const telefono = (body.telefono ?? "").replace(/[^\d]/g, "");
  if (!telefono) return NextResponse.json({ ok: false, error: "Falta el prospecto." }, { status: 400 });

  try {
    let caso: Solicitud | null = null;
    switch (body.accion) {
      case "crear":
        caso = await asegurarSolicitud(tenant, telefono, { nombre: body.nombre, vehiculo: body.vehiculo });
        break;
      case "contactado":
        caso = await marcarContactado(tenant, telefono, actor);
        break;
      case "pedir_documentos":
        caso = await marcarDocumentosPedidos(tenant, telefono, actor);
        break;
      case "documento": {
        const documento = (body.documento ?? "").trim();
        const estado = body.estado;
        if (!documento || !estado || !ESTADOS_DOC.includes(estado)) {
          return NextResponse.json({ ok: false, error: "Documento o estado inválido." }, { status: 400 });
        }
        caso = await moverDocumento({
          tenant,
          telefono,
          documento,
          estado,
          motivo: body.motivo ?? null,
          nota: body.nota ?? null,
          actor,
          vendedores: vendedoresDe(tenant),
        });
        break;
      }
      case "asignar": {
        const vendedor = vendedoresDe(tenant).find((v) => v.id === body.vendedor);
        if (!vendedor) return NextResponse.json({ ok: false, error: "Ese vendedor no existe." }, { status: 400 });
        caso = await asignarVendedor(tenant, telefono, vendedor.id, actor, vendedor.nombre);
        break;
      }
      case "tomar":
        caso = await marcarTomado(tenant, telefono, actor);
        break;
      case "cerrar": {
        const resultado = body.resultado;
        if (resultado !== "venta" && resultado !== "perdido") {
          return NextResponse.json({ ok: false, error: "Falta si fue venta o perdido." }, { status: 400 });
        }
        caso = await cerrarSolicitud(tenant, telefono, resultado, body.motivoCierre ?? null, actor);
        break;
      }
      case "reabrir":
        caso = await reabrirSolicitud(tenant, telefono, actor);
        break;
      default:
        return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
    }

    if (!caso) return NextResponse.json({ ok: false, error: "Ese caso no existe." }, { status: 404 });
    return NextResponse.json({ ok: true, caso: aDTO(caso) });
  } catch (e) {
    console.error("ventas POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo mover el caso." }, { status: 500 });
  }
}
