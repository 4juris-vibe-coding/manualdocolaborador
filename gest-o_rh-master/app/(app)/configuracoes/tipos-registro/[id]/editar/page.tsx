import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { SimpleNomeForm } from "@/components/forms/simple-nome-form";
import { atualizarTipoRegistro } from "../../actions";

export default async function EditarTipoRegistroPage(
  props: PageProps<"/configuracoes/tipos-registro/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: tipo } = await supabase
    .from("tipos_registro")
    .select("*")
    .eq("id", id)
    .single();

  if (!tipo) notFound();

  return (
    <FormPage>
      <PageHeader title={`Editar Tipo de Registro — ${tipo.nome}`} />
      <SimpleNomeForm
        action={atualizarTipoRegistro.bind(null, id)}
        label="Nome do tipo"
        defaultNome={tipo.nome}
        cancelHref="/configuracoes/tipos-registro"
      />
    </FormPage>
  );
}
