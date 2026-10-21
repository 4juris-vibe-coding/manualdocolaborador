"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { cargoSchema } from "@/lib/validations/cargo";
import {
  parseTracosFormData,
  salvarTracosComportamentais,
} from "@/lib/tracos-comportamentais-server";
import type { DeleteActionResult } from "@/components/shared/delete-button";

export type FormState = { error?: string } | null;

function parseCargo(formData: FormData) {
  return cargoSchema.safeParse({
    nome: formData.get("nome"),
    cargo_superior_id: formData.get("cargo_superior_id") || undefined,
    senioridade: formData.get("senioridade") || undefined,
    codigo_cbo: formData.get("codigo_cbo") || undefined,
    descricao: formData.get("descricao") || undefined,
    atividades: formData.get("atividades") || undefined,
    piso_salarial: formData.get("piso_salarial") || undefined,
    piso_salarial_visivel: Boolean(formData.get("piso_salarial_visivel")),
    habilidades: formData.getAll("habilidades").map(String),
    assistencias: formData.getAll("assistencias").map(String),
    responsaveis_ids: formData.getAll("responsaveis_ids").map(String),
    tracos: parseTracosFormData(formData),
    perfil_executor: formData.get("perfil_executor") || undefined,
    perfil_comunicador: formData.get("perfil_comunicador") || undefined,
    perfil_planejador: formData.get("perfil_planejador") || undefined,
    perfil_analista: formData.get("perfil_analista") || undefined,
  });
}

export async function criarCargo(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseCargo(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { tracos, ...dadosCargo } = parsed.data;
  const supabase = await createClient();
  const { data: cargo, error } = await supabase
    .from("cargos")
    .insert(dadosCargo)
    .select("id")
    .single();
  if (error || !cargo) return { error: "Não foi possível criar o cargo." };

  await salvarTracosComportamentais(
    supabase,
    "cargo_tracos_comportamentais",
    cargo.id,
    tracos,
  );

  revalidatePath("/cargos");
  redirect("/cargos");
}

export async function atualizarCargo(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseCargo(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { tracos, ...dadosCargo } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("cargos").update(dadosCargo).eq("id", id);
  if (error) return { error: "Não foi possível salvar o cargo." };

  await salvarTracosComportamentais(
    supabase,
    "cargo_tracos_comportamentais",
    id,
    tracos,
  );

  revalidatePath("/cargos");
  redirect("/cargos");
}

export async function excluirCargo(id: string): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("cargos").delete().eq("id", id);
  if (error) {
    return {
      error:
        "Não foi possível excluir. Verifique se não há colaboradores vinculados a este cargo.",
    };
  }
  revalidatePath("/cargos");
}
