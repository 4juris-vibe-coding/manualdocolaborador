"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { checklistTopicoSchema } from "@/lib/validations/checklist-topico";
import type { DeleteActionResult } from "@/components/shared/delete-button";

export type FormState = { error?: string } | null;

const BASE_PATH = "/checklists";

function parseTopico(formData: FormData) {
  return checklistTopicoSchema.safeParse({
    descricao: formData.get("descricao"),
    tipo: formData.get("tipo"),
  });
}

export async function criarChecklistTopico(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseTopico(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("checklist_topicos").insert(parsed.data);
  if (error) return { error: "Não foi possível criar o tópico." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function atualizarChecklistTopico(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseTopico(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("checklist_topicos")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o tópico." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function excluirChecklistTopico(id: string): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("checklist_topicos").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o tópico." };
  revalidatePath(BASE_PATH);
}
