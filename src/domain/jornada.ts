/* ============================================================
   4JURIS Pessoas · Integração e encerramento de parceria
   Checklists configuráveis (portados de gest-o_rh-master/checklists,
   que só guardava tópicos) + acompanhamento por pessoa.
   ============================================================ */
import type { ChecklistModelo, ProcessoJornada, ResponsavelItem } from '@/lib/types'
import { somarDias } from './datas.js'

export function criarProcesso(modelo: ChecklistModelo, colaboradorId: string, inicio: string, id: string): ProcessoJornada {
  return {
    id, colaboradorId, modeloId: modelo.id, tipo: modelo.tipo, iniciadoEm: inicio,
    itens: modelo.itens.map((i) => ({ ...i, feito: false })),
  }
}

export function progresso(p: ProcessoJornada) {
  const total = p.itens.length
  const feitos = p.itens.filter((i) => i.feito).length
  return { total, feitos, percentual: total ? Math.round((feitos / total) * 100) : 0 }
}

export function prazoItem(p: ProcessoJornada, prazoDias?: number): string | undefined {
  return prazoDias == null ? undefined : somarDias(p.iniciadoEm, prazoDias)
}

export const RESPONSAVEL_LABEL: Record<ResponsavelItem, string> = {
  pessoa: 'Você', rh: 'RH', lideranca: 'Liderança da área',
}

export const RESPONSAVEL_LABEL_ADMIN: Record<ResponsavelItem, string> = {
  pessoa: 'Pessoa', rh: 'RH', lideranca: 'Liderança',
}
