import { UserX } from "lucide-react";
import { SimpleLookupList } from "@/components/shared/simple-lookup-list";
import { excluirMotivoDemissao } from "./actions";

export default async function MotivosDemissaoPage(
  props: PageProps<"/motivos-demissao">,
) {
  const searchParams = await props.searchParams;

  return (
    <SimpleLookupList
      table="motivos_demissao"
      icon={UserX}
      titulo="Motivos de Demissão"
      descricao="Lista de motivos usada na ficha de desligamento do colaborador."
      basePath="/motivos-demissao"
      entidadeLabel="Motivo"
      searchParams={searchParams}
      excluirAction={excluirMotivoDemissao}
    />
  );
}
