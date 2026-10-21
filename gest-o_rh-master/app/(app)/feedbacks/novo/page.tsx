import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { FeedbackForm } from "@/components/forms/feedback-form";
import { criarFeedback } from "../actions";

export default async function NovoFeedbackPage() {
  await requireAuth();
  const supabase = await createClient();
  const { data: colaboradores } = await supabase
    .from("colaboradores")
    .select("id, nome_completo")
    .order("nome_completo");

  return (
    <FormPage>
      <PageHeader title="Novo Feedback" />
      <FeedbackForm action={criarFeedback} colaboradores={colaboradores ?? []} />
    </FormPage>
  );
}
