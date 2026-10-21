/* People Analytics · peças compartilhadas: cartão de indicador, filtros e drilldown. */
import { useMemo, useState } from 'react'
import { Button, Card, Callout, Icon, Select, Tabela, TD, TH } from '@/components/ui'
import { Drawer } from '@/components/v2/Drawer'
import { Paginacao } from '@/components/v2/Paginacao'
import { Aguardar } from '@/components/v2/estados'
import { qs, useApi } from '@/data/v2/api'
import { dataBR, numero, pct } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import type { Indicador } from '@/domain/v2/analytics'

export interface FiltrosUI { de?: string; ate?: string; setor?: string; unidade?: string; recrutador?: string; gestor?: string }
export const FILTROS_CHAVES = ['de', 'ate', 'setor', 'unidade', 'recrutador', 'gestor'] as const

export function formatarValor(i: Pick<Indicador, 'valor' | 'unidade'>): string {
  if (i.valor === null) return '—'
  if (i.unidade === 'dias') return `${numero(i.valor, 1)} d`
  if (i.unidade === '%') return pct(i.valor, 1)
  if (i.unidade === 'pontos') return numero(i.valor)
  return numero(i.valor)
}

/** Cartão de indicador: definição/fonte/base acessíveis, variação contra o período anterior e clique para ver os registros. */
export function CartaoIndicador({ i, periodoAnterior, onDetalhe }: { i: Indicador; periodoAnterior?: string | null; onDetalhe: (i: Indicador) => void }) {
  const clicavel = !!i.detalhe && i.disponivel
  const v = i.variacao
  return (
    <Card className="p-4 sm:p-5 flex flex-col relative">
      <details className="absolute right-3 top-3">
        <summary className="list-none cursor-pointer h-7 w-7 rounded-lg text-muted hover:bg-winter hover:text-ink flex items-center justify-center [&::-webkit-details-marker]:hidden" aria-label={`Como é calculado: ${i.rotulo}`}>
          <Icon name="Info" className="h-4 w-4" />
        </summary>
        <div className="absolute right-0 top-8 z-20 w-72 rounded-xl bg-midnight text-white p-3 text-[12px] leading-relaxed shadow-lg dark:bg-winter dark:border dark:border-line-strong">
          <p>{i.definicao}</p>
          <p className="mt-2 text-[#aab6c0]"><b className="text-white">Fonte:</b> {i.fonte}</p>
          <p className="text-[#aab6c0]"><b className="text-white">Período:</b> {i.periodo}</p>
          {i.base !== undefined && <p className="text-[#aab6c0]"><b className="text-white">Registros na base:</b> {numero(i.base)}</p>}
        </div>
      </details>
      <button type="button" disabled={!clicavel} onClick={() => onDetalhe(i)}
        className={cn('text-left rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand', clicavel ? 'cursor-pointer group' : 'cursor-default')}
        aria-label={clicavel ? `${i.rotulo}: ${formatarValor(i)}. Ver registros` : undefined}>
        <div className="text-[12.5px] text-ink-2 font-semibold pr-8">{i.rotulo}</div>
        <div className={cn('text-[28px] font-extrabold tracking-tight leading-none mt-2 tabular-nums', i.disponivel ? 'text-ink' : 'text-muted-2')}>{formatarValor(i)}</div>
        {clicavel && <div className="text-[11.5px] text-brand mt-2 font-semibold group-hover:underline">Ver registros →</div>}
      </button>
      {i.disponivel && v && (
        <div className="mt-2 text-[11.5px] text-muted" title={periodoAnterior ? `Período anterior: ${periodoAnterior}` : undefined}>
          <span className="font-bold text-ink-2">{v.sentido === 'subiu' ? '▲' : v.sentido === 'caiu' ? '▼' : '='} {numero(Math.abs(v.absoluta), 1)}{i.unidade === '%' ? ' p.p.' : i.unidade === 'dias' ? ' d' : ''}</span>
          {v.percentual !== null && <> ({numero(v.percentual, 1)}%)</>} vs. período anterior ({numero(i.anterior ?? 0, 1)})
        </div>
      )}
      {i.disponivel && i.variacao === null && i.anterior === null && <div className="mt-2 text-[11.5px] text-muted-2">Sem base no período anterior para comparar.</div>}
      {!i.disponivel && i.dependencia && <div className="mt-2 text-[11.5px] text-muted leading-snug">Indisponível: {i.dependencia}</div>}
    </Card>
  )
}

export function BlocoCard({ titulo, periodo, children, acao, className }: { titulo: string; periodo?: string; children: React.ReactNode; acao?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[14px] font-bold text-ink">{titulo}</h3>
          {periodo && <p className="text-[11.5px] text-muted mt-0.5">Período: {periodo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </Card>
  )
}

export function AvisoFiltros({ aplicados, ignorados }: { aplicados: string[]; ignorados: string[] }) {
  return (
    <div className="text-[12px] text-muted mb-4 space-y-1">
      <p><b className="text-ink-2">Filtros aplicados:</b> {aplicados.join(' · ')}</p>
      {ignorados.length > 0 && <p><b className="text-ink-2">Não se aplicam:</b> {ignorados.join(' · ')}</p>}
    </div>
  )
}

/* ---------- filtros globais ---------- */
const hojeISO = () => new Date().toISOString().slice(0, 10)
function deMesesAtras(n: number) { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth() - (n - 1), 1)).toISOString().slice(0, 10) }
const PRESETS: { chave: string; rotulo: string; de: () => string }[] = [
  { chave: '3m', rotulo: 'Últimos 3 meses', de: () => deMesesAtras(3) },
  { chave: '6m', rotulo: 'Últimos 6 meses', de: () => deMesesAtras(6) },
  { chave: '12m', rotulo: 'Últimos 12 meses', de: () => deMesesAtras(12) },
  { chave: 'ano', rotulo: 'Ano atual', de: () => `${new Date().getFullYear()}-01-01` },
]

export interface OpcoesFiltro { setores: { id: string; nome: string }[]; unidades: { id: string; nome: string }[]; pessoas: { id: string; nome: string }[] }

export function BarraFiltros({ valor, onChange, opcoes }: { valor: FiltrosUI; onChange: (v: FiltrosUI) => void; opcoes: OpcoesFiltro }) {
  // "Personalizado" escolhido explicitamente fica aberto mesmo quando as datas coincidem com um preset.
  const [custom, setCustom] = useState(false)
  const preset = useMemo(() => {
    if (custom) return 'custom'
    if (!valor.de && !valor.ate) return '6m'
    const achou = PRESETS.find((p) => p.de() === valor.de && (!valor.ate || valor.ate === hojeISO()))
    return achou?.chave ?? 'custom'
  }, [valor.de, valor.ate, custom])
  const set = (k: keyof FiltrosUI, v: string) => onChange({ ...valor, [k]: v || undefined })
  const ativos = FILTROS_CHAVES.filter((k) => valor[k] && k !== 'de' && k !== 'ate').length
  return (
    <Card className="p-3 sm:p-4 mb-5">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()} aria-label="Filtros do painel">
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted">Período
          <Select label="Período" value={preset} onChange={(v) => {
            setCustom(v === 'custom')
            if (v === 'custom') return onChange({ ...valor, de: valor.de ?? deMesesAtras(6), ate: valor.ate ?? hojeISO() })
            const p = PRESETS.find((x) => x.chave === v)!
            onChange({ ...valor, de: v === '6m' ? undefined : p.de(), ate: undefined })
          }}>
            {PRESETS.map((p) => <option key={p.chave} value={p.chave}>{p.rotulo}</option>)}
            <option value="custom">Personalizado…</option>
          </Select>
        </label>
        {preset === 'custom' && (
          <>
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted">De
              <input type="date" className="input" value={valor.de ?? ''} max={valor.ate ?? hojeISO()} onChange={(e) => set('de', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted">Até
              <input type="date" className="input" value={valor.ate ?? ''} min={valor.de} max={hojeISO()} onChange={(e) => set('ate', e.target.value)} />
            </label>
          </>
        )}
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted">Área
          <Select label="Área" value={valor.setor ?? ''} onChange={(v) => set('setor', v)}><option value="">Todas</option>{opcoes.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted">Unidade
          <Select label="Unidade" value={valor.unidade ?? ''} onChange={(v) => set('unidade', v)}><option value="">Todas</option>{opcoes.unidades.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted">Recrutador
          <Select label="Recrutador" value={valor.recrutador ?? ''} onChange={(v) => set('recrutador', v)}><option value="">Todos</option>{opcoes.pessoas.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted">Gestor
          <Select label="Gestor" value={valor.gestor ?? ''} onChange={(v) => set('gestor', v)}><option value="">Todos</option>{opcoes.pessoas.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
        </label>
        {(ativos > 0 || preset !== '6m') && <Button variant="subtle" size="sm" icon="X" onClick={() => onChange({})}>Limpar filtros</Button>}
      </form>
    </Card>
  )
}

/* ---------- drilldown ---------- */
interface RespostaDetalhe { titulo: string; nota: string | null; periodo: string; colunas: { chave: string; rotulo: string }[]; itens: Record<string, string | number | null>[]; total: number; pagina: number; por: number }

export function Drilldown({ indicador, rotulo, filtros, onFechar }: { indicador: string | null; rotulo: string; filtros: FiltrosUI; onFechar: () => void }) {
  const [pagina, setPagina] = useState(1)
  const rota = indicador ? `analytics/detalhe${qs({ indicador, ...filtros, pagina, por: 15 })}` : null
  const r = useApi<RespostaDetalhe>(rota)
  return (
    <Drawer open={!!indicador} onClose={() => { setPagina(1); onFechar() }} titulo={rotulo} subtitulo={r.dados ? `Período: ${r.dados.periodo}` : undefined} largura="max-w-3xl">
      <Aguardar r={r} vazio={(d) => (d.total === 0 ? <Callout tone="neutral" icon="Inbox">Nenhum registro compõe este indicador com os filtros atuais.</Callout> : null)}>
        {(d) => (
          <>
            {d.nota && <Callout tone="brand" icon="ShieldCheck" className="mb-4">{d.nota}</Callout>}
            <Card>
              <Tabela minWidth={560}>
                <thead><tr>{d.colunas.map((c) => <th key={c.chave} className={TH}>{c.rotulo}</th>)}</tr></thead>
                <tbody>
                  {d.itens.map((l, i) => (
                    <tr key={i}>{d.colunas.map((c) => {
                      const v = l[c.chave]
                      const txt = v === null || v === undefined || v === '' ? '—' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? dataBR(v) : typeof v === 'number' ? numero(v, Number.isInteger(v) ? 0 : 1) : v
                      return <td key={c.chave} className={TD}>{txt}</td>
                    })}</tr>
                  ))}
                </tbody>
              </Tabela>
              <Paginacao pagina={pagina} por={d.por} total={d.total} onPagina={setPagina} />
            </Card>
          </>
        )}
      </Aguardar>
    </Drawer>
  )
}
