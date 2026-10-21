"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import {
  colaboradorSchema,
  desligamentoSchema,
} from "@/lib/validations/colaborador";
import type { ActionResult } from "@/components/shared/confirm-action-button";

export type FormState = { error?: string } | null;

function parseColaborador(formData: FormData) {
  return colaboradorSchema.safeParse({
    nome_completo: formData.get("nome_completo"),
    email: formData.get("email"),
    cpf: formData.get("cpf"),
    cnpj: formData.get("cnpj") || undefined,
    razao_social: formData.get("razao_social") || undefined,
    telefone: formData.get("telefone") || undefined,
    genero: formData.get("genero") || undefined,
    data_nascimento: formData.get("data_nascimento") || undefined,
    rg: formData.get("rg") || undefined,
    pis: formData.get("pis") || undefined,
    ctps_numero: formData.get("ctps_numero") || undefined,
    ctps_serie: formData.get("ctps_serie") || undefined,
    endereco_logradouro: formData.get("endereco_logradouro") || undefined,
    endereco_numero: formData.get("endereco_numero") || undefined,
    endereco_complemento: formData.get("endereco_complemento") || undefined,
    endereco_bairro: formData.get("endereco_bairro") || undefined,
    endereco_cidade: formData.get("endereco_cidade") || undefined,
    endereco_estado: formData.get("endereco_estado") || undefined,
    endereco_cep: formData.get("endereco_cep") || undefined,
    cargo_id: formData.get("cargo_id"),
    departamento_id: formData.get("departamento_id"),
    data_admissao: formData.get("data_admissao"),
    banco_horas: formData.get("banco_horas") || undefined,
    tipo_contrato: formData.get("tipo_contrato") || "clt",
    salario: formData.get("salario") || undefined,
    banco_nome: formData.get("banco_nome") || undefined,
    banco_agencia: formData.get("banco_agencia") || undefined,
    banco_conta: formData.get("banco_conta") || undefined,
    banco_tipo_conta: formData.get("banco_tipo_conta") || undefined,
    chave_pix: formData.get("chave_pix") || undefined,

    // Dados pessoais (expansão)
    nome_social: formData.get("nome_social") || undefined,
    sexo: formData.get("sexo") || undefined,
    saudacao: formData.get("saudacao") || undefined,
    raca_etnia: formData.get("raca_etnia") || undefined,
    estado_civil: formData.get("estado_civil") || undefined,
    escolaridade: formData.get("escolaridade") || undefined,
    curso: formData.get("curso") || undefined,
    pessoa_com_deficiencia: Boolean(formData.get("pessoa_com_deficiencia")),
    tipo_deficiencia: formData.get("tipo_deficiencia") || undefined,
    nacionalidade: formData.get("nacionalidade") || undefined,
    naturalidade: formData.get("naturalidade") || undefined,
    nome_pai: formData.get("nome_pai") || undefined,
    nome_mae: formData.get("nome_mae") || undefined,

    // Endereço (expansão)
    endereco_pais: formData.get("endereco_pais") || undefined,

    // Contatos (expansão)
    celular: formData.get("celular") || undefined,
    telefone_emergencia: formData.get("telefone_emergencia") || undefined,
    email_pessoal: formData.get("email_pessoal") || undefined,
    email_corporativo: formData.get("email_corporativo") || undefined,

    // Dados contratuais (expansão)
    turno: formData.get("turno") || undefined,
    periodo_experiencia_dias: formData.get("periodo_experiencia_dias") || undefined,
    matricula: formData.get("matricula") || undefined,
    superior_direto_id: formData.get("superior_direto_id") || undefined,
    grau_hierarquico: formData.get("grau_hierarquico") || undefined,
    data_contrato: formData.get("data_contrato") || undefined,
    duracao_contrato: formData.get("duracao_contrato") || undefined,
    vencimento_contrato: formData.get("vencimento_contrato") || undefined,
    codigo_externo: formData.get("codigo_externo") || undefined,
    duplo_vinculo: Boolean(formData.get("duplo_vinculo")),
    data_inicio_cargo: formData.get("data_inicio_cargo") || undefined,
    inicio_vigencia: formData.get("inicio_vigencia") || undefined,
    periculosidade: Boolean(formData.get("periculosidade")),
    insalubridade: Boolean(formData.get("insalubridade")),
    percentual_insalubridade: formData.get("percentual_insalubridade") || undefined,
    permite_bater_ponto: Boolean(formData.get("permite_bater_ponto")),

    // Documentos (expansão)
    estrangeiro: Boolean(formData.get("estrangeiro")),
    rg_data_expedicao: formData.get("rg_data_expedicao") || undefined,
    rg_orgao_expedidor: formData.get("rg_orgao_expedidor") || undefined,
    matricula_esocial: formData.get("matricula_esocial") || undefined,
    cnh: formData.get("cnh") || undefined,
    reservista: formData.get("reservista") || undefined,
    titulo_eleitor: formData.get("titulo_eleitor") || undefined,
    zona_eleitoral: formData.get("zona_eleitoral") || undefined,
    secao_eleitoral: formData.get("secao_eleitoral") || undefined,

    // Fuso horário
    fuso_horario: formData.get("fuso_horario") || undefined,

    // Dados adicionais
    quantidade_filhos: formData.get("quantidade_filhos") || undefined,
    tamanho_camisa: formData.get("tamanho_camisa") || undefined,
  });
}

function mensagemErroSalvar(error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return "Já existe um colaborador com este e-mail ou CPF.";
  }
  return "Não foi possível salvar o colaborador.";
}

export async function criarColaborador(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = parseColaborador(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: departamento } = await supabase
    .from("departamentos")
    .select("unidade_id")
    .eq("id", parsed.data.departamento_id)
    .single();
  if (!departamento) return { error: "Departamento inválido." };

  const { data: colaborador, error } = await supabase
    .from("colaboradores")
    .insert({
      ...parsed.data,
      unidade_id: departamento.unidade_id,
      criado_por: admin.id,
    })
    .select("id")
    .single();

  if (error || !colaborador) {
    return { error: mensagemErroSalvar(error!) };
  }

  revalidatePath("/colaboradores");
  redirect("/colaboradores");
}

export async function atualizarColaborador(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseColaborador(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.superior_direto_id === id) {
    return { error: "Um colaborador não pode ser superior direto de si mesmo." };
  }

  const supabase = await createClient();
  const { data: departamento } = await supabase
    .from("departamentos")
    .select("unidade_id")
    .eq("id", parsed.data.departamento_id)
    .single();
  if (!departamento) return { error: "Departamento inválido." };

  const { error } = await supabase
    .from("colaboradores")
    .update({ ...parsed.data, unidade_id: departamento.unidade_id })
    .eq("id", id);

  if (error) return { error: mensagemErroSalvar(error) };

  revalidatePath("/colaboradores");
  redirect("/colaboradores");
}

export async function desligarColaborador(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = desligamentoSchema.safeParse({
    data_desligamento: formData.get("data_desligamento"),
    motivo_desligamento_id: formData.get("motivo_desligamento_id"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .update({ status: "inativo", ...parsed.data })
    .eq("id", id);
  if (error) {
    return { error: "Não foi possível registrar o desligamento." };
  }

  revalidatePath("/colaboradores");
  redirect("/colaboradores");
}

export async function reativarColaborador(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("colaboradores")
    .update({
      status: "ativo",
      data_desligamento: null,
      motivo_desligamento_id: null,
    })
    .eq("id", id);
  if (error) return { error: "Não foi possível reativar o colaborador." };
  revalidatePath("/colaboradores");
}

export async function excluirColaborador(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("colaboradores").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o colaborador." };
  revalidatePath("/colaboradores");
}
