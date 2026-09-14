import { ListaDocumentos } from "@/components/consultorio/ListaDocumentos";

export const dynamic = "force-dynamic";

export default function PaginaImagenes() {
  return (
    <ListaDocumentos
      tipo="imagen"
      titulo="Imagenología"
      vacio="Todavía no has mandado ningún estudio"
    />
  );
}
