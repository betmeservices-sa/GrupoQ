import { ListaDocumentos } from "@/components/consultorio/ListaDocumentos";

export const dynamic = "force-dynamic";

export default function PaginaExamenes() {
  return (
    <ListaDocumentos
      tipo="orden"
      titulo="Órdenes de laboratorio"
      vacio="Todavía no has dejado ninguna orden"
    />
  );
}
