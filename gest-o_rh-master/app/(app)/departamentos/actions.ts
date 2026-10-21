"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { departamentoSchema } from "@/lib/validations/departamento";
import type { DeleteActionResult } from "@/components/shared/delete-button";

export type FormState = { error?: string } | null;

function parseDepartamento(formData: FormData) {
  return departamentoSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    localizacao: formData.get("localizacao") || undefined,
    telefone: formData.get("telefone") || undefined,
    fax: formData.get("fax") || undefined,
    ramal: formData.get("ramal") || undefined,
    email: formData.get("email") || undefined,
    orcamento_mensal: formData.get("orcamento_mensal") || undefined,
    unidade_id: formData.get("unidade_id"),
    gestores_ids: formData.getAll("gestores_ids").map(String),
  });
}

/** Substitui os responsáveis (gestores) do departamento pelos selecionados
 * no formulário — departamento_gestores é N:N, então um departamento pode
 * ter vários responsáveis (igual ao "Responsáveis" do Sólides). */
async function sincronizarGestores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  departamentoId: string,
  gestoresIds: string[] | undefined,
) {
  await supabase
    .from("departamento_gestores")
    .delete()
    .eq("departamento_id", departamentoId);

  if (gestoresIds && gestoresIds.length > 0) {
    await supabase.from("departamento_gestores").insert(
      gestoresIds.map((gestorId) => ({
        departamento_id: departamentoId,
        gestor_id: gestorId,
      })),
    );
  }
}

export async function criarDepartamento(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseDepartamento(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { gestores_ids, ...departamento } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departamentos")
    .insert(departamento)
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar o departamento." };

  await sincronizarGestores(supabase, data.id, gestores_ids);

  revalidatePath("/departamentos");
  redirect("/departamentos");
}

export async function atualizarDepartamento(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseDepartamento(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { gestores_ids, ...departamento } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("departamentos")
    .update(departamento)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o departamento." };

  await sincronizarGestores(supabase, id, gestores_ids);

  revalidatePath("/departamentos");
  redirect("/departamentos");
}

export async function excluirDepartamento(
  id: string,
): Promise<DeleteActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("departamentos").delete().eq("id", id);
  if (error) {
    return {
      error:
        "Não foi possível excluir. Verifique se não há colaboradores vinculados a este departamento.",
    };
  }
  revalidatePath("/departamentos");
}
