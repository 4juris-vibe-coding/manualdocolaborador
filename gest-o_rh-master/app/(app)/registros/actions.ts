"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { registroSchema } from "@/lib/validations/registro";
import type { ActionResult } from "@/components/shared/confirm-action-button";

export type FormState = { error?: string } | null;

const BASE_PATH = "/registros";

function parseRegistro(formData: FormData) {
  return registroSchema.safeParse({
    colaborador_id: formData.get("colaborador_id"),
    data_registro: formData.get("data_registro"),
    tipo_registro_id: formData.get("tipo_registro_id"),
    classificacao: formData.get("classificacao"),
    valor_qtd_horas: formData.get("valor_qtd_horas") || undefined,
    descricao: formData.get("descricao"),
  });
}

export async function criarRegistro(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const perfil = await requireAuth();
  const parsed = parseRegistro(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("registros")
    .insert({ ...parsed.data, autor_id: perfil.id });
  if (error) {
    return {
      error:
        "Não foi possível salvar o registro. Verifique se você tem acesso a este colaborador.",
    };
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function atualizarRegistro(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const parsed = parseRegistro(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("registros")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o registro." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function excluirRegistro(id: string): Promise<ActionResult> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("registros").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o registro." };
  revalidatePath(BASE_PATH);
}
