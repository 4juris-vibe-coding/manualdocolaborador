/* ============================================================
   4JURIS Pessoas · Indicadores de recrutamento (definições puras)
   Cada indicador devolve null quando não há dados suficientes:
   nunca se inventa valor. As definições abaixo são exibidas na
   interface (DEFINICOES) para o RH saber exatamente o que é medido.
   ============================================================ */

export const DEFINICOES = {
  tempoPreenchimento: 'Dias entre a publicação da vaga e a data da contratação que fecha a última posição. Só entram vagas que já preencheram todas as posições.',
  tempoPrimeiraCandidatura: 'Dias entre a publicação da vaga e a chegada da primeira candidatura.',
  tempoPorEtapa: 'Média de dias que as candidaturas permaneceram em cada etapa, a partir das movimentações registradas (etapas ainda em curso não entram).',
  conversaoPorEtapa: 'Das candidaturas que chegaram a uma etapa, a proporção que chegou à etapa seguinte.',
  taxaConversao: 'Contratações ÷ candidaturas recebidas no período.',
  noPrazo: 'Vagas preenchidas até o prazo de preenchimento (ou ainda em aberto dentro do prazo) ÷ vagas com prazo definido.',
} as const

const DIA = 86400000
const dias = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / DIA

export interface VagaIndicador {
  id: string; status: string; qtdPosicoes: number; posicoesPreenchidas: number
  publicadaEm: string | null; primeiraCandidaturaEm: string | null; prazoPreenchimento: string | null; encerradaEm?: string | null
}
export interface ContratacaoIndicador { vagaId: string; em: string }

/** Contratações ordenadas da vaga; a que fecha a última posição é a de índice qtdPosicoes-1. */
export function dataFechamento(v: VagaIndicador, contratacoes: ContratacaoIndicador[]): string | null {
  const ds = contratacoes.filter((c) => c.vagaId === v.id).map((c) => c.em).sort()
  return ds.length >= v.qtdPosicoes ? ds[v.qtdPosicoes - 1] : null
}

export function tempoPreenchimentoDias(v: VagaIndicador, contratacoes: ContratacaoIndicador[]): number | null {
  if (!v.publicadaEm) return null
  const f = dataFechamento(v, contratacoes)
  if (!f) return null
  const d = dias(v.publicadaEm, f)
  return d >= 0 ? Math.round(d * 10) / 10 : null
}

export function tempoAtePrimeiraCandidaturaDias(v: VagaIndicador): number | null {
  if (!v.publicadaEm || !v.primeiraCandidaturaEm) return null
  const d = dias(v.publicadaEm, v.primeiraCandidaturaEm)
  return d >= 0 ? Math.round(d * 10) / 10 : null
}

export const media = (ns: number[]): number | null => (ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null)

export interface MovIndicador { candidaturaId: string; em: string; paraEtapaId: string | null }
export interface TempoEtapa { etapa: string; dias: number; n: number }

/**
 * Tempo em cada etapa: para cada movimentação que coloca a candidatura numa etapa, a permanência vai até a
 * movimentação seguinte (mudança de etapa ou saída do processo, que tem paraEtapaId nulo). Sem movimentação seguinte = ainda em curso, ignorada.
 */
export function tempoPorEtapa(movs: MovIndicador[], nomeEtapa: (etapaId: string) => string | null): TempoEtapa[] {
  const porCand = new Map<string, MovIndicador[]>()
  for (const m of movs) { const l = porCand.get(m.candidaturaId) ?? []; l.push(m); porCand.set(m.candidaturaId, l) }
  const acc = new Map<string, number[]>()
  for (const l of porCand.values()) {
    l.sort((a, b) => a.em.localeCompare(b.em))
    for (let i = 0; i < l.length - 1; i++) {
      const etapa = l[i].paraEtapaId
      if (!etapa) continue
      const nome = nomeEtapa(etapa)
      if (!nome) continue
      const d = dias(l[i].em, l[i + 1].em)
      if (d < 0) continue
      acc.set(nome, [...(acc.get(nome) ?? []), d])
    }
  }
  return [...acc.entries()].map(([etapa, ds]) => ({ etapa, dias: media(ds) ?? 0, n: ds.length }))
}

export interface EstagioFunil { tipo: string; rotulo: string; alcancaram: number; conversaoDaAnterior: number | null }
const ORDEM_FUNIL: { tipo: string; rotulo: string }[] = [
  { tipo: 'nova', rotulo: 'Candidaturas' }, { tipo: 'triagem', rotulo: 'Triagem' }, { tipo: 'curricular', rotulo: 'Análise curricular' },
  { tipo: 'tecnica', rotulo: 'Avaliação técnica' }, { tipo: 'entrevista_rh', rotulo: 'Entrevista com RH' }, { tipo: 'entrevista_gestor', rotulo: 'Entrevista com gestor' },
  { tipo: 'entrevista_final', rotulo: 'Entrevista final' }, { tipo: 'proposta', rotulo: 'Proposta' }, { tipo: 'contratado', rotulo: 'Contratados' },
]

/** Cada candidatura informa os tipos de etapa pelos quais passou. Etapas que ninguém alcançou saem do funil (vagas diferentes têm etapas diferentes). */
export function funilPorTipo(candidaturas: { tiposAlcancados: string[] }[]): EstagioFunil[] {
  const cont = ORDEM_FUNIL.map((e) => ({ ...e, alcancaram: candidaturas.filter((c) => c.tiposAlcancados.includes(e.tipo)).length }))
  const usados = cont.filter((e) => e.alcancaram > 0)
  return usados.map((e, i) => ({ tipo: e.tipo, rotulo: e.rotulo, alcancaram: e.alcancaram, conversaoDaAnterior: i === 0 ? null : usados[i - 1].alcancaram ? Math.round((e.alcancaram / usados[i - 1].alcancaram) * 1000) / 10 : null }))
}

export function taxaConversao(candidaturas: number, contratacoes: number): number | null {
  return candidaturas > 0 ? Math.round((contratacoes / candidaturas) * 1000) / 10 : null
}

/** true = dentro do prazo, false = fora, null = vaga sem prazo definido. */
export function vagaNoPrazo(v: VagaIndicador, contratacoes: ContratacaoIndicador[], hoje: string): boolean | null {
  if (!v.prazoPreenchimento) return null
  const f = dataFechamento(v, contratacoes)
  if (f) return f.slice(0, 10) <= v.prazoPreenchimento
  if (['cancelada', 'rascunho'].includes(v.status)) return null
  if (v.status === 'encerrada') return v.encerradaEm ? v.encerradaEm.slice(0, 10) <= v.prazoPreenchimento : null
  return hoje <= v.prazoPreenchimento
}
