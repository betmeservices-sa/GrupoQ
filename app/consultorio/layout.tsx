import { notFound } from "next/navigation";
import { esDeLaClinica } from "@/lib/consultorio/guardia";
import { Secciones } from "@/components/consultorio/Secciones";

// El escritorio del doctor: una vista con cuatro secciones (sus pacientes, las
// recetas, las órdenes y su código).
//
// El módulo trae su propia hoja de estilos, encerrada en ".cons" (ver
// globals.css). No es capricho: la receta y la orden de exámenes se imprimen y
// se firman, así que se ven como papel, y el resto de la app no tiene por qué
// heredar eso.
//
// Y acá está la puerta del módulo: estas páginas arman los datos en el
// servidor, así que la sesión de otro cliente tiene que rebotar ANTES de que se
// pinte nada.
export default async function LayoutConsultorio({ children }: { children: React.ReactNode }) {
  if (!(await esDeLaClinica())) notFound();
  return (
    <div className="cons flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Secciones />
      {children}
    </div>
  );
}
