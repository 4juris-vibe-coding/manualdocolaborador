import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { BeneficiarioForm } from "@/components/forms/beneficiario-form";
import { criarBeneficiario } from "../actions";

export default async function NovoBeneficiarioPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: colaboradores }, { data: beneficios }] = await Promise.all([
    supabase.from("colaboradores").select("id, nome_completo").eq("status", "ativo").order("nome_completo"),
    supabase.from("beneficios").select("id, nome").order("nome"),
  ]);

  return (
    <FormPage>
      <PageHeader title="Novo(a) Benefícios" />
      <BeneficiarioForm
        action={criarBeneficiario}
        colaboradores={(colaboradores ?? []).map((c) => ({ id: c.id, nome: c.nome_completo }))}
        beneficios={beneficios ?? []}
      />
    </FormPage>
  );
}
