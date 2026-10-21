/* Gráficos SVG leves e acessíveis (sem bibliotecas). */
import { cn } from '@/lib/utils'

export interface Fatia { rotulo: string; valor: number; cor: string }

/** Rosca com legenda; mostra % e quantidade. Acessível via aria-label e tabela oculta. */
export function DonutChart({ dados, titulo, centro, vazio = 'Sem dados.', tamanho = 140 }: { dados: Fatia[]; titulo: string; centro?: string; vazio?: string; tamanho?: number }) {
  const total = dados.reduce((s, d) => s + d.valor, 0)
  if (!total) return <p className="text-[13px] text-muted py-4">{vazio}</p>
  const r = 15.915, c = 2 * Math.PI * r
  let acumulado = 0
  return (
    <figure className="flex items-center gap-5 flex-wrap">
      <svg viewBox="0 0 42 42" width={tamanho} height={tamanho} role="img" aria-label={`${titulo}: ${dados.map((d) => `${d.rotulo} ${d.valor}`).join(', ')}`} className="shrink-0 -rotate-90">
        <circle cx="21" cy="21" r={r} fill="none" stroke="rgb(var(--c-winter))" strokeWidth="5" />
        {dados.filter((d) => d.valor > 0).map((d) => {
          const frac = d.valor / total
          const el = <circle key={d.rotulo} cx="21" cy="21" r={r} fill="none" stroke={d.cor} strokeWidth="5" strokeDasharray={`${frac * c} ${c - frac * c}`} strokeDashoffset={-acumulado * c}><title>{`${d.rotulo}: ${d.valor}`}</title></circle>
          acumulado += frac
          return el
        })}
        <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className="rotate-90 origin-center fill-ink" style={{ fontSize: 7, fontWeight: 800 }}>{centro ?? total}</text>
      </svg>
      <ul className="space-y-1.5 min-w-[140px] flex-1">
        {dados.map((d) => (
          <li key={d.rotulo} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: d.cor }} aria-hidden />
            <span className="text-ink-2 flex-1 truncate">{d.rotulo}</span>
            <span className="font-bold text-ink tabular-nums">{Math.round((d.valor / total) * 100)}%</span>
            <span className="text-muted tabular-nums w-7 text-right">({d.valor})</span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{titulo}</figcaption>
    </figure>
  )
}

/** Indicador radial 0–100. */
export function RadialGauge({ valor, rotulo, cor = 'rgb(var(--c-brand))', tamanho = 120 }: { valor: number | null; rotulo: string; cor?: string; tamanho?: number }) {
  const v = valor == null ? 0 : Math.max(0, Math.min(100, valor))
  const r = 15.915, c = 2 * Math.PI * r
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 42 42" width={tamanho} height={tamanho} role="img" aria-label={`${rotulo}: ${valor ?? 'sem dados'}`} className="-rotate-90">
        <circle cx="21" cy="21" r={r} fill="none" stroke="rgb(var(--c-winter))" strokeWidth="4" />
        <circle cx="21" cy="21" r={r} fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
        <text x="21" y="21" textAnchor="middle" dominantBaseline="central" className="rotate-90 origin-center fill-ink" style={{ fontSize: 9, fontWeight: 800 }}>{valor == null ? '—' : Math.round(v)}</text>
      </svg>
      <figcaption className="text-[12px] text-muted mt-1 text-center">{rotulo}</figcaption>
    </figure>
  )
}

/** Barras horizontais empilhadas por categoria (ex.: DISC). */
export function BarrasDisc({ valores, compacto }: { valores: { rotulo: string; valor: number; cor: string }[]; compacto?: boolean }) {
  return (
    <ul className={cn('space-y-2', compacto && 'space-y-1')}>
      {valores.map((v) => (
        <li key={v.rotulo} className="flex items-center gap-2 text-[12px]">
          <span className={cn('text-ink-2 shrink-0', compacto ? 'w-20' : 'w-24')}>{v.rotulo}</span>
          <span className="flex-1 h-2 rounded-full bg-winter overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${v.valor}%`, background: v.cor }} /></span>
          <span className="w-8 text-right font-bold tabular-nums text-ink">{Math.round(v.valor)}</span>
        </li>
      ))}
    </ul>
  )
}
