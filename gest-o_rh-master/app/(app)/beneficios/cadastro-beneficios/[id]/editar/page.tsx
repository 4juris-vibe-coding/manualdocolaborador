import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { BeneficioForm } from "@/components/forms/beneficio-form";
import { atualizarBeneficio } from "../../actions";

export default async function EditarBeneficioPage(
  props: PageProps<"/beneficios/cadastro-beneficios/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: beneficio } = await supabase.from("beneficios").select("*").eq("id", id).single();

  if (!beneficio) notFound();

  return (
    <FormPage>
      <PageHeader title={`Editar Benefício — ${beneficio.nome}`} />
      <BeneficioForm action={atualizarBeneficio.bind(null, id)} defaultValues={beneficio} />
    </FormPage>
  );
}
