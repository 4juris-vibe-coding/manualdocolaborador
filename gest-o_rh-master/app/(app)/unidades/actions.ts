"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { unidadeSchema } from "@/lib/validations/unidade";
import type { DeleteActionResult } from "@/components/shared/delete-button";

export type FormState = { error?: string } | null;

function parseUnidade(formData: FormData) {
  return unidadeSchema.safeParse({
    nome: formData.get("nome"),
    endereco: formData.get("endereco") || undefined,
    telefone: formData.get("telefone") || undefined,
  });
}

export async function criarUnidade(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseUnidade(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("unidades").insert(parsed.data);
  if (error) return { error: "Não foi possível criar a unidade." };

  revalidatePath("/unidades");
  redirect("/unidades");
}

export async function atualizarUnidade(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseUnidade(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("unidades")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar a unidade." };

  revalidatePath("/unidades");
  redirect("/unidades");
}

export async function excluirUnidade(id: string): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("unidades").delete().eq("id", id);
  if (error) {
    return {
      error:
        "Não foi possível excluir. Verifique se não há departamentos ou colaboradores vinculados a esta unidade.",
    };
  }
  revalidatePath("/unidades");
}
