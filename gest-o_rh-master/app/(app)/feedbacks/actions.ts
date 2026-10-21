"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { feedbackSchema } from "@/lib/validations/feedback";
import type { ActionResult } from "@/components/shared/confirm-action-button";

export type FormState = { error?: string } | null;

const BASE_PATH = "/feedbacks";

function parseFeedback(formData: FormData) {
  return feedbackSchema.safeParse({
    colaborador_id: formData.get("colaborador_id"),
    data_feedback: formData.get("data_feedback"),
    classificacao: formData.get("classificacao"),
    comentario: formData.get("comentario"),
  });
}

export async function criarFeedback(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const perfil = await requireAuth();
  const parsed = parseFeedback(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("feedbacks")
    .insert({ ...parsed.data, autor_id: perfil.id });
  if (error) {
    return {
      error:
        "Não foi possível salvar o feedback. Verifique se você tem acesso a este colaborador.",
    };
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function atualizarFeedback(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const parsed = parseFeedback(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("feedbacks").update(parsed.data).eq("id", id);
  if (error) return { error: "Não foi possível salvar o feedback." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function excluirFeedback(id: string): Promise<ActionResult> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("feedbacks").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o feedback." };
  revalidatePath(BASE_PATH);
}
