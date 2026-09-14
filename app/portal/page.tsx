import type { Metadata } from "next";
import { Portal } from "@/components/consultorio/Portal";
import { CLINICA } from "@/lib/consultorio/correo";

// El portal del paciente: entra con su correo y ve sus recetas y órdenes.
//
// Pública y sin sesión, como las páginas de los QR: quien la abre no tiene
// cuenta. Se llega desde el menú de la clínica, desde el "listo" del registro y
// desde el pie de cada correo. Fuera de los buscadores: es de pacientes.
export const metadata: Metadata = {
  title: `Portal del paciente · ${CLINICA}`,
  robots: { index: false, follow: false },
};

export default function PaginaPortal() {
  return (
    <div className="cons cons-pagina">
      <main className="mx-auto max-w-xl px-4 py-6">
        <Portal clinica={CLINICA} />
      </main>
    </div>
  );
}
