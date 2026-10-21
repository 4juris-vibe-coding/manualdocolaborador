"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireAuth } from "@/lib/auth/session";
import { dependenteSchema } from "@/lib/validations/colaborador";
import { exameSchema } from "@/lib/validations/exame";
import {
  parseTracosFormData,
  salvarTracosComportamentais,
} from "@/lib/tracos-comportamentais-server";
import type { ActionResult } from "@/components/shared/confirm-action-button";

export type FormState = { error?: string; success?: boolean } | null;

// -----------------------------------------------------------------------
// Dependentes
// -----------------------------------------------------------------------

export async function criarDependente(
  colaboradorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const parsed = dependenteSchema.safeParse({
    nome: formData.get("nome"),
    parentesco: formData.get("parentesco"),
    data_nascimento: formData.get("data_nascimento") || undefined,
    cpf: formData.get("cpf") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("colaborador_dependentes")
    .insert({ ...parsed.data, colaborador_id: colaboradorId });
  if (error) {
    return {
      error:
        "Não foi possível salvar o dependente. Verifique se você tem acesso a este colaborador.",
    };
  }

  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { success: true };
}

export async function excluirDependente(
  colaboradorId: string,
  dependenteId: string,
): Promise<ActionResult> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("colaborador_dependentes")
    .delete()
    .eq("id", dependenteId);
  if (error) return { error: "Não foi possível excluir o dependente." };
  revalidatePath(`/colaboradores/${colaboradorId}`);
}

// -----------------------------------------------------------------------
// Documentos (upload é admin-only; leitura é liberada pra gestor do time)
// -----------------------------------------------------------------------

export async function registrarDocumento(
  colaboradorId: string,
  dados: { nome: string; categoria: string; caminhoArquivo: string; tamanhoBytes: number },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("colaborador_documentos").insert({
    colaborador_id: colaboradorId,
    nome: dados.nome,
    categoria: dados.categoria,
    caminho_arquivo: dados.caminhoArquivo,
    tamanho_bytes: dados.tamanhoBytes,
    enviado_por: admin.id,
  });
  if (error) return { error: "Não foi possível registrar o documento." };
  revalidatePath(`/colaboradores/${colaboradorId}`);
}

export async function excluirDocumento(
  colaboradorId: string,
  documentoId: string,
  caminhoArquivo: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.storage.from("colaboradores").remove([caminhoArquivo]);
  const { error } = await supabase
    .from("colaborador_documentos")
    .delete()
    .eq("id", documentoId);
  if (error) return { error: "Não foi possível excluir o documento." };
  revalidatePath(`/colaboradores/${colaboradorId}`);
}

export async function obterUrlDocumento(
  caminhoArquivo: string,
): Promise<{ url?: string; error?: string }> {
  await requireAuth();
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("colaboradores")
    .createSignedUrl(caminhoArquivo, 60);
  if (error || !data) return { error: "Não foi possível abrir o documento." };
  return { url: data.signedUrl };
}

// -----------------------------------------------------------------------
// Saúde Ocupacional (ASO) — dado sensível de saúde: só admin_rh
// cria/edita/exclui, gestor só enxerga (RLS já garante isso no banco).
// -----------------------------------------------------------------------

export async function criarExame(
  colaboradorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = exameSchema.safeParse({
    tipo_exame: formData.get("tipo_exame"),
    data_exame: formData.get("data_exame"),
    data_validade: formData.get("data_validade") || undefined,
    resultado: formData.get("resultado"),
    medico_nome: formData.get("medico_nome") || undefined,
    medico_crm: formData.get("medico_crm") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    documento_id: formData.get("documento_id") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("colaborador_exames").insert({
    ...parsed.data,
    colaborador_id: colaboradorId,
    criado_por: admin.id,
  });
  if (error) return { error: "Não foi possível salvar o exame." };

  revalidatePath(`/colaboradores/${colaboradorId}`);
  revalidatePath("/saude-ocupacional");
  return { success: true };
}

export async function excluirExame(
  colaboradorId: string,
  exameId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("colaborador_exames")
    .delete()
    .eq("id", exameId);
  if (error) return { error: "Não foi possível excluir o exame." };
  revalidatePath(`/colaboradores/${colaboradorId}`);
  revalidatePath("/saude-ocupacional");
}

// -----------------------------------------------------------------------
// Perfil comportamental (alimenta a Busca de Perfil)
// -----------------------------------------------------------------------

export async function salvarPerfilComportamental(
  colaboradorId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAuth();
  const supabase = await createClient();
  const tracos = Object.fromEntries(
    Object.entries(parseTracosFormData(formData)).map(([chave, valor]) => [
      chave,
      Number(valor),
    ]),
  );
  await salvarTracosComportamentais(
    supabase,
    "colaborador_tracos_comportamentais",
    colaboradorId,
    tracos,
  );

  // Categorias DISC (Executor/Comunicador/Planejador/Analista) — colunas
  // diretas em colaboradores, é o que a Busca de Perfil usa.
  const valorDisc = (chave: string) => {
    const valor = formData.get(`perfil_${chave}`);
    return valor !== null ? Number(valor) : undefined;
  };
  const perfilExecutor = valorDisc("executor");
  const perfilComunicador = valorDisc("comunicador");
  const perfilPlanejador = valorDisc("planejador");
  const perfilAnalista = valorDisc("analista");
  if (
    perfilExecutor !== undefined ||
    perfilComunicador !== undefined ||
    perfilPlanejador !== undefined ||
    perfilAnalista !== undefined
  ) {
    await supabase
      .from("colaboradores")
      .update({
        perfil_executor: perfilExecutor,
        perfil_comunicador: perfilComunicador,
        perfil_planejador: perfilPlanejador,
        perfil_analista: perfilAnalista,
      })
      .eq("id", colaboradorId);
  }

  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { success: true };
}
