/* ============================================================
   4JURIS Pessoas · Disponibilidade e descanso combinado
   ------------------------------------------------------------
   Regras deliberadamente AUSENTES (contexto PJ):
   - nenhum saldo/direito anual de dias;
   - nenhuma aprovação hierárquica obrigatória;
   - nenhum desconto, penalidade ou bloqueio por indisponibilidade;
   - nenhum controle de jornada.
   O que existe: registro do período, aviso de sobreposição na área,
   antecedência SUGERIDA e alinhamento de continuidade (opcional).
   ============================================================ */
import type { PeriodoIndisponibilidade, PoliticaDisponibilidade } from '@/lib/types'
import { diasEntre } from './datas.js'

export interface EntradaPeriodo {
  inicio: string
  fim: string
  mensagemEquipe?: string
  observacaoPrivada?: string
  contatoContinuidadeId?: string
  planoContinuidade?: string
}

export interface ValidacaoPeriodo {
  erros: string[]
  /** Avisos informativos — nunca impedem o registro. */
  avisos: string[]
}

export function validarPeriodo(
  e: EntradaPeriodo,
  pessoaId: string,
  existentes: PeriodoIndisponibilidade[],
  politica: PoliticaDisponibilidade,
  hoje: string,
  ignorarId?: string,
): ValidacaoPeriodo {
  const erros: string[] = []
  const avisos: string[] = []
  if (!e.inicio || !e.fim) erros.push('Informe a data de início e a data de fim.')
  else if (e.fim < e.inicio) erros.push('A data de fim deve ser igual ou posterior à data de início.')
  if (e.contatoContinuidadeId && e.contatoContinuidadeId === pessoaId) erros.push('O contato de continuidade deve ser outra pessoa.')
  if ((e.mensagemEquipe?.length ?? 0) > 280) erros.push('A mensagem para a equipe deve ter no máximo 280 caracteres.')
  if (erros.length) return { erros, avisos }

  const meus = existentes.filter((p) => p.colaboradorId === pessoaId && p.status !== 'cancelado' && p.id !== ignorarId)
  if (meus.some((p) => sobrepoe(p.inicio, p.fim, e.inicio, e.fim))) {
    erros.push('Você já registrou um período que se sobrepõe a estas datas.')
  }
  if (e.fim < hoje) avisos.push('O período informado já passou — ele ficará registrado como histórico.')
  else {
    const antecedencia = diasEntre(hoje, e.inicio)
    if (antecedencia >= 0 && antecedencia < politica.antecedenciaSugeridaDias) {
      avisos.push(`A empresa sugere registrar com ${politica.antecedenciaSugeridaDias} dias de antecedência, para facilitar a reorganização das entregas. O registro continua permitido.`)
    }
  }
  return { erros, avisos }
}

export function sobrepoe(aIni: string, aFim: string, bIni: string, bFim: string): boolean {
  return aIni <= bFim && bIni <= aFim
}

/** Outras pessoas da mesma área com período sobreposto (para coordenação). */
export function sobreposicoesNaArea(
  inicio: string, fim: string, pessoaId: string, setorId: string,
  periodos: PeriodoIndisponibilidade[], setorDe: (pessoaId: string) => string | undefined,
): PeriodoIndisponibilidade[] {
  return periodos.filter((p) =>
    p.status !== 'cancelado' && p.colaboradorId !== pessoaId &&
    setorDe(p.colaboradorId) === setorId && sobrepoe(p.inicio, p.fim, inicio, fim))
}

export function indisponivelEm(periodos: PeriodoIndisponibilidade[], pessoaId: string, dia: string) {
  return periodos.find((p) => p.colaboradorId === pessoaId && p.status !== 'cancelado' && p.inicio <= dia && dia <= p.fim)
}

export function situacaoPeriodo(p: PeriodoIndisponibilidade, hoje: string): 'futuro' | 'em_andamento' | 'concluido' | 'cancelado' {
  if (p.status === 'cancelado') return 'cancelado'
  if (hoje < p.inicio) return 'futuro'
  if (hoje > p.fim) return 'concluido'
  return 'em_andamento'
}

export const POLITICA_PADRAO: PoliticaDisponibilidade = {
  antecedenciaSugeridaDias: 15,
  usarAlinhamento: true,
  avisarSobreposicao: true,
  orientacao:
    'Registre aqui os períodos em que você não estará disponível para os projetos. ' +
    'Isso ajuda a área a reorganizar entregas e evitar conflitos de agenda. ' +
    'Os períodos seguem o que foi combinado no seu contrato de prestação de serviços.',
}
