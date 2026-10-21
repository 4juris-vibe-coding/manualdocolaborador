/* Linha do tempo de disponibilidade: uma linha por pessoa, uma coluna por dia. */
import type { Colaborador, PeriodoIndisponibilidade } from '@/lib/types'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { parseDia, somarDias, hojeISO } from '@/domain/datas'

export function AgendaTimeline({ pessoas, periodos, inicio, dias = 42, vazio = 'Nenhum período registrado neste intervalo.' }: {
  pessoas: Colaborador[]
  periodos: PeriodoIndisponibilidade[]
  inicio: string
  dias?: number
  vazio?: string
}) {
  const hoje = hojeISO()
  const fim = somarDias(inicio, dias - 1)
  const colunas = Array.from({ length: dias }, (_, i) => somarDias(inicio, i))
  const ativos = periodos.filter((p) => p.status !== 'cancelado' && p.inicio <= fim && p.fim >= inicio)
  const linhas = pessoas.filter((c) => ativos.some((p) => p.colaboradorId === c.id))
  // Dias com 2+ pessoas indisponíveis (sinal para coordenação, não restrição).
  const contagem = colunas.map((d) => ativos.filter((p) => p.inicio <= d && d <= p.fim).length)

  if (!linhas.length) return <p className="text-[13px] text-muted p-5">{vazio}</p>

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px] p-4">
        <div className="grid items-end" style={{ gridTemplateColumns: `180px repeat(${dias}, minmax(14px, 1fr))` }}>
          <div />
          {colunas.map((d, i) => {
            const dt = parseDia(d)
            const primeiro = dt.getDate() === 1 || i === 0
            return (
              <div key={d} className={cn('text-center text-[9.5px] leading-tight pb-1', d === hoje ? 'text-brand font-bold' : 'text-muted')}>
                {primeiro && <div className="font-bold uppercase text-ink-2 text-left whitespace-nowrap">{dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>}
                {dt.getDate()}
              </div>
            )
          })}
          {linhas.map((c) => (
            <div key={c.id} className="contents">
              <div className="flex items-center gap-2 pr-2 py-1.5 min-w-0">
                <Avatar nome={c.nome} cor={c.avatarCor} size="sm" className="!h-7 !w-7 !text-[10px]" />
                <span className="text-[12.5px] font-semibold text-ink truncate">{c.nome}</span>
              </div>
              {colunas.map((d) => {
                const p = ativos.find((x) => x.colaboradorId === c.id && x.inicio <= d && d <= x.fim)
                const fds = [0, 6].includes(parseDia(d).getDay())
                return (
                  <div key={d} className={cn('h-8 border-l border-line/60 flex items-center', fds && 'bg-surface-2')}>
                    {p && (
                      <div
                        title={`${c.nome}: ${p.inicio} → ${p.fim} · ${p.status === 'alinhado' ? 'continuidade alinhada' : 'planejado'}`}
                        className={cn('h-5 w-full', p.status === 'alinhado' ? 'bg-success/80' : 'bg-brand/70 bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,.35)_3px,rgba(255,255,255,.35)_6px)]',
                          d === p.inicio && 'rounded-l-md', d === p.fim && 'rounded-r-md')}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          <div className="text-[11px] text-muted pt-2 pr-2">Pessoas indisponíveis</div>
          {contagem.map((n, i) => (
            <div key={i} className={cn('text-center text-[10px] font-bold pt-2', n >= 2 ? 'text-warning' : 'text-muted-2')}>{n || ''}</div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-brand/70" /> Planejado</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-success/80" /> Continuidade alinhada</span>
          <span className="flex items-center gap-1.5"><b className="text-warning">2+</b> dias com mais de uma pessoa indisponível (para coordenação)</span>
        </div>
      </div>
    </div>
  )
}
