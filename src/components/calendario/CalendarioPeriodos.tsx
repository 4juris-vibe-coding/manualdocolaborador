/* Períodos de indisponibilidade no calendário (mês/lista), como faixas de dia inteiro.
   Mostra só nome, datas e situação — observações privadas nunca entram. */
import { useMemo } from 'react'
import type { Colaborador, PeriodoIndisponibilidade } from '@/lib/types'
import { Calendario, type EventoCal } from './Calendario'

const COR = { planejado: '#0032D2', alinhado: '#0f9d6b' } as const

export function CalendarioPeriodos({ pessoas, periodos, onAbrir, textoVazio }: {
  pessoas: Colaborador[]; periodos: PeriodoIndisponibilidade[]; onAbrir?: (id: string) => void; textoVazio?: string
}) {
  const nomes = useMemo(() => new Map(pessoas.map((p) => [p.id, p.nomeSocial || p.nome])), [pessoas])
  const eventos: EventoCal[] = useMemo(() => periodos
    .filter((p) => p.status !== 'cancelado' && nomes.has(p.colaboradorId))
    .map((p) => ({
      id: p.id, titulo: String(nomes.get(p.colaboradorId)).split(' ').slice(0, 2).join(' '), inicio: p.inicio, fim: p.fim, diaInteiro: true,
      cor: COR[p.status as keyof typeof COR] ?? COR.planejado, subtitulo: p.status === 'alinhado' ? 'Continuidade alinhada' : 'Planejado',
    })), [periodos, nomes])
  return (
    <Calendario eventos={eventos} vistas={['mes', 'lista']} onAbrir={onAbrir} className="border-0 rounded-none shadow-none"
      legenda={[{ rotulo: 'Planejado', cor: COR.planejado }, { rotulo: 'Continuidade alinhada', cor: COR.alinhado }]}
      textoVazio={textoVazio ?? 'Ninguém indisponível neste mês.'} />
  )
}
