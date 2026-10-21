import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { ChecklistTopicoForm } from "@/components/forms/checklist-topico-form";
import { atualizarChecklistTopico } from "../../actions";

export default async function EditarChecklistTopicoPage(
  props: PageProps<"/checklists/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: topico } = await supabase
    .from("checklist_topicos")
    .select("*")
    .eq("id", id)
    .single();

  if (!topico) notFound();

  return (
    <FormPage maxWidth="2xl">
      <PageHeader title="Editar Tópico" />
      <ChecklistTopicoForm
        action={atualizarChecklistTopico.bind(null, id)}
        defaultValues={topico}
      />
    </FormPage>
  );
}
