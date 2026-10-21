import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { ChecklistTopicoForm } from "@/components/forms/checklist-topico-form";
import { criarChecklistTopico } from "../actions";

export default async function NovoChecklistTopicoPage() {
  await requireAdmin();

  return (
    <FormPage maxWidth="2xl">
      <PageHeader title="Novo Tópico" />
      <ChecklistTopicoForm action={criarChecklistTopico} />
    </FormPage>
  );
}
