import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { SimpleNomeForm } from "@/components/forms/simple-nome-form";
import { atualizarMotivoDemissao } from "../../actions";

export default async function EditarMotivoDemissaoPage(
  props: PageProps<"/motivos-demissao/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: motivo } = await supabase
    .from("motivos_demissao")
    .select("*")
    .eq("id", id)
    .single();

  if (!motivo) notFound();

  return (
    <FormPage>
      <PageHeader title={`Editar Motivo — ${motivo.nome}`} />
      <SimpleNomeForm
        action={atualizarMotivoDemissao.bind(null, id)}
        label="Nome do motivo"
        defaultNome={motivo.nome}
        cancelHref="/motivos-demissao"
      />
    </FormPage>
  );
}
