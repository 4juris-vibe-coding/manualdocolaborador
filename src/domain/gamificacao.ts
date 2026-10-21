/* ============================================================
   4JURIS Pessoas · Motor de gamificação (regras puras)
   ------------------------------------------------------------
   - Pontos vêm SEMPRE de lançamentos no histórico (ledger): o saldo
     é a soma, nunca um número solto editável.
   - Cada (pessoa, ação, referência) pontua uma única vez → evita
     exploração por repetição da mesma ação.
   - Regras configuráveis pelo RH (pontos, ativa, limite mensal).
   - Pontos/níveis NÃO se relacionam a remuneração, descontos,
     penalidades ou hierarquia. Não há pontuação negativa automática.
   ============================================================ */
import type {
  AcaoPontuavel, Badge, ConfigGamificacao, ConquistaObtida, Desafio,
  LancamentoPontos, NivelConfig, RegraPontuacao,
} from '@/lib/types'

export const ACAO_LABEL: Record<AcaoPontuavel, string> = {
  perfil_completo: 'Perfil completo',
  participacao_evento: 'Participação em evento',
  reconhecimento_recebido: 'Reconhecimento recebido',
  reconhecimento_enviado: 'Reconhecimento enviado',
  desafio_concluido: 'Desafio concluído',
  conteudo_concluido: 'Conteúdo concluído',
  pesquisa_respondida: 'Pesquisa respondida',
  integracao_concluida: 'Integração concluída',
  iniciativa_concluida: 'Iniciativa da comunidade',
  ajuste_manual: 'Ajuste manual (RH)',
}

export const ACAO_ICON: Record<AcaoPontuavel, string> = {
  perfil_completo: 'UserCheck',
  participacao_evento: 'CalendarHeart',
  reconhecimento_recebido: 'Heart',
  reconhecimento_enviado: 'Send',
  desafio_concluido: 'Flag',
  conteudo_concluido: 'BookOpenCheck',
  pesquisa_respondida: 'MessageSquareText',
  integracao_concluida: 'Rocket',
  iniciativa_concluida: 'HandHeart',
  ajuste_manual: 'SlidersHorizontal',
}

export function saldo(ledger: LancamentoPontos[], pessoaId: string): number {
  let t = 0
  for (const l of ledger) if (l.colaboradorId === pessoaId) t += l.pontos
  return Math.max(0, t)
}

export function historico(ledger: LancamentoPontos[], pessoaId: string): LancamentoPontos[] {
  return ledger.filter((l) => l.colaboradorId === pessoaId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

export interface NivelInfo {
  nivel: number
  nome: string
  minimo: number
  proximoMinimo: number | null
  proximoNome: string | null
  faltam: number
  progresso: number // 0-100
}

export function nivelDe(pontos: number, niveis: NivelConfig[]): NivelInfo {
  const ord = [...niveis].sort((a, b) => a.minimo - b.minimo)
  let idx = 0
  for (let i = 0; i < ord.length; i++) if (pontos >= ord[i].minimo) idx = i
  const atual = ord[idx] ?? { nivel: 1, nome: 'Início', minimo: 0 }
  const prox = ord[idx + 1] ?? null
  const span = prox ? prox.minimo - atual.minimo : 1
  return {
    nivel: atual.nivel,
    nome: atual.nome,
    minimo: atual.minimo,
    proximoMinimo: prox?.minimo ?? null,
    proximoNome: prox?.nome ?? null,
    faltam: prox ? Math.max(0, prox.minimo - pontos) : 0,
    progresso: prox ? Math.round(((pontos - atual.minimo) / span) * 100) : 100,
  }
}

export type ResultadoPontuacao =
  | { ok: true; lancamento: LancamentoPontos }
  | { ok: false; motivo: 'regra_inativa' | 'duplicado' | 'limite_mensal' | 'sem_regra' }

export interface EntradaPontuacao {
  pessoaId: string
  acao: AcaoPontuavel
  referenciaId: string
  descricao: string
  /** Sobrescreve os pontos da regra (ex.: iniciativa com valor próprio). */
  pontos?: number
  registradoPorId?: string
  agora: string // ISO
}

/** Avalia se uma ação pode gerar pontos e, se puder, devolve o lançamento a gravar. */
export function avaliarPontuacao(
  ledger: LancamentoPontos[],
  regras: RegraPontuacao[],
  e: EntradaPontuacao,
  novoId: () => string,
): ResultadoPontuacao {
  const regra = regras.find((r) => r.acao === e.acao)
  if (!regra) return { ok: false, motivo: 'sem_regra' }
  if (!regra.ativa) return { ok: false, motivo: 'regra_inativa' }

  const dup = ledger.some((l) => l.colaboradorId === e.pessoaId && l.acao === e.acao && l.referenciaId === e.referenciaId)
  if (dup) return { ok: false, motivo: 'duplicado' }

  if (regra.limiteMensal != null) {
    const mes = e.agora.slice(0, 7)
    const noMes = ledger.filter((l) => l.colaboradorId === e.pessoaId && l.acao === e.acao && l.criadoEm.slice(0, 7) === mes).length
    if (noMes >= regra.limiteMensal) return { ok: false, motivo: 'limite_mensal' }
  }

  return {
    ok: true,
    lancamento: {
      id: novoId(),
      colaboradorId: e.pessoaId,
      acao: e.acao,
      regraId: regra.id,
      referenciaId: e.referenciaId,
      pontos: Math.max(0, e.pontos ?? regra.pontos),
      descricao: e.descricao,
      criadoEm: e.agora,
      registradoPorId: e.registradoPorId,
    },
  }
}

export const MOTIVO_NAO_PONTUOU: Record<Exclude<ResultadoPontuacao, { ok: true }>['motivo'], string> = {
  regra_inativa: 'a regra de pontuação está desativada',
  duplicado: 'esta ação já foi pontuada antes',
  limite_mensal: 'o limite mensal desta ação foi atingido',
  sem_regra: 'não há regra configurada para esta ação',
}

/** Quantas vezes a pessoa realizou uma ação pontuada (opcionalmente dentro de um período). */
export function contarAcoes(ledger: LancamentoPontos[], pessoaId: string, acao: AcaoPontuavel, inicio?: string, fim?: string) {
  return ledger.filter((l) =>
    l.colaboradorId === pessoaId && l.acao === acao &&
    (!inicio || l.criadoEm.slice(0, 10) >= inicio) &&
    (!fim || l.criadoEm.slice(0, 10) <= fim),
  ).length
}

/** Conquistas cujo critério foi atingido e que a pessoa ainda não possui. */
export function conquistasNovas(
  ledger: LancamentoPontos[], badges: Badge[], obtidas: ConquistaObtida[], pessoaId: string, niveis: NivelConfig[],
): Badge[] {
  const tem = new Set(obtidas.filter((o) => o.colaboradorId === pessoaId).map((o) => o.badgeId))
  const pts = saldo(ledger, pessoaId)
  const nivel = nivelDe(pts, niveis).nivel
  return badges.filter((b) => {
    if (tem.has(b.id) || !b.ativa) return false
    if (b.criterio.tipo === 'nivel') return nivel >= b.criterio.nivel
    return contarAcoes(ledger, pessoaId, b.criterio.acao) >= b.criterio.quantidade
  })
}

export interface ProgressoDesafio {
  atual: number
  meta: number
  percentual: number
  concluido: boolean
  participando: boolean
  status: 'futuro' | 'ativo' | 'encerrado'
}

export function progressoDesafio(d: Desafio, ledger: LancamentoPontos[], pessoaId: string, hoje: string): ProgressoDesafio {
  const atual = contarAcoes(ledger, pessoaId, d.criterio.acao, d.inicio, d.fim)
  const concluido = ledger.some((l) => l.colaboradorId === pessoaId && l.acao === 'desafio_concluido' && l.referenciaId === d.id)
  const status = hoje < d.inicio ? 'futuro' : hoje > d.fim ? 'encerrado' : 'ativo'
  return {
    atual: Math.min(atual, d.criterio.meta),
    meta: d.criterio.meta,
    percentual: Math.min(100, Math.round((atual / Math.max(1, d.criterio.meta)) * 100)),
    concluido,
    participando: d.participantes.includes(pessoaId),
    status,
  }
}

/** Valida a configuração de níveis (mínimos crescentes, começando em 0). */
export function validarNiveis(niveis: NivelConfig[]): string | null {
  if (!niveis.length) return 'Defina ao menos um nível.'
  const ord = [...niveis].sort((a, b) => a.nivel - b.nivel)
  if (ord[0].minimo !== 0) return 'O primeiro nível deve começar em 0 ponto.'
  for (let i = 1; i < ord.length; i++) {
    if (ord[i].minimo <= ord[i - 1].minimo) return 'Os pontos mínimos devem crescer a cada nível.'
    if (!ord[i].nome.trim()) return 'Todo nível precisa de um nome.'
  }
  return null
}

export const CONFIG_GAMIFICACAO_PADRAO: ConfigGamificacao = {
  destaquesAtivos: true,
  limiteReconhecimentosEnviadosMes: 10,
  pontosMaximosIniciativa: 300,
  niveis: [
    { nivel: 1, nome: 'Chegando', minimo: 0 },
    { nivel: 2, nome: 'Explorador(a)', minimo: 300 },
    { nivel: 3, nome: 'Participante', minimo: 800 },
    { nivel: 4, nome: 'Conector(a)', minimo: 1500 },
    { nivel: 5, nome: 'Inspirador(a)', minimo: 2500 },
    { nivel: 6, nome: 'Referência', minimo: 4000 },
  ],
}
