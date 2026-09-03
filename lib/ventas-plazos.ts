// Los plazos del embudo, en un solo lugar.
//
// A las 48 horas sin que el vendedor tome el caso se le avisa al gerente de
// ventas; a las 72 se marca vencido, que es la señal de reasignarlo. El aviso
// llega como ticket asignado al gerente: el tablero donde ya trabaja lo que
// alguien tiene que atender.
//
// Lo llaman dos: el cron diario y la propia pantalla de reportería (en
// segundo plano, al abrirla). Así el aviso existe aunque el cron no corra, y
// nunca sale dos veces por caso: la solicitud guarda cuándo se avisó.

import { crearTicket } from "./tickets-store";
import { gerenteDe, nombreDeVendedor } from "./ventas-equipo";
import { HORAS_AVISO, HORAS_VENCIDO, alertasDe } from "./ventas-pipeline";
import { listarSolicitudes, marcarAviso } from "./ventas-store";

export interface ResultadoPlazos {
  tenant: string;
  avisos: number;
  vencidos: number;
}

export async function revisarPlazos(tenant: string): Promise<ResultadoPlazos> {
  const gerente = gerenteDe(tenant);
  const solicitudes = (await listarSolicitudes(tenant)).filter((s) => !s.cerrado);
  let avisos = 0;
  let vencidos = 0;

  for (const a of alertasDe(solicitudes)) {
    const caso = solicitudes.find((s) => s.telefono === a.telefono);
    if (!caso) continue;
    // De cada nivel se avisa UNA vez: un aviso repetido se vuelve ruido.
    if (a.nivel === "aviso" && caso.avisado) continue;
    if (a.nivel === "vencido" && caso.escalado) continue;

    const vendedor = nombreDeVendedor(tenant, a.vendedor);
    const plazo = a.nivel === "vencido" ? HORAS_VENCIDO : HORAS_AVISO;
    const titulo =
      a.nivel === "vencido"
        ? `Vencido: ${a.nombre} lleva ${a.horas} h sin que lo tomen`
        : `${a.nombre} lleva ${a.horas} h esperando a ${vendedor}`;
    const detalle =
      `El expediente quedó completo y se asignó a ${vendedor} hace ${a.horas} horas. ` +
      (a.nivel === "vencido"
        ? `Pasó el plazo de ${plazo} h sin primer contacto: hay que reasignarlo o entender qué pasó.`
        : `Pasó el plazo de ${plazo} h sin que lo tome.`);

    if (gerente) {
      await crearTicket(tenant, {
        titulo,
        detalle,
        tipo: "otro",
        prioridad: a.nivel === "vencido" ? "urgente" : "alta",
        origen: "manual",
        creadoPor: "Sistema",
        contactoNombre: a.nombre,
        contactoTelefono: a.telefono,
        area: "ventas",
        asignadoA: gerente.id,
      });
    }
    await marcarAviso(tenant, a.telefono, a.nivel, `${vendedor} · ${a.horas} h`);
    if (a.nivel === "vencido") vencidos++;
    else avisos++;
  }

  return { tenant, avisos, vencidos };
}
