import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { CargoForm } from "@/components/forms/cargo-form";
import { atualizarCargo } from "../../actions";

export default async function EditarCargoPage(
  props: PageProps<"/cargos/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  const [{ data: cargo }, { data: cargos }, { data: perfis }, { data: tracos }] =
    await Promise.all([
      supabase.from("cargos").select("*").eq("id", id).single(),
      supabase.from("cargos").select("id, nome").order("nome"),
      supabase.from("perfis").select("id, nome_completo").order("nome_completo"),
      supabase
        .from("cargo_tracos_comportamentais")
        .select("chave, valor")
        .eq("cargo_id", id),
    ]);

  if (!cargo) notFound();

  return (
    <FormPage>
      <PageHeader title={`Editar Cargo — ${cargo.nome}`} />
      <CargoForm
        action={atualizarCargo.bind(null, id)}
        cargoId={id}
        cargosSuperiores={cargos ?? []}
        responsaveisDisponiveis={perfis ?? []}
        defaultValues={cargo}
        defaultTracos={tracos ?? []}
      />
    </FormPage>
  );
}
