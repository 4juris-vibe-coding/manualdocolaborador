import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { ColaboradorForm } from "@/components/forms/colaborador-form";
import { criarColaborador } from "../actions";

export default async function NovoColaboradorPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: cargos }, { data: departamentos }, { data: colaboradores }] =
    await Promise.all([
      supabase.from("cargos").select("id, nome").order("nome"),
      supabase.from("departamentos").select("id, nome").order("nome"),
      supabase
        .from("colaboradores")
        .select("id, nome_completo")
        .eq("status", "ativo")
        .order("nome_completo"),
    ]);

  return (
    <FormPage>
      <PageHeader title="Novo Colaborador" />
      <ColaboradorForm
        action={criarColaborador}
        cargos={cargos ?? []}
        departamentos={departamentos ?? []}
        colaboradores={colaboradores ?? []}
      />
    </FormPage>
  );
}
