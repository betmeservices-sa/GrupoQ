import { ListaDocumentos } from "@/components/consultorio/ListaDocumentos";

export const dynamic = "force-dynamic";

export default function PaginaProcesos() {
  return (
    <ListaDocumentos
      tipo="proceso"
      titulo="Procesos"
      vacio="Todavía no has indicado ningún procedimiento"
    />
  );
}
