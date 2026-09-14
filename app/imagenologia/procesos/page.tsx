import { notFound } from "next/navigation";
import { unidadActual } from "@/lib/consultorio/actual";
import { esDeLaClinica } from "@/lib/consultorio/guardia";
import { turnosDe } from "@/lib/consultorio/almacen";
import { Mostrador } from "@/components/consultorio/Mostrador";
import { PestanasUnidad } from "@/components/consultorio/PestanasUnidad";

export const dynamic = "force-dynamic";

// La sala de procedimientos: mismo mostrador, otra fila y otro catálogo.
export default async function PaginaProcesosUnidad() {
  if (!(await esDeLaClinica())) notFound();
  const unidad = await unidadActual("procesos");
  return (
    <div className="cons flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PestanasUnidad />
      <Mostrador unidad={unidad} iniciales={await turnosDe(unidad.id)} />
    </div>
  );
}
