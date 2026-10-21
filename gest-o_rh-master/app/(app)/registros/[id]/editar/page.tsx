import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { RegistroForm } from "@/components/forms/registro-form";
import { atualizarRegistro } from "../../actions";

export default async function EditarRegistroPage(
  props: PageProps<"/registros/[id]/editar">,
) {
  await requireAuth();
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: registro }, { data: colaboradores }, { data: tipos }] =
    await Promise.all([
      supabase.from("registros").select("*").eq("id", id).single(),
      supabase
        .from("colaboradores")
        .select("id, nome_completo")
        .order("nome_completo"),
      supabase.from("tipos_registro").select("id, nome").order("nome"),
    ]);

  if (!registro) notFound();

  return (
    <FormPage>
      <PageHeader title="Editar Registro" />
      <RegistroForm
        action={atualizarRegistro.bind(null, id)}
        colaboradores={colaboradores ?? []}
        tipos={tipos ?? []}
        defaultValues={registro}
      />
    </FormPage>
  );
}
