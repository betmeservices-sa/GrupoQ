import { notFound } from "next/navigation";
import { unidadActual } from "@/lib/consultorio/actual";
import { esDeLaClinica } from "@/lib/consultorio/guardia";
import { turnosDe } from "@/lib/consultorio/almacen";
import { Mostrador } from "@/components/consultorio/Mostrador";
import { PestanasUnidad } from "@/components/consultorio/PestanasUnidad";

export const dynamic = "force-dynamic";

// El mostrador de la Unidad de Imagenología: su propia fila, su propio código
// de entrada y su propio catálogo. Es el laboratorio otra vez, con rayos X.
export default async function PaginaImagenologia() {
  if (!(await esDeLaClinica())) notFound();
  const unidad = await unidadActual("imagenologia");
  return (
    <div className="cons flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PestanasUnidad />
      <Mostrador unidad={unidad} iniciales={await turnosDe(unidad.id)} />
    </div>
  );
}
