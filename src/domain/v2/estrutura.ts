/* ============================================================
   Indicadores de ESTRUTURA organizacional (spec §12.4 e §13.3)
   Funções puras e reutilizáveis (também pelo painel People Analytics).
   Descrevem a estrutura; não a julgam: muitos ou poucos níveis não
   significam estrutura inadequada.
   ============================================================ */
import {
  ehAtiva, construirHierarquia, posicoesVagas,
  type PessoaOrg, type SetorOrg, type VagaOrg, type TipoPendencia, type Pendencia,
} from './organograma.js'

export interface CargoEstrutura { id: string; nome: string; nivel?: string }
export interface UnidadeEstrutura { id: string; nome: string }
export interface ContagemItem { id: string; nome: string; qtd: number }

export interface IndicadoresEstrutura {
  totalAtivos: number
  totalCadastrados: number
  gestores: number
  niveisHierarquicos: number
  porNivelHierarquico: { nivel: number; qtd: number }[]
  porSetor: ContagemItem[]
  porUnidade: ContagemItem[]
  porCargo: ContagemItem[]
  porSenioridade: ContagemItem[]
  /** Equipes: gestores com seus subordinados diretos e totais (ordem decrescente). */
  equipes: { id: string; nome: string; diretos: number; totais: number }[]
  tamanhoMedioEquipe: number | null
  pendenciasPorTipo: Partial<Record<TipoPendencia, number>>
  pendencias: Pendencia[]
  setoresSemGestor: string[]
  ciclos: string[][]
  raizes: number
  posicoesVagas: { total: number; porSetor: ContagemItem[] }
  /** Indicadores que NÃO são calculados e por quê (nada é inventado). */
  indisponiveis: { indicador: string; dependencia: string }[]
}

const contar = (ids: (string | undefined | null)[], nomes: Map<string, string>, semNome: string): ContagemItem[] => {
  const m = new Map<string, number>()
  for (const id of ids) { const k = id || '__sem__'; m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([id, qtd]) => ({ id, nome: id === '__sem__' ? semNome : nomes.get(id) ?? 'Cadastro removido', qtd })).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, 'pt-BR'))
}

export function indicadoresEstrutura(
  pessoas: PessoaOrg[], setores: SetorOrg[], cargos: CargoEstrutura[], unidades: UnidadeEstrutura[], vagas: VagaOrg[] = [],
): IndicadoresEstrutura {
  const ativas = pessoas.filter(ehAtiva)
  const h = construirHierarquia(pessoas, setores)
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]))
  const nomeCargo = new Map(cargos.map((c) => [c.id, c.nome]))
  const nomeUnidade = new Map(unidades.map((u) => [u.id, u.nome]))
  const nomePessoa = new Map(pessoas.map((p) => [p.id, p.nome]))
  const nivelCargo = new Map(cargos.map((c) => [c.id, c.nivel ?? '']))

  const porNivel = new Map<number, number>()
  for (const n of h.nos.values()) porNivel.set(n.nivel, (porNivel.get(n.nivel) ?? 0) + 1)

  const equipes = [...h.diretos.entries()].filter(([, d]) => d > 0)
    .map(([id, diretos]) => ({ id, nome: nomePessoa.get(id) ?? id, diretos, totais: h.totais.get(id) ?? 0 }))
    .sort((a, b) => b.diretos - a.diretos || a.nome.localeCompare(b.nome, 'pt-BR'))

  const pendenciasPorTipo: Partial<Record<TipoPendencia, number>> = {}
  for (const p of h.pendencias) pendenciasPorTipo[p.tipo] = (pendenciasPorTipo[p.tipo] ?? 0) + 1

  const vagasPos = posicoesVagas(vagas, h.pessoas, setores)
  const vagasSetor = new Map<string, number>()
  for (const v of vagasPos) vagasSetor.set(v.setorId ?? '', (vagasSetor.get(v.setorId ?? '') ?? 0) + v.abertas)

  return {
    totalAtivos: ativas.length,
    totalCadastrados: pessoas.length,
    gestores: equipes.length,
    niveisHierarquicos: h.niveis,
    porNivelHierarquico: [...porNivel.entries()].sort((a, b) => a[0] - b[0]).map(([nivel, qtd]) => ({ nivel: nivel + 1, qtd })),
    porSetor: contar(ativas.map((p) => p.setorId), nomeSetor, 'Sem área definida'),
    porUnidade: contar(ativas.map((p) => p.unidadeId), nomeUnidade, 'Sem unidade definida'),
    porCargo: contar(ativas.map((p) => p.cargoId), nomeCargo, 'Sem função definida'),
    porSenioridade: contar(ativas.map((p) => nivelCargo.get(p.cargoId ?? '') || undefined), new Map([...nivelCargo.values()].filter(Boolean).map((n) => [n, n] as [string, string])), 'Sem nível definido'),
    equipes,
    tamanhoMedioEquipe: equipes.length ? Math.round((equipes.reduce((s, e) => s + e.diretos, 0) / equipes.length) * 10) / 10 : null,
    pendenciasPorTipo,
    pendencias: h.pendencias,
    setoresSemGestor: h.pendencias.filter((p) => p.tipo === 'setor_sem_gestor').map((p) => p.setorId!).filter(Boolean),
    ciclos: h.ciclos,
    raizes: h.raizes.length,
    posicoesVagas: {
      total: vagasPos.reduce((s, v) => s + v.abertas, 0),
      porSetor: [...vagasSetor.entries()].map(([id, qtd]) => ({ id, nome: nomeSetor.get(id) ?? 'Sem área definida', qtd })).sort((a, b) => b.qtd - a.qtd),
    },
    indisponiveis: [
      { indicador: 'Absenteísmo', dependencia: 'Registro de ponto/ausências (não existe no modelo PJ)' },
      { indicador: 'Custo de folha por área', dependencia: 'Dados de folha de pagamento (o modelo PJ usa contratos e notas fiscais, que não entram aqui)' },
    ],
  }
}

export interface PontoEvolucao { mes: string; ativos: number; gestores: number; niveis: number; pendencias: number }
export interface SnapshotEstrutura { mes: string; dados: { ativos: number; gestores: number; niveis: number; pendencias: number; porSetor: ContagemItem[] } }

/** Resumo gravado todo mês para mostrar a evolução (só faz sentido com 2 ou mais pontos). */
export function resumoParaSnapshot(i: IndicadoresEstrutura): SnapshotEstrutura['dados'] {
  return { ativos: i.totalAtivos, gestores: i.gestores, niveis: i.niveisHierarquicos, pendencias: i.pendencias.length, porSetor: i.porSetor }
}
export const evolucaoDisponivel = (s: SnapshotEstrutura[]) => s.length >= 2
