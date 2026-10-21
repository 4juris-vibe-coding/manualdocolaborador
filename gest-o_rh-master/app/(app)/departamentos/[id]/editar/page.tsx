import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { DepartamentoForm } from "@/components/forms/departamento-form";
import { atualizarDepartamento } from "../../actions";

export default async function EditarDepartamentoPage(
  props: PageProps<"/departamentos/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;
  const supabase = await createClient();

  const [
    { data: departamento },
    { data: unidades },
    { data: gestores },
    { data: gestoresAtuais },
  ] = await Promise.all([
    supabase.from("departamentos").select("*").eq("id", id).single(),
    supabase.from("unidades").select("id, nome").order("nome"),
    supabase
      .from("perfis")
      .select("id, nome_completo")
      .eq("papel", "gestor")
      .eq("ativo", true)
      .order("nome_completo"),
    supabase.from("departamento_gestores").select("gestor_id").eq("departamento_id", id),
  ]);

  if (!departamento) notFound();

  return (
    <FormPage>
      <PageHeader title={`Editar Departamento — ${departamento.nome}`} />
      <DepartamentoForm
        action={atualizarDepartamento.bind(null, id)}
        unidades={unidades ?? []}
        gestores={gestores ?? []}
        defaultValues={departamento}
        gestoresAtuaisIds={(gestoresAtuais ?? []).map((g) => g.gestor_id)}
      />
    </FormPage>
  );
}
