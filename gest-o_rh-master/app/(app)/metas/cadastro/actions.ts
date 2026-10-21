"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { metaSchema } from "@/lib/validations/meta";
import type { DeleteActionResult } from "@/components/shared/delete-button";

export type FormState = { error?: string } | null;

const BASE_PATH = "/metas/cadastro";

function parseMeta(formData: FormData) {
  return metaSchema.safeParse({
    nome: formData.get("nome"),
    codigo: formData.get("codigo") || undefined,
    descricao: formData.get("descricao"),
    valor_meta: formData.get("valor_meta") || 0,
    mes_ano: formData.get("mes_ano"),
  });
}

export async function criarMeta(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseMeta(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("metas").insert(parsed.data);
  if (error) return { error: "Não foi possível criar a meta." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function atualizarMeta(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseMeta(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("metas").update(parsed.data).eq("id", id);
  if (error) return { error: "Não foi possível salvar a meta." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function excluirMeta(id: string): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("metas").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir a meta." };
  revalidatePath(BASE_PATH);
}
