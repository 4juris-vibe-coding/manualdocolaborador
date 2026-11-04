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

/** Em andamento: nem concluído nem cancelado. */
export const processoAberto = (p: ProcessoJornada) => !p.concluidoEm && !p.canceladoEm

/** Itens obrigatórios (padrão: todos). Itens opcionais não travam a conclusão. */
export const obrigatorio = (i: { obrigatorio?: boolean }) => i.obrigatorio !== false

/** O processo está concluído quando TODOS os itens obrigatórios foram feitos (nunca por suposição). */
export function concluiu(itens: ProcessoJornada['itens']): boolean {
  const obr = itens.filter(obrigatorio)
  return (obr.length ? obr : itens).every((i) => i.feito)
}

/** Progresso considerando só os obrigatórios (o que define a conclusão). */
export function progressoObrigatorio(p: ProcessoJornada) {
  const obr = p.itens.filter(obrigatorio)
  const base = obr.length ? obr : p.itens
  const feitos = base.filter((i) => i.feito).length
  return { total: base.length, feitos, percentual: base.length ? Math.round((feitos / base.length) * 100) : 0 }
}

/** Data de referência do processo: a data efetiva do evento (encerramento/início), com fallback para o início do checklist. */
export function referenciaDe(p: ProcessoJornada, pessoa?: { dataEntrada?: string; encerramento?: { data: string } }): string {
  if (p.referencia) return p.referencia
  if (p.tipo === 'encerramento' && pessoa?.encerramento?.data) return pessoa.encerramento.data
  if (p.tipo === 'integracao' && pessoa?.dataEntrada) return pessoa.dataEntrada
  return p.iniciadoEm
}
