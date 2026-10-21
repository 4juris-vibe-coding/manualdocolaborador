/* ============================================================
   4JURIS Pessoas · Aniversários e marcos de parceria
   - Apenas dia/mês são exibidos (nunca o ano de nascimento).
   - Só aparecem pessoas que optaram por mostrar (privacidade).
   - Marcos de parceria NÃO representam antiguidade trabalhista.
   ============================================================ */
import type { Colaborador } from '@/lib/types'
import { parseDia } from './datas'

export interface Celebracao {
  pessoa: Colaborador
  tipo: 'aniversario' | 'marco'
  /** Dia e mês no ano de referência. */
  dia: number
  mes: number // 0-11
  /** Para marcos: anos completados de parceria. */
  anos?: number
}

const ativo = (c: Colaborador) => c.status !== 'encerrado'

export function aniversariosDoMes(pessoas: Colaborador[], mes: number): Celebracao[] {
  return pessoas
    .filter((c) => ativo(c) && c.privacidade.mostrarAniversario && c.nascimento)
    .map((c) => ({ c, d: parseDia(c.nascimento!) }))
    .filter(({ d }) => d.getMonth() === mes)
    .map(({ c, d }) => ({ pessoa: c, tipo: 'aniversario' as const, dia: d.getDate(), mes }))
    .sort((a, b) => a.dia - b.dia)
}

export function marcosDoMes(pessoas: Colaborador[], mes: number, ano: number): Celebracao[] {
  return pessoas
    .filter((c) => ativo(c) && c.privacidade.mostrarMarcos && c.dataEntrada)
    .map((c) => ({ c, d: parseDia(c.dataEntrada) }))
    .filter(({ d }) => d.getMonth() === mes && ano - d.getFullYear() >= 1)
    .map(({ c, d }) => ({ pessoa: c, tipo: 'marco' as const, dia: d.getDate(), mes, anos: ano - d.getFullYear() }))
    .sort((a, b) => a.dia - b.dia)
}

/** Celebrações de hoje (aniversário ou marco). */
export function celebracoesDoDia(pessoas: Colaborador[], hoje: string): Celebracao[] {
  const d = parseDia(hoje)
  const todas = [...aniversariosDoMes(pessoas, d.getMonth()), ...marcosDoMes(pessoas, d.getMonth(), d.getFullYear())]
  return todas.filter((c) => c.dia === d.getDate())
}

export function rotuloDiaMes(dia: number, mes: number): string {
  return new Date(2000, mes, dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}
