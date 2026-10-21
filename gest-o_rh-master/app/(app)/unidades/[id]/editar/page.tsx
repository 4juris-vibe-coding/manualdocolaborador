import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { UnidadeForm } from "@/components/forms/unidade-form";
import { atualizarUnidade } from "../../actions";

export default async function EditarUnidadePage(
  props: PageProps<"/unidades/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: unidade } = await supabase
    .from("unidades")
    .select("*")
    .eq("id", id)
    .single();

  if (!unidade) notFound();

  return (
    <FormPage>
      <PageHeader title={`Editar Unidade — ${unidade.nome}`} />
      <UnidadeForm
        action={atualizarUnidade.bind(null, id)}
        defaultValues={unidade}
      />
    </FormPage>
  );
}
