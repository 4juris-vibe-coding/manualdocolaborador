import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { SimpleNomeForm } from "@/components/forms/simple-nome-form";
import { criarTipoRegistro } from "../actions";

export default async function NovoTipoRegistroPage() {
  await requireAdmin();

  return (
    <FormPage>
      <PageHeader title="Novo Tipo de Registro" />
      <SimpleNomeForm
        action={criarTipoRegistro}
        label="Nome do tipo"
        cancelHref="/configuracoes/tipos-registro"
      />
    </FormPage>
  );
}
