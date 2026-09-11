import { ListaDocumentos } from "@/components/consultorio/ListaDocumentos";

export const dynamic = "force-dynamic";

export default function PaginaRecetas() {
  return (
    <ListaDocumentos tipo="receta" titulo="Recetas" vacio="Todavía no has hecho ninguna receta" />
  );
}
