import "server-only";
import type { createClient } from "@/lib/supabase/server";
import {
  temRegimeClt,
  GENERO_OPTIONS,
  RACA_ETNIA_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  ESCOLARIDADE_OPTIONS,
  TIPO_CONTRATO_OPTIONS,
} from "@/lib/validations/colaborador";
import { calcularDiasDeCasa } from "@/lib/admissao-calculo";
import {
  calcularIdade,
  calcularAnosDeCasa,
  FAIXAS_IDADE,
  FAIXAS_TEMPO_EMPRESA,
  FAIXAS_EXPERIENCIA,
  contarPorFaixa,
  contarPorOpcoes,
  contarCategorias,
} from "@/lib/metricas-colaborador";

export type FiltrosMetricas = {
  unidade_id?: string;
  departamento_id?: string;
  cargo_id?: string;
  superior_direto_id?: string;
};

/** Toda a leitura e os cálculos da página Métricas do Colaborador, num
 * lugar só — usado tanto pela página quanto pela exportação em PDF, pra
 * não duplicar a lógica dos filtros/agregações. */
export async function buscarMetricasColaborador(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filtros: FiltrosMetricas,
) {
  let query = supabase.from("colaboradores").select("*").eq("status", "ativo");
  if (filtros.unidade_id) query = query.eq("unidade_id", filtros.unidade_id);
  if (filtros.departamento_id) query = query.eq("departamento_id", filtros.departamento_id);
  if (filtros.cargo_id) query = query.eq("cargo_id", filtros.cargo_id);
  if (filtros.superior_direto_id) {
    query = query.eq("superior_direto_id", filtros.superior_direto_id);
  }
  const { data } = await query;
  const ativos = data ?? [];

  const { data: dependentesRows } = await supabase
    .from("colaborador_dependentes")
    .select("colaborador_id");
  const idsComDependente = new Set((dependentesRows ?? []).map((d) => d.colaborador_id));

  const idades = ativos
    .map((c) => c.data_nascimento)
    .filter((d): d is string => !!d)
    .map((d) => calcularIdade(d));
  const idadeMedia = idades.length
    ? Math.round(idades.reduce((soma, i) => soma + i, 0) / idades.length)
    : 0;

  const anosDeCasa = ativos.map((c) => calcularAnosDeCasa(c.data_admissao));

  const diasDeCasaClt = ativos
    .filter((c) => temRegimeClt(c.tipo_contrato))
    .map((c) => calcularDiasDeCasa(c.data_admissao));

  const comDependente = ativos.filter((c) => idsComDependente.has(c.id)).length;

  return {
    totalAtivos: ativos.length,
    idadeMedia,
    porGenero: contarPorOpcoes(
      ativos.map((c) => c.genero),
      GENERO_OPTIONS,
    ),
    porRacaEtnia: contarPorOpcoes(
      ativos.map((c) => c.raca_etnia),
      RACA_ETNIA_OPTIONS,
    ),
    porGrauHierarquico: contarCategorias(
      ativos.map((c) => c.grau_hierarquico),
      (v) => v,
    ),
    porEstadoCivil: contarPorOpcoes(
      ativos.map((c) => c.estado_civil),
      ESTADO_CIVIL_OPTIONS,
    ),
    comDeficiencia: [
      { label: "Com Deficiência", value: ativos.filter((c) => c.pessoa_com_deficiencia).length },
      { label: "Sem Deficiência", value: ativos.filter((c) => !c.pessoa_com_deficiencia).length },
    ],
    comDependentes: [
      { label: "Com dependente", value: comDependente },
      { label: "Sem dependentes", value: ativos.length - comDependente },
    ],
    porGrupoIdade: contarPorFaixa(idades, FAIXAS_IDADE),
    porTempoEmpresa: contarPorFaixa(anosDeCasa, FAIXAS_TEMPO_EMPRESA),
    porEscolaridade: contarPorOpcoes(
      ativos.map((c) => c.escolaridade),
      ESCOLARIDADE_OPTIONS,
    ),
    porPeriodoExperiencia: contarPorFaixa(diasDeCasaClt, FAIXAS_EXPERIENCIA),
    porTipoContrato: contarPorOpcoes(
      ativos.map((c) => c.tipo_contrato),
      TIPO_CONTRATO_OPTIONS,
    ),
  };
}

export type MetricasColaborador = Awaited<ReturnType<typeof buscarMetricasColaborador>>;

/** Dados da aba "Organização e Estrutura": distribuição dos colaboradores
 * ativos por departamento, unidade e superior direto. */
export async function buscarEstruturaOrganizacional(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filtros: FiltrosMetricas,
) {
  let query = supabase
    .from("colaboradores")
    .select("departamento_id, unidade_id, superior_direto_id")
    .eq("status", "ativo");
  if (filtros.unidade_id) query = query.eq("unidade_id", filtros.unidade_id);
  if (filtros.departamento_id) query = query.eq("departamento_id", filtros.departamento_id);
  if (filtros.cargo_id) query = query.eq("cargo_id", filtros.cargo_id);
  if (filtros.superior_direto_id) {
    query = query.eq("superior_direto_id", filtros.superior_direto_id);
  }
  const [{ data }, { data: departamentos }, { data: unidades }, { data: colaboradores }] =
    await Promise.all([
      query,
      supabase.from("departamentos").select("id, nome"),
      supabase.from("unidades").select("id, nome"),
      supabase.from("colaboradores").select("id, nome_completo"),
    ]);
  const ativos = data ?? [];

  const nomeDepartamento = new Map((departamentos ?? []).map((d) => [d.id, d.nome]));
  const nomeUnidade = new Map((unidades ?? []).map((u) => [u.id, u.nome]));
  const nomeColaborador = new Map((colaboradores ?? []).map((c) => [c.id, c.nome_completo]));

  return {
    porDepartamento: contarCategorias(
      ativos.map((c) => nomeDepartamento.get(c.departamento_id) ?? null),
      (v) => v,
    ),
    porUnidade: contarCategorias(
      ativos.map((c) => nomeUnidade.get(c.unidade_id) ?? null),
      (v) => v,
    ),
    porSuperiorDireto: contarCategorias(
      ativos.map((c) =>
        c.superior_direto_id ? (nomeColaborador.get(c.superior_direto_id) ?? null) : null,
      ),
      (v) => v,
    ),
  };
}
