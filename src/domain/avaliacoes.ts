/* ============================================================
   4JURIS Pessoas · Ciclos de avaliação e avaliação de início de parceria
   Portado de gest-o_rh-master (avaliacao-desempenho/solicitar,
   avaliacao-experiencia e o cron gerar-avaliacoes-experiencia),
   completando o que lá faltava: telas de resposta e relatórios.
   - "Superior direto" = responsável da pessoa, ou a liderança da área.
   - Resultados apoiam conversas de alinhamento; nenhuma decisão
     contratual é tomada automaticamente a partir deles.
   ============================================================ */
import type {
  AvaliacaoInicio, CicloAvaliativo, Colaborador, Competencia, ConfigAvaliacaoInicio, ParticipanteCiclo,
  RespostaAvaliacao, RotuloEscala, Setor,
} from '@/lib/types'
import { somarDias } from './datas'

export const ROTULOS_ESCALA: Record<RotuloEscala, { titulo: string; r5: string[]; r4: string[] }> = {
  concordancia: { titulo: 'Concordância', r5: ['Discordo fortemente', 'Discordo', 'Concordo parcialmente', 'Concordo', 'Concordo fortemente'], r4: ['Discordo fortemente', 'Discordo', 'Concordo', 'Concordo fortemente'] },
  desempenho: { titulo: 'Entrega', r5: ['Insatisfatório', 'Abaixo do esperado', 'Dentro do esperado', 'Acima do esperado', 'Excepcional'], r4: ['Insatisfatório', 'Dentro do esperado', 'Acima do esperado', 'Excepcional'] },
  frequencia: { titulo: 'Frequência', r5: ['Nunca', 'Raramente', 'Às vezes', 'Frequentemente', 'Sempre'], r4: ['Nunca', 'Às vezes', 'Frequentemente', 'Sempre'] },
}

export const TIPO_RELACAO_INFO: Record<CicloAvaliativo['tipoRelacao'], { titulo: string; desc: string }> = {
  direta_90: { titulo: 'Direta (90°)', desc: 'Responsável avalia a pessoa.' },
  conjunta_180: { titulo: 'Conjunta (180°)', desc: 'Responsável avalia a pessoa e a pessoa avalia o responsável.' },
  trezentos_sessenta: { titulo: '360°', desc: 'Inclui também pares (mesma função e mesmo responsável).' },
  customizada: { titulo: 'Customizada', desc: 'Você define livremente avaliadores e avaliados.' },
}

export function rotulos(c: Pick<CicloAvaliativo, 'rotuloEscala' | 'niveisEscala'>): string[] {
  const r = ROTULOS_ESCALA[c.rotuloEscala]
  return c.niveisEscala === 5 ? r.r5 : r.r4
}

/** Responsáveis de alguém: o responsável direto, ou as lideranças da área (exceto a própria pessoa). */
export function responsaveisDe(p: Colaborador, pessoas: Colaborador[], setores: Setor[]): string[] {
  if (p.responsavelId && p.responsavelId !== p.id && pessoas.some((x) => x.id === p.responsavelId && x.status !== 'encerrado')) return [p.responsavelId]
  const s = setores.find((x) => x.id === p.setorId)
  return [...new Set([...(s?.liderancaIds ?? []), ...(s?.gestorId ? [s.gestorId] : [])])].filter((id) => id !== p.id)
}

export function elegiveis(c: CicloAvaliativo, pessoas: Colaborador[]): Colaborador[] {
  return pessoas.filter((p) =>
    p.status !== 'encerrado' && p.status !== 'pendente' &&
    (!c.iniciadosAte || p.dataEntrada <= c.iniciadosAte) &&
    (!c.regimes.length || c.regimes.includes(p.regime)) &&
    (!c.nivelEstrutura || !c.opcaoEstruturaId ||
      (c.nivelEstrutura === 'unidade' && p.unidadeId === c.opcaoEstruturaId) ||
      (c.nivelEstrutura === 'area' && p.setorId === c.opcaoEstruturaId) ||
      (c.nivelEstrutura === 'funcao' && p.cargoId === c.opcaoEstruturaId)))
}

/** Gera os pares avaliador → avaliado conforme o tipo de relação (portado de gerarParticipantesAutomaticos). */
export function gerarParticipantes(c: CicloAvaliativo, pessoas: Colaborador[], setores: Setor[], novoId: () => string): ParticipanteCiclo[] {
  const alvo = elegiveis(c, pessoas)
  const ids = new Set(alvo.map((p) => p.id))
  const pares = new Map<string, ParticipanteCiclo>()
  const add = (avaliadorId: string, avaliadoId: string) => {
    const k = `${avaliadorId}>${avaliadoId}`
    if (!pares.has(k)) pares.set(k, { id: novoId(), cicloId: c.id, avaliadorId, avaliadoId })
  }
  if (c.tipoRelacao !== 'customizada') {
    for (const p of alvo) {
      for (const r of responsaveisDe(p, pessoas, setores)) {
        add(r, p.id)
        if (c.tipoRelacao !== 'direta_90' && ids.has(r)) add(p.id, r)
      }
      if (c.tipoRelacao === 'trezentos_sessenta') {
        const meus = responsaveisDe(p, pessoas, setores).join(',')
        alvo.filter((x) => x.id !== p.id && x.cargoId === p.cargoId && responsaveisDe(x, pessoas, setores).join(',') === meus).forEach((par) => add(par.id, p.id))
      }
    }
  }
  if (c.autoavaliacao) alvo.forEach((p) => add(p.id, p.id))
  return [...pares.values()]
}

export function competenciasDe(avaliado: Colaborador, competencias: Competencia[], tipo: Competencia['tipo']): Competencia[] {
  const doCargo = competencias.filter((x) => x.ativo && x.tipo === tipo && x.cargoIds.includes(avaliado.cargoId))
  // Sem competências específicas da função, usa as gerais do tipo (vinculadas a todas).
  return doCargo.length ? doCargo : competencias.filter((x) => x.ativo && x.tipo === tipo && x.cargoIds.length === 0)
}

/** Nota ponderada pelo peso das competências, normalizada para 0–100. */
export function notaPonderada(notas: Record<string, number>, comps: Competencia[], niveis: number): number | null {
  const usadas = comps.filter((c) => notas[c.id] != null)
  const pesos = usadas.reduce((s, c) => s + c.peso, 0)
  if (!usadas.length || !pesos) return null
  const media = usadas.reduce((s, c) => s + notas[c.id] * c.peso, 0) / pesos
  return Math.round(((media - 1) / (niveis - 1)) * 100)
}

export interface ResultadoIndividual {
  respondidas: number
  total: number
  nota: number | null
  porCompetencia: { comp: Competencia; media: number | null; n: number }[]
  porRelacao: { relacao: 'responsavel' | 'autoavaliacao' | 'pares_e_outros'; nota: number | null; n: number }[]
  comentarios: string[]
}

export function resultadoIndividual(
  avaliadoId: string, ciclo: CicloAvaliativo, participantes: ParticipanteCiclo[], respostas: RespostaAvaliacao[],
  comps: Competencia[], responsaveis: string[],
): ResultadoIndividual {
  const meus = participantes.filter((p) => p.cicloId === ciclo.id && p.avaliadoId === avaliadoId)
  const rs = respostas.filter((r) => meus.some((p) => p.id === r.participanteId))
  const porCompetencia = comps.map((comp) => {
    const v = rs.map((r) => r.notas[comp.id]).filter((n) => n != null)
    return { comp, media: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null, n: v.length }
  })
  const media = (lista: RespostaAvaliacao[]) => {
    const ns = lista.map((r) => notaPonderada(r.notas, comps, ciclo.niveisEscala)).filter((n): n is number => n != null)
    return ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : null
  }
  const relacao = (r: RespostaAvaliacao) => {
    const p = meus.find((x) => x.id === r.participanteId)!
    return p.avaliadorId === avaliadoId ? 'autoavaliacao' : responsaveis.includes(p.avaliadorId) ? 'responsavel' : 'pares_e_outros'
  }
  const porRelacao = (['responsavel', 'autoavaliacao', 'pares_e_outros'] as const).map((rel) => {
    const l = rs.filter((r) => relacao(r) === rel)
    return { relacao: rel, nota: media(l), n: l.length }
  })
  // Nota geral exclui a autoavaliação (é exibida à parte).
  const externas = rs.filter((r) => relacao(r) !== 'autoavaliacao')
  return {
    respondidas: rs.length, total: meus.length, nota: media(externas.length ? externas : rs), porCompetencia, porRelacao,
    comentarios: rs.flatMap((r) => [r.comentarioGeral, ...Object.values(r.comentarios)].filter((x): x is string => !!x && !!x.trim())),
  }
}

/* ---------- Avaliação de início de parceria ---------- */
export const MARCOS_OPCOES: { label: string; marcos: number[] }[] = [
  { label: '90 dias', marcos: [90] },
  { label: '45 e 90 dias', marcos: [45, 90] },
  { label: '30, 60 e 90 dias', marcos: [30, 60, 90] },
]

/** Gera avaliações pendentes e expira as vencidas (equivale ao cron diário do sistema de RH). */
export function gerarAvaliacoesInicio(
  cfg: ConfigAvaliacaoInicio, pessoas: Colaborador[], setores: Setor[], existentes: AvaliacaoInicio[], hoje: string, novoId: () => string,
): { novas: AvaliacaoInicio[]; expiradasIds: string[] } {
  const expiradasIds = existentes.filter((a) => a.status === 'pendente' && a.expiraEm < hoje).map((a) => a.id)
  if (!cfg.habilitado) return { novas: [], expiradasIds }
  const novas: AvaliacaoInicio[] = []
  for (const p of pessoas) {
    if (p.status === 'encerrado' || p.status === 'pendente') continue
    if (cfg.regimes.length && !cfg.regimes.includes(p.regime)) continue
    if (cfg.cargoIds.length && !cfg.cargoIds.includes(p.cargoId)) continue
    for (const marco of cfg.marcos) {
      const ref = somarDias(p.dataEntrada, marco)
      if (somarDias(ref, -cfg.antecedenciaDias) > hoje) continue
      // Marcos muito antigos (pessoa já estava na base antes do módulo) não são gerados retroativamente.
      if (somarDias(ref, cfg.prazoRespostaDias) < hoje) continue
      if (existentes.some((a) => a.avaliadoId === p.id && a.marcoDias === marco) || novas.some((a) => a.avaliadoId === p.id && a.marcoDias === marco)) continue
      novas.push({
        id: novoId(), avaliadoId: p.id, avaliadorId: responsaveisDe(p, pessoas, setores)[0], cargoId: p.cargoId, setorId: p.setorId, unidadeId: p.unidadeId,
        marcoDias: marco, dataReferencia: ref, expiraEm: somarDias(ref, cfg.prazoRespostaDias), status: 'pendente', criadoEm: hoje,
      })
    }
  }
  return { novas, expiradasIds }
}

export const CONFIG_INICIO_PADRAO: ConfigAvaliacaoInicio = {
  habilitado: true, marcos: [30, 60, 90], regimes: [], cargoIds: [], antecedenciaDias: 7, prazoRespostaDias: 15,
}
