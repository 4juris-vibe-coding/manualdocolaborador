"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { beneficioSchema } from "@/lib/validations/beneficio";
import type { DeleteActionResult } from "@/components/shared/delete-button";

export type FormState = { error?: string } | null;

const BASE_PATH = "/beneficios/cadastro-beneficios";

function parseBeneficio(formData: FormData) {
  return beneficioSchema.safeParse({
    nome: formData.get("nome"),
    tipo: formData.get("tipo"),
    valor_beneficio: formData.get("valor_beneficio") || 0,
    aplicado_como: formData.get("aplicado_como") || "reais",
    periodicidade: formData.get("periodicidade") || "mensal",
    valor_descontado: formData.get("valor_descontado") || undefined,
    opcao_desconto: formData.get("opcao_desconto") || undefined,
  });
}

export async function criarBeneficio(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseBeneficio(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("beneficios").insert(parsed.data);
  if (error) return { error: "Não foi possível criar o benefício." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function atualizarBeneficio(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseBeneficio(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("beneficios").update(parsed.data).eq("id", id);
  if (error) return { error: "Não foi possível salvar o benefício." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function excluirBeneficio(id: string): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("beneficios").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o benefício." };
  revalidatePath(BASE_PATH);
}
