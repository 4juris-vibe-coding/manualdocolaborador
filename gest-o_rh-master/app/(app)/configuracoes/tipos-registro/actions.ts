"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { DeleteActionResult } from "@/components/shared/delete-button";
import type { SimpleFormState } from "@/components/forms/simple-nome-form";

const nomeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do tipo de registro."),
});

const BASE_PATH = "/configuracoes/tipos-registro";

export async function criarTipoRegistro(
  _prevState: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  await requireAdmin();
  const parsed = nomeSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tipos_registro").insert(parsed.data);
  if (error) return { error: "Não foi possível criar o tipo de registro." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function atualizarTipoRegistro(
  id: string,
  _prevState: SimpleFormState,
  formData: FormData,
): Promise<SimpleFormState> {
  await requireAdmin();
  const parsed = nomeSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("tipos_registro")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o tipo de registro." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function excluirTipoRegistro(
  id: string,
): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tipos_registro")
    .delete()
    .eq("id", id);
  if (error) {
    return {
      error:
        "Não foi possível excluir. Verifique se não há registros vinculados a este tipo.",
    };
  }
  revalidatePath(BASE_PATH);
}
