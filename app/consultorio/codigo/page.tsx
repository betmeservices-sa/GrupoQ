import { doctorActual } from "@/lib/consultorio/actual";
import { Codigo } from "@/components/consultorio/Codigo";

export const dynamic = "force-dynamic";

export default async function PaginaCodigo() {
  return <Codigo doctor={await doctorActual()} />;
}
