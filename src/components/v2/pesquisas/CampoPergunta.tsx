/* Campo de resposta de uma pergunta (usado no respondente e na pré-visualização). Acessível e tocável no celular. */
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'
import { faixaNumerica, ROTULOS_LIKERT, type PerguntaPesquisa, type Valor } from '@/domain/v2/pesquisaTipos'

interface Props { pergunta: PerguntaPesquisa; valor: Valor; onChange: (v: Valor) => void; desabilitado?: boolean }

const botaoNota = (ativo: boolean) => cn(
  'min-h-[44px] min-w-[44px] flex-1 rounded-xl border text-[14px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60',
  ativo ? 'bg-brand text-white border-brand' : 'bg-surface text-ink border-line hover:border-brand/60 hover:bg-brand-50',
)

export function CampoPergunta({ pergunta: p, valor, onChange, desabilitado }: Props) {
  const nome = `q-${p.id}`
  const faixa = faixaNumerica(p)

  if (p.tipo === 'nps' || p.tipo === 'enps' || p.tipo === 'escala') {
    const f = faixa!
    const nums = Array.from({ length: f.max - f.min + 1 }, (_, i) => f.min + i)
    const rMin = p.tipo === 'escala' ? p.escala?.rotuloMin : 'Nada provável'
    const rMax = p.tipo === 'escala' ? p.escala?.rotuloMax : 'Muito provável'
    return (
      <div role="radiogroup" aria-label={p.texto}>
        <div className="flex flex-wrap gap-1.5">
          {nums.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={valor === n} disabled={desabilitado}
              onClick={() => onChange(n)} className={cn(botaoNota(valor === n), 'basis-[calc(16%-6px)] sm:basis-0')}>{n}</button>
          ))}
        </div>
        {(rMin || rMax) && <div className="flex justify-between text-[12px] text-muted mt-2"><span>{rMin}</span><span>{rMax}</span></div>}
      </div>
    )
  }

  if (p.tipo === 'likert') {
    return (
      <div role="radiogroup" aria-label={p.texto} className="grid gap-2 sm:grid-cols-5">
        {ROTULOS_LIKERT.map((r, i) => (
          <button key={r} type="button" role="radio" aria-checked={valor === i + 1} disabled={desabilitado} onClick={() => onChange(i + 1)}
            className={cn(botaoNota(valor === i + 1), 'flex sm:flex-col items-center justify-start sm:justify-center gap-2 px-3 py-2.5 text-left sm:text-center text-[13px] leading-tight')}>
            <span className={cn('h-6 w-6 rounded-full flex items-center justify-center text-[12px] shrink-0', valor === i + 1 ? 'bg-white/25' : 'bg-winter text-muted')}>{i + 1}</span>
            <span>{r}</span>
          </button>
        ))}
      </div>
    )
  }

  if (p.tipo === 'estrelas') {
    return (
      <div role="radiogroup" aria-label={p.texto} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const ativo = typeof valor === 'number' && n <= valor
          return (
            <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} disabled={desabilitado} onClick={() => onChange(n)}
              className="h-12 w-12 rounded-xl flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand hover:bg-brand-50">
              <Icon name="Star" className={cn('h-8 w-8', ativo ? 'text-gold fill-current' : 'text-platinum')} />
            </button>
          )
        })}
      </div>
    )
  }

  if (p.tipo === 'sim_nao') {
    return (
      <div role="radiogroup" aria-label={p.texto} className="grid grid-cols-2 gap-3 max-w-sm">
        {[['sim', 'Sim'], ['nao', 'Não']].map(([v, r]) => (
          <button key={v} type="button" role="radio" aria-checked={valor === v} disabled={desabilitado} onClick={() => onChange(v)} className={cn(botaoNota(valor === v), 'py-3')}>{r}</button>
        ))}
      </div>
    )
  }

  if (p.tipo === 'unica') {
    return (
      <div role="radiogroup" aria-label={p.texto} className="space-y-2">
        {(p.opcoes ?? []).map((o) => (
          <label key={o} className={cn('flex items-center gap-3 rounded-xl border px-4 min-h-[48px] py-2 cursor-pointer text-[14px] transition focus-within:ring-2 focus-within:ring-brand', valor === o ? 'border-brand bg-brand-50 text-ink' : 'border-line bg-surface hover:border-brand/50')}>
            <input type="radio" name={nome} checked={valor === o} disabled={desabilitado} onChange={() => onChange(o)} className="h-4 w-4 accent-[rgb(var(--c-brand))]" />
            <span>{o}</span>
          </label>
        ))}
      </div>
    )
  }

  if (p.tipo === 'multipla') {
    const sel = Array.isArray(valor) ? valor : []
    return (
      <div role="group" aria-label={p.texto} className="space-y-2">
        {(p.opcoes ?? []).map((o) => {
          const marcado = sel.includes(o)
          return (
            <label key={o} className={cn('flex items-center gap-3 rounded-xl border px-4 min-h-[48px] py-2 cursor-pointer text-[14px] transition focus-within:ring-2 focus-within:ring-brand', marcado ? 'border-brand bg-brand-50' : 'border-line bg-surface hover:border-brand/50')}>
              <input type="checkbox" checked={marcado} disabled={desabilitado} onChange={() => onChange(marcado ? sel.filter((x) => x !== o) : [...sel, o])} className="h-4 w-4 accent-[rgb(var(--c-brand))]" />
              <span>{o}</span>
            </label>
          )
        })}
        <p className="text-[12px] text-muted">Você pode marcar mais de uma.</p>
      </div>
    )
  }

  if (p.tipo === 'ordenacao') {
    const ordem = Array.isArray(valor) && valor.length === (p.opcoes ?? []).length ? valor : null
    const lista = ordem ?? p.opcoes ?? []
    const mover = (i: number, d: number) => {
      const nova = [...lista]; const j = i + d
      if (j < 0 || j >= nova.length) return
      ;[nova[i], nova[j]] = [nova[j], nova[i]]
      onChange(nova)
    }
    return (
      <div>
        <ol className="space-y-2" aria-label={p.texto}>
          {lista.map((o, i) => (
            <li key={o} className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 min-h-[48px] text-[14px]">
              <span className="h-6 w-6 rounded-full bg-winter text-muted text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="flex-1">{o}</span>
              <button type="button" aria-label={`Subir ${o}`} disabled={desabilitado || i === 0} onClick={() => mover(i, -1)} className="h-9 w-9 rounded-lg hover:bg-winter disabled:opacity-30 flex items-center justify-center"><Icon name="ChevronUp" className="h-4 w-4" /></button>
              <button type="button" aria-label={`Descer ${o}`} disabled={desabilitado || i === lista.length - 1} onClick={() => mover(i, 1)} className="h-9 w-9 rounded-lg hover:bg-winter disabled:opacity-30 flex items-center justify-center"><Icon name="ChevronDown" className="h-4 w-4" /></button>
            </li>
          ))}
        </ol>
        {!ordem && <button type="button" className="text-[12.5px] text-brand font-semibold mt-2" onClick={() => onChange([...lista])}>Confirmar esta ordem</button>}
      </div>
    )
  }

  if (p.tipo === 'data') {
    return <input type="date" aria-label={p.texto} className="input max-w-[220px]" disabled={desabilitado} value={typeof valor === 'string' ? valor : ''} onChange={(e) => onChange(e.target.value)} />
  }

  if (p.tipo === 'texto_curto') {
    return <input type="text" aria-label={p.texto} className="input" maxLength={200} disabled={desabilitado} value={typeof valor === 'string' ? valor : ''} onChange={(e) => onChange(e.target.value)} />
  }

  // texto_longo
  const txt = typeof valor === 'string' ? valor : ''
  return (
    <div>
      <textarea aria-label={p.texto} className="input min-h-[120px] py-3" maxLength={4000} disabled={desabilitado} value={txt} onChange={(e) => onChange(e.target.value)} />
      <div className="text-right text-[11.5px] text-muted mt-1">{txt.length}/4000</div>
    </div>
  )
}
