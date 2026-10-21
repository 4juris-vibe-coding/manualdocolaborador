import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { MetaForm } from "@/components/forms/meta-form";
import { criarMeta } from "../actions";

export default async function NovaMetaPage() {
  await requireAdmin();

  return (
    <FormPage>
      <PageHeader title="Novo(a) Cadastro de Metas" />
      <MetaForm action={criarMeta} />
    </FormPage>
  );
}
