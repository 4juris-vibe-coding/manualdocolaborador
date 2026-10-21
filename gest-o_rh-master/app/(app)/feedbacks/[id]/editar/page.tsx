import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { FeedbackForm } from "@/components/forms/feedback-form";
import { atualizarFeedback } from "../../actions";

export default async function EditarFeedbackPage(
  props: PageProps<"/feedbacks/[id]/editar">,
) {
  await requireAuth();
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: feedback }, { data: colaboradores }] = await Promise.all([
    supabase.from("feedbacks").select("*").eq("id", id).single(),
    supabase.from("colaboradores").select("id, nome_completo").order("nome_completo"),
  ]);

  if (!feedback) notFound();

  return (
    <FormPage>
      <PageHeader title="Editar Feedback" />
      <FeedbackForm
        action={atualizarFeedback.bind(null, id)}
        colaboradores={colaboradores ?? []}
        defaultValues={feedback}
      />
    </FormPage>
  );
}
