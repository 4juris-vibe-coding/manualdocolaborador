import { ClipboardList } from "lucide-react";
import { SimpleLookupList } from "@/components/shared/simple-lookup-list";
import { excluirTipoRegistro } from "./actions";

export default async function TiposRegistroPage(
  props: PageProps<"/configuracoes/tipos-registro">,
) {
  const searchParams = await props.searchParams;

  return (
    <SimpleLookupList
      table="tipos_registro"
      icon={ClipboardList}
      titulo="Tipos de Registro"
      descricao="Categorias usadas para classificar ocorrências do colaborador."
      basePath="/configuracoes/tipos-registro"
      entidadeLabel="Tipo"
      searchParams={searchParams}
      excluirAction={excluirTipoRegistro}
    />
  );
}
