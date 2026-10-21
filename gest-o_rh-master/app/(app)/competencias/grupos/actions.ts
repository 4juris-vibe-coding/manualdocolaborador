"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { grupoCompetenciaSchema } from "@/lib/validations/grupo-competencia";
import type { ActionResult } from "@/components/shared/confirm-action-button";

export type FormState = { error?: string; success?: boolean } | null;

const BASE_PATH = "/competencias/grupos";

function parseGrupo(formData: FormData) {
  return grupoCompetenciaSchema.safeParse({
    nome: formData.get("nome"),
    categoria_9box: formData.get("categoria_9box") || "nenhuma",
  });
}

// Sem redirect: o formulário vive num popup (Dialog), não numa página —
// o próprio cliente fecha o popup quando `success` vier true.
export async function criarGrupoCompetencia(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseGrupo(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("grupos_competencias").insert(parsed.data);
  if (error) return { error: "Não foi possível criar o grupo de competências." };

  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function atualizarGrupoCompetencia(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseGrupo(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("grupos_competencias")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o grupo de competências." };

  revalidatePath(BASE_PATH);
  return { success: true };
}

export async function alternarArquivadoGrupoCompetencia(
  id: string,
  ativo: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("grupos_competencias")
    .update({ ativo })
    .eq("id", id);
  if (error) {
    return {
      error: ativo
        ? "Não foi possível reativar o grupo."
        : "Não foi possível arquivar o grupo.",
    };
  }
  revalidatePath(BASE_PATH);
}

export async function excluirGrupoCompetencia(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("grupos_competencias").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o grupo." };
  revalidatePath(BASE_PATH);
}
