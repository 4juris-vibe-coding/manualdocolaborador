import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { CargoForm } from "@/components/forms/cargo-form";
import { criarCargo } from "../actions";

export default async function NovoCargoPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: cargos }, { data: perfis }] = await Promise.all([
    supabase.from("cargos").select("id, nome").order("nome"),
    supabase.from("perfis").select("id, nome_completo").order("nome_completo"),
  ]);

  return (
    <FormPage>
      <PageHeader title="Novo Cargo" />
      <CargoForm
        action={criarCargo}
        cargosSuperiores={cargos ?? []}
        responsaveisDisponiveis={perfis ?? []}
      />
    </FormPage>
  );
}
