import { notFound } from "next/navigation";
import { unidadActual } from "@/lib/consultorio/actual";
import { esDeLaClinica } from "@/lib/consultorio/guardia";
import { listarSucursales, turnosDe } from "@/lib/consultorio/almacen";
import { Mostrador } from "@/components/consultorio/Mostrador";
import { CambiarEscritorio } from "@/components/consultorio/Escritorio";

export const dynamic = "force-dynamic";

// El mostrador del laboratorio: la fila del día y el récord de quien está
// siendo atendido. Va fuera de /consultorio porque no es la pantalla del
// doctor, es la de recepción del laboratorio, pero comparte la hoja de estilos
// del módulo y por eso el mismo envoltorio ".cons".
//
// Es el único departamento con dos sedes, y por eso el único que lleva
// selector: imagenología y procedimientos tienen una sola sala cada uno.
export default async function PaginaLaboratorio() {
  // La misma puerta que el resto del módulo: la fila se arma en el servidor.
  if (!(await esDeLaClinica())) notFound();
  const unidad = await unidadActual("laboratorio");
  const sedes = listarSucursales("laboratorio");

  return (
    <div className="cons flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Mostrador
        unidad={unidad}
        iniciales={await turnosDe(unidad.id)}
        escritorio={
          <CambiarEscritorio
            que="sucursal"
            actual={unidad.id}
            volverA="/laboratorio"
            opciones={sedes.map((s) => ({
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
