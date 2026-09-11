import { notFound } from "next/navigation";
import { sucursalActual } from "@/lib/consultorio/actual";
import { esDeLaClinica } from "@/lib/consultorio/guardia";
import { listarSucursales, turnosDe } from "@/lib/consultorio/almacen";
import { Mostrador } from "@/components/consultorio/Mostrador";
import { CambiarEscritorio } from "@/components/consultorio/Escritorio";

export const dynamic = "force-dynamic";

// El mostrador del laboratorio: la fila del día y el récord de quien está
// siendo atendido. Va fuera de /consultorio porque no es la pantalla del
// doctor, es la de recepción del laboratorio, pero comparte la hoja de estilos
// del módulo y por eso el mismo envoltorio ".cons".
export default async function PaginaLaboratorio() {
  // La misma puerta que el resto del módulo: la fila se arma en el servidor.
  if (!(await esDeLaClinica())) notFound();
  const sucursal = await sucursalActual();
  return (
    <div className="cons flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Mostrador
        sucursal={sucursal}
        iniciales={await turnosDe(sucursal.id)}
        escritorio={
          <CambiarEscritorio
            que="sucursal"
            actual={sucursal.id}
            volverA="/laboratorio"
            opciones={listarSucursales().map((s) => ({
              id: s.id,
              nombre: s.nombre,
              detalle: s.horario.split("·")[0].trim(),
            }))}
          />
        }
      />
    </div>
  );
}
