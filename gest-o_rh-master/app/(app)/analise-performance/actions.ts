"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type { ActionResult } from "@/components/shared/confirm-action-button";

export type FormState = { error?: string } | null;

const BASE_PATH = "/analise-performance";

export async function classificarColaborador(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const colaboradorId = String(formData.get("colaborador_id") ?? "");
  const classificacao = formData.get("classificacao");
  if (!colaboradorId) return { error: "Escolha um colaborador." };
  if (classificacao !== "baixa" && classificacao !== "alta") {
    return { error: "Escolha baixa ou alta performance." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .update({ classificacao_performance: classificacao })
    .eq("id", colaboradorId);
  if (error) return { error: "Não foi possível adicionar o colaborador." };

  revalidatePath(BASE_PATH);
  return null;
}

export async function removerClassificacao(colaboradorId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .update({ classificacao_performance: null })
    .eq("id", colaboradorId);
  if (error) return { error: "Não foi possível remover o colaborador." };
  revalidatePath(BASE_PATH);
}

/** Botão ⇄ entre as colunas: troca todo mundo de baixa pra alta
 * performance e vice-versa, dentro do recorte de Departamento/Cargo
 * atual. Lê os dois grupos ANTES de atualizar, pra não trocar duas
 * vezes quem já virou "alta" no mesmo request. */
export async function trocarClassificacoes(
  departamentoId?: string,
  cargoId?: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  let baseQuery = supabase.from("colaboradores").select("id, classificacao_performance");
  if (departamentoId) baseQuery = baseQuery.eq("departamento_id", departamentoId);
  if (cargoId) baseQuery = baseQuery.eq("cargo_id", cargoId);
  const { data: classificados } = await baseQuery.not("classificacao_performance", "is", null);

  const idsBaixa = (classificados ?? [])
    .filter((c) => c.classificacao_performance === "baixa")
    .map((c) => c.id);
  const idsAlta = (classificados ?? [])
    .filter((c) => c.classificacao_performance === "alta")
    .map((c) => c.id);

  if (idsBaixa.length > 0) {
    await supabase.from("colaboradores").update({ classificacao_performance: "alta" }).in("id", idsBaixa);
  }
  if (idsAlta.length > 0) {
    await supabase.from("colaboradores").update({ classificacao_performance: "baixa" }).in("id", idsAlta);
  }

  revalidatePath(BASE_PATH);
}
