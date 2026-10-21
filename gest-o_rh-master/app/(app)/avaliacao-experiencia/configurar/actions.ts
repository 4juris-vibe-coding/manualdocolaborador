"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { configuracaoAvaliacaoExperienciaSchema } from "@/lib/validations/configuracao-avaliacao-experiencia";
import type { TipoContratoColaborador } from "@/types/database.types";

export type FormState = { error?: string; success?: boolean } | null;

/** Configuração é um singleton (1 linha só, id=true) — não existe
 * "criar", só atualizar a mesma linha sempre. */
export async function salvarConfiguracaoAvaliacaoExperiencia(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = configuracaoAvaliacaoExperienciaSchema.safeParse({
    habilitado: formData.get("habilitado") === "on",
    periodo_avaliativo: formData.get("periodo_avaliativo") || "90_dias",
    tipos_contrato: formData.getAll("tipos_contrato").map(String),
    cargo_ids: formData.getAll("cargo_ids").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracao_avaliacao_experiencia")
    .update({
      habilitado: parsed.data.habilitado,
      periodo_avaliativo: parsed.data.periodo_avaliativo,
      tipos_contrato:
        parsed.data.tipos_contrato.length > 0
          ? (parsed.data.tipos_contrato as TipoContratoColaborador[])
          : null,
      cargo_ids: parsed.data.cargo_ids.length > 0 ? parsed.data.cargo_ids : null,
    })
    .eq("id", true);
  if (error) return { error: "Não foi possível salvar as configurações." };

  revalidatePath("/avaliacao-experiencia/configurar");
  return { success: true };
}
