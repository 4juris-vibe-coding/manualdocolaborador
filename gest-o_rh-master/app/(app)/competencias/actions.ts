"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { competenciaSchema } from "@/lib/validations/competencia";
import type { ActionResult } from "@/components/shared/confirm-action-button";

export type FormState = { error?: string; success?: boolean } | null;

const BASE_PATH = "/competencias";

function parseCompetencia(formData: FormData) {
  return competenciaSchema.safeParse({
    tipo_avaliacao: formData.get("tipo_avaliacao") || "desempenho",
    grupo_id: formData.get("grupo_id"),
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    peso: formData.get("peso") || undefined,
    cargo_ids: formData.getAll("cargo_ids").map(String),
  });
}

async function sincronizarCargos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  competenciaId: string,
  cargoIds: string[],
) {
  await supabase.from("competencia_cargos").delete().eq("competencia_id", competenciaId);
  if (cargoIds.length > 0) {
    await supabase.from("competencia_cargos").insert(
      cargoIds.map((cargoId) => ({ competencia_id: competenciaId, cargo_id: cargoId })),
    );
  }
}

// Sem redirect: o formulário vive num painel lateral (Sheet), não numa
// página — o cliente fecha o painel quando `success` vier true.
export async function criarCompetencia(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseCompetencia(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { cargo_ids, ...dadosCompetencia } = parsed.data;
  const supabase = await createClient();
  const { data: competencia, error } = await supabase
    .from("competencias")
    .insert(dadosCompetencia)
    .select("id")
    .single();
  if (error || !competencia) {
    return { error: "Não foi possível criar a competência." };
  }

  await sincronizarCargos(supabase, competencia.id, cargo_ids);

  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function atualizarCompetencia(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseCompetencia(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { cargo_ids, ...dadosCompetencia } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("competencias")
    .update(dadosCompetencia)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar a competência." };

  await sincronizarCargos(supabase, id, cargo_ids);

  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function alternarArquivadoCompetencia(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("competencias").update({ ativo }).eq("id", id);
  if (error) {
    return {
      error: ativo
        ? "Não foi possível reativar a competência."
        : "Não foi possível arquivar a competência.",
    };
  }
  revalidatePath(BASE_PATH);
}

export async function excluirCompetencia(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("competencias").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir a competência." };
  revalidatePath(BASE_PATH);
}
