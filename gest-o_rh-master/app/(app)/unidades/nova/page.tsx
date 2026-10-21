import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { UnidadeForm } from "@/components/forms/unidade-form";
import { criarUnidade } from "../actions";

export default async function NovaUnidadePage() {
  await requireAdmin();

  return (
    <FormPage>
      <PageHeader title="Nova Unidade" />
      <UnidadeForm action={criarUnidade} />
    </FormPage>
  );
}
