"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { DeleteActionResult } from "@/components/shared/delete-button";

export type FormState = { error?: string } | null;

const BASE_PATH = "/beneficios/beneficiarios";

export async function criarBeneficiario(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const colaboradorId = String(formData.get("colaborador_id") ?? "");
  const beneficioId = String(formData.get("beneficio_id") ?? "");
  if (!colaboradorId) return { error: "Escolha um colaborador." };
  if (!beneficioId) return { error: "Escolha um benefício." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("beneficiarios")
    .insert({ colaborador_id: colaboradorId, beneficio_id: beneficioId });
  if (error) {
    if (error.code === "23505") {
      return { error: "Este colaborador já recebe este benefício." };
    }
    return { error: "Não foi possível adicionar o beneficiário." };
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function excluirBeneficiario(id: string): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("beneficiarios").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o beneficiário." };
  revalidatePath(BASE_PATH);
}

export type FormStateMassa = { error?: string; adicionados?: number } | null;

/** "Adicionar Múltiplos Beneficiários": aplica um benefício a todos os
 * colaboradores do recorte (Departamento/Cargo) — ou a todos os ativos,
 * se nenhum filtro tiver sido escolhido, igual ao aviso da tela. */
export async function criarBeneficiariosEmMassa(
  _prevState: FormStateMassa,
  formData: FormData,
): Promise<FormStateMassa> {
  await requireAdmin();
  const beneficioId = String(formData.get("beneficio_id") ?? "");
  if (!beneficioId) return { error: "Escolha um benefício." };

  const departamentoId = String(formData.get("departamento_id") ?? "");
  const cargoId = String(formData.get("cargo_id") ?? "");

  const supabase = await createClient();
  let query = supabase.from("colaboradores").select("id").eq("status", "ativo");
  if (departamentoId && departamentoId !== "todos") query = query.eq("departamento_id", departamentoId);
  if (cargoId && cargoId !== "todos") query = query.eq("cargo_id", cargoId);
  const { data: colaboradores } = await query;

  if (!colaboradores || colaboradores.length === 0) {
    return { error: "Nenhum colaborador encontrado com esse filtro." };
  }

  const linhas = colaboradores.map((c) => ({ colaborador_id: c.id, beneficio_id: beneficioId }));
  const { data: inseridos, error } = await supabase
    .from("beneficiarios")
    .upsert(linhas, { onConflict: "colaborador_id,beneficio_id", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: "Não foi possível adicionar os beneficiários." };

  revalidatePath(BASE_PATH);
  // `inseridos` só traz as linhas que entraram de fato — quem já tinha
  // esse benefício é ignorado silenciosamente (ignoreDuplicates), então
  // o número informado reflete o que realmente mudou no banco.
  return { adicionados: inseridos?.length ?? 0 };
}
