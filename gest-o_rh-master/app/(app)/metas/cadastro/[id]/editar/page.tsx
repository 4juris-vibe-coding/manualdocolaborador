import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { MetaForm } from "@/components/forms/meta-form";
import { atualizarMeta } from "../../actions";

export default async function EditarMetaPage(props: PageProps<"/metas/cadastro/[id]/editar">) {
  await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: meta } = await supabase.from("metas").select("*").eq("id", id).single();

  if (!meta) notFound();

  return (
    <FormPage>
      <PageHeader title={`Editar Meta — ${meta.nome}`} />
      <MetaForm action={atualizarMeta.bind(null, id)} defaultValues={meta} />
    </FormPage>
  );
}
