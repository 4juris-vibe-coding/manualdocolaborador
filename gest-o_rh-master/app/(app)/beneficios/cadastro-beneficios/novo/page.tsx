import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { BeneficioForm } from "@/components/forms/beneficio-form";
import { criarBeneficio } from "../actions";

export default async function NovoBeneficioPage() {
  await requireAdmin();

  return (
    <FormPage>
      <PageHeader title="Novo(a) Cadastro de Benefícios" />
      <BeneficioForm action={criarBeneficio} />
    </FormPage>
  );
}
