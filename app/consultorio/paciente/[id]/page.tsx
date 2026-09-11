import { notFound } from "next/navigation";
import { doctorActual } from "@/lib/consultorio/actual";
import { documentosDe, pacientePorId } from "@/lib/consultorio/almacen";
import { Expediente } from "@/components/consultorio/Expediente";

export const dynamic = "force-dynamic";

export default async function PaginaPaciente({ params }: { params: Promise<{ id: string }> }) {
  const doctor = await doctorActual();
  const paciente = await pacientePorId((await params).id);
  // Un paciente de otro doctor se trata igual que uno inexistente: distinguirlos
  // confirmaría que ese expediente existe.
  if (!paciente || paciente.doctorId !== doctor.id) notFound();

  return (
    <Expediente doctor={doctor} paciente={paciente} documentos={await documentosDe(paciente.id)} />
  );
}
