import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { SimpleNomeForm } from "@/components/forms/simple-nome-form";
import { criarMotivoDemissao } from "../actions";

export default async function NovoMotivoDemissaoPage() {
  await requireAdmin();

  return (
    <FormPage>
      <PageHeader title="Novo Motivo de Demissão" />
      <SimpleNomeForm
        action={criarMotivoDemissao}
        label="Nome do motivo"
        cancelHref="/motivos-demissao"
      />
    </FormPage>
  );
}
