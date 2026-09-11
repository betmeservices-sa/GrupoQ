import { notFound } from "next/navigation";
import { sucursalActual } from "@/lib/consultorio/actual";
import { esDeLaClinica } from "@/lib/consultorio/guardia";
import { listarSucursales, turnosDe } from "@/lib/consultorio/almacen";
import { estadisticas } from "@/lib/consultorio/estadisticas";
import { Jefatura } from "@/components/consultorio/Jefatura";
import { CambiarEscritorio } from "@/components/consultorio/Escritorio";

export const dynamic = "force-dynamic";

// Lo que mira el jefe del laboratorio: cuánta gente pasó, cuánto esperó, cuánto
// se facturó y qué se quedó sin hacer.
export default async function PaginaJefatura() {
  if (!(await esDeLaClinica())) notFound();
  const sucursal = await sucursalActual();
  const datos = estadisticas(await turnosDe(sucursal.id), sucursal.nombre);

  return (
    <div className="cons flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Jefatura
        datos={datos}
        sucursal={sucursal.nombre}
        escritorio={
          <CambiarEscritorio
            que="sucursal"
            actual={sucursal.id}
            volverA="/laboratorio/jefatura"
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
