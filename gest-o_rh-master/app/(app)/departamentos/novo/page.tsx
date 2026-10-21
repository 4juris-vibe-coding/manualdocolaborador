import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { DepartamentoForm } from "@/components/forms/departamento-form";
import { criarDepartamento } from "../actions";

export default async function NovoDepartamentoPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: unidades }, { data: gestores }] = await Promise.all([
    supabase.from("unidades").select("id, nome").order("nome"),
    supabase
      .from("perfis")
      .select("id, nome_completo")
      .eq("papel", "gestor")
      .eq("ativo", true)
      .order("nome_completo"),
  ]);

  return (
    <FormPage>
      <PageHeader title="Novo Departamento" />
      <DepartamentoForm
        action={criarDepartamento}
        unidades={unidades ?? []}
        gestores={gestores ?? []}
      />
    </FormPage>
  );
}
