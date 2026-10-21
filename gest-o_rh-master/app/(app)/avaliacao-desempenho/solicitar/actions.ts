"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import {
  cicloEtapa1Schema,
  cicloEtapa2Schema,
  cicloEtapa3Schema,
} from "@/lib/validations/ciclo-avaliativo";
import type { ActionResult } from "@/components/shared/confirm-action-button";
import type { CicloAvaliativoRow, TipoContratoColaborador } from "@/types/database.types";

const BASE_PATH = "/avaliacao-desempenho/solicitar";

export type EtapaResult = { id?: string; error?: string };

function parseEtapa1(formData: FormData) {
  return cicloEtapa1Schema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    data_abertura: formData.get("data_abertura"),
    data_encerramento: formData.get("data_encerramento"),
  });
}

/** Cria o rascunho (etapa 1) — a partir daqui o ciclo já existe e as
 * próximas etapas só atualizam essa mesma linha. */
export async function criarCicloEtapa1(formData: FormData): Promise<EtapaResult> {
  await requireAdmin();
  const parsed = parseEtapa1(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ciclos_avaliativos")
    .insert({ ...parsed.data, status: "rascunho", etapa_atual: "escalas" })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível criar a avaliação." };

  revalidatePath(BASE_PATH);
  return { id: data.id };
}

export async function atualizarCicloEtapa1(id: string, formData: FormData): Promise<EtapaResult> {
  await requireAdmin();
  const parsed = parseEtapa1(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.from("ciclos_avaliativos").update(parsed.data).eq("id", id);
  if (error) return { error: "Não foi possível salvar a avaliação." };

  revalidatePath(BASE_PATH);
  return { id };
}

export async function atualizarCicloEtapa2(id: string, formData: FormData): Promise<EtapaResult> {
  await requireAdmin();
  const parsed = cicloEtapa2Schema.safeParse({
    niveis_escala: formData.get("niveis_escala"),
    rotulo_escala: formData.get("rotulo_escala") || undefined,
    comentario_competencia_mostrar: formData.get("comentario_competencia_mostrar") === "on",
    comentario_competencia_obrigatorio: formData.get("comentario_competencia_obrigatorio") === "on",
    comentario_geral_obrigatorio: formData.get("comentario_geral_obrigatorio") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ciclos_avaliativos")
    .update({ ...parsed.data, etapa_atual: "configuracoes" })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar a escala." };

  revalidatePath(BASE_PATH);
  return { id };
}

export async function atualizarCicloEtapa3(id: string, formData: FormData): Promise<EtapaResult> {
  await requireAdmin();
  const tiposContrato = formData.getAll("tipos_contrato").map(String);
  const parsed = cicloEtapa3Schema.safeParse({
    tipo_relacao: formData.get("tipo_relacao") || "direta_90",
    autoavaliacao: formData.get("autoavaliacao") === "on",
    admitidos_ate: formData.get("admitidos_ate") || undefined,
    tipos_contrato: tiposContrato.length > 0 ? tiposContrato : undefined,
    nivel_estrutura: formData.get("nivel_estrutura") || undefined,
    opcao_estrutura_id: formData.get("opcao_estrutura_id") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { tipos_contrato, ...resto } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("ciclos_avaliativos")
    .update({
      ...resto,
      tipos_contrato: (tipos_contrato as TipoContratoColaborador[] | undefined) ?? null,
      nivel_estrutura: resto.nivel_estrutura ?? null,
      opcao_estrutura_id: resto.opcao_estrutura_id ?? null,
      admitidos_ate: resto.admitidos_ate || null,
      etapa_atual: "solicitar",
    })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar as configurações." };

  revalidatePath(BASE_PATH);
  return { id };
}

function elegivel(
  colaborador: {
    status: string;
    data_admissao: string;
    tipo_contrato: string;
    unidade_id: string;
    departamento_id: string;
    cargo_id: string;
  },
  ciclo: Pick<
    CicloAvaliativoRow,
    "admitidos_ate" | "tipos_contrato" | "nivel_estrutura" | "opcao_estrutura_id"
  >,
) {
  if (colaborador.status !== "ativo") return false;
  if (ciclo.admitidos_ate && colaborador.data_admissao > ciclo.admitidos_ate) return false;
  if (ciclo.tipos_contrato && ciclo.tipos_contrato.length > 0) {
    if (!ciclo.tipos_contrato.includes(colaborador.tipo_contrato as TipoContratoColaborador))
      return false;
  }
  if (ciclo.nivel_estrutura && ciclo.opcao_estrutura_id) {
    const campo =
      ciclo.nivel_estrutura === "unidade"
        ? "unidade_id"
        : ciclo.nivel_estrutura === "departamento"
          ? "departamento_id"
          : "cargo_id";
    if (colaborador[campo] !== ciclo.opcao_estrutura_id) return false;
  }
  return true;
}

/** Gera os pares avaliador->avaliado automaticamente a partir do "Tipo de
 * avaliação" e demais filtros da etapa Configurações (substitui os
 * participantes já gerados antes, se houver). Não se aplica à
 * "Avaliação customizada", que usa `adicionarParticipantesManual`. */
export async function gerarParticipantesAutomaticos(cicloId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: ciclo, error: erroCiclo } = await supabase
    .from("ciclos_avaliativos")
    .select("admitidos_ate, tipos_contrato, nivel_estrutura, opcao_estrutura_id, tipo_relacao, autoavaliacao")
    .eq("id", cicloId)
    .single();
  if (erroCiclo || !ciclo) return { error: "Avaliação não encontrada." };
  if (ciclo.tipo_relacao === "customizada") {
    return { error: "Avaliação customizada: adicione os participantes manualmente." };
  }

  const { data: colaboradores } = await supabase
    .from("colaboradores")
    .select("id, status, data_admissao, tipo_contrato, unidade_id, departamento_id, cargo_id, superior_direto_id");
  const elegiveis = (colaboradores ?? []).filter((c) => elegivel(c, ciclo));
  const elegivelIds = new Set(elegiveis.map((c) => c.id));

  const pares = new Set<string>();
  const pushPar = (avaliadorId: string, avaliadoId: string) => {
    if (avaliadorId === avaliadoId && !ciclo.autoavaliacao) return;
    pares.add(`${avaliadorId}:${avaliadoId}`);
  };

  for (const c of elegiveis) {
    if (ciclo.autoavaliacao) pares.add(`${c.id}:${c.id}`);

    if (!c.superior_direto_id || !elegivelIds.has(c.superior_direto_id)) continue;
    // Líder avalia liderado, em todos os tipos exceto customizada.
    pushPar(c.superior_direto_id, c.id);
    if (ciclo.tipo_relacao === "conjunta_180" || ciclo.tipo_relacao === "trezentos_sessenta") {
      pushPar(c.id, c.superior_direto_id);
    }
  }

  if (ciclo.tipo_relacao === "trezentos_sessenta") {
    // Pares: mesmo cargo e mesmo superior direto se avaliam mutuamente.
    for (const a of elegiveis) {
      for (const b of elegiveis) {
        if (a.id === b.id) continue;
        if (a.cargo_id === b.cargo_id && a.superior_direto_id && a.superior_direto_id === b.superior_direto_id) {
          pushPar(a.id, b.id);
        }
      }
    }
  }

  await supabase.from("ciclo_avaliativo_participantes").delete().eq("ciclo_id", cicloId);
  const linhas = [...pares].map((par) => {
    const [avaliador_id, avaliado_id] = par.split(":");
    return { ciclo_id: cicloId, avaliador_id, avaliado_id };
  });
  if (linhas.length > 0) {
    const { error } = await supabase.from("ciclo_avaliativo_participantes").insert(linhas);
    if (error) return { error: "Não foi possível gerar os participantes." };
  }

  revalidatePath(`${BASE_PATH}/${cicloId}`);
  return linhas.length === 0
    ? { error: "Nenhum colaborador elegível encontrado com os filtros definidos." }
    : undefined;
}

/** "Avaliação customizada": adiciona manualmente os avaliados de um
 * avaliador escolhido à mão. */
export async function adicionarParticipantesManual(
  cicloId: string,
  avaliadorId: string,
  avaliadoIds: string[],
): Promise<ActionResult> {
  await requireAdmin();
  if (!avaliadorId || avaliadoIds.length === 0) {
    return { error: "Escolha um avaliador e ao menos um avaliado." };
  }
  const supabase = await createClient();
  const linhas = avaliadoIds.map((avaliado_id) => ({
    ciclo_id: cicloId,
    avaliador_id: avaliadorId,
    avaliado_id,
  }));
  const { error } = await supabase
    .from("ciclo_avaliativo_participantes")
    .upsert(linhas, { onConflict: "ciclo_id,avaliado_id,avaliador_id", ignoreDuplicates: true });
  if (error) return { error: "Não foi possível adicionar os participantes." };

  revalidatePath(`${BASE_PATH}/${cicloId}`);
}

export async function removerParticipante(id: string, cicloId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("ciclo_avaliativo_participantes").delete().eq("id", id);
  if (error) return { error: "Não foi possível remover o participante." };
  revalidatePath(`${BASE_PATH}/${cicloId}`);
}

/** Fecha o assistente: exige ao menos 1 participante e marca a avaliação
 * como ativa (deixa de ser rascunho). */
export async function finalizarCiclo(cicloId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("ciclo_avaliativo_participantes")
    .select("id", { count: "exact", head: true })
    .eq("ciclo_id", cicloId);
  if (!count) {
    return { error: "Adicione ao menos um participante antes de criar a avaliação." };
  }

  const { error } = await supabase
    .from("ciclos_avaliativos")
    .update({ status: "ativo" })
    .eq("id", cicloId);
  if (error) return { error: "Não foi possível criar a avaliação." };

  revalidatePath(BASE_PATH);
}

export async function excluirCicloRascunho(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("ciclos_avaliativos")
    .delete()
    .eq("id", id)
    .eq("status", "rascunho");
  if (error) return { error: "Não foi possível excluir o rascunho." };
  revalidatePath(BASE_PATH);
}
