import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { RegistroForm } from "@/components/forms/registro-form";
import { criarRegistro } from "../actions";

export default async function NovoRegistroPage() {
  await requireAuth();
  const supabase = await createClient();

  const [{ data: colaboradores }, { data: tipos }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("id, nome_completo")
      .order("nome_completo"),
    supabase.from("tipos_registro").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <FormPage>
      <PageHeader title="Novo Registro" />
      <RegistroForm
        action={criarRegistro}
        colaboradores={colaboradores ?? []}
        tipos={tipos ?? []}
      />
    </FormPage>
  );
}
