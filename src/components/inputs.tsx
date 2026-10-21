/* Controles de formulário reutilizáveis. */
import { useMemo, useState, type ReactNode } from 'react'
import { Icon, Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Colaborador } from '@/lib/types'

/** Lista de etiquetas (Enter ou vírgula adiciona). */
export function TagInput({ valor, onChange, placeholder = 'Digite e pressione Enter', label }: { valor: string[]; onChange: (v: string[]) => void; placeholder?: string; label: string }) {
  const [t, setT] = useState('')
  const add = () => { const x = t.trim().replace(/,$/, ''); if (x && !valor.includes(x)) onChange([...valor, x]); setT('') }
  return (
    <div className="input !h-auto min-h-[44px] flex flex-wrap items-center gap-1.5 py-1.5">
      {valor.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 rounded-lg pl-2 pr-1 py-0.5 text-[12px] font-semibold">
          {v}<button type="button" aria-label={`Remover ${v}`} onClick={() => onChange(valor.filter((x) => x !== v))} className="h-5 w-5 rounded hover:bg-brand-100 flex items-center justify-center"><Icon name="X" className="h-3 w-3" /></button>
        </span>
      ))}
      <input aria-label={label} className="flex-1 min-w-[120px] bg-transparent outline-none text-[13.5px] h-8" value={t} placeholder={valor.length ? '' : placeholder}
        onChange={(e) => setT(e.target.value)} onBlur={add}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } if (e.key === 'Backspace' && !t && valor.length) onChange(valor.slice(0, -1)) }} />
    </div>
  )
}

/** Slider 0–100 com rótulos opostos nas pontas (traços comportamentais / DISC). */
export function SliderBipolar({ esquerda, direita, valor, onChange, cor, disabled }: { esquerda: string; direita?: string; valor: number; onChange?: (v: number) => void; cor?: string; disabled?: boolean }) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between gap-3 text-[11.5px] mb-1">
        <span className={cn('font-semibold', valor < 50 ? 'text-ink' : 'text-muted')}>{esquerda}</span>
        {direita && <span className={cn('font-semibold text-right', valor > 50 ? 'text-ink' : 'text-muted')}>{direita}</span>}
      </div>
      <input type="range" min={0} max={100} step={5} value={valor} disabled={disabled} aria-label={direita ? `${esquerda} ↔ ${direita}` : esquerda}
        onChange={(e) => onChange?.(Number(e.target.value))} className="w-full accent-brand disabled:opacity-70" style={cor ? { accentColor: cor } : undefined} />
    </div>
  )
}

/** Escala de notas (estrelas numeradas) com rótulos. */
export function EscalaNotas({ niveis, rotulos, valor, onChange, nome }: { niveis: number; rotulos: string[]; valor?: number; onChange: (v: number) => void; nome: string }) {
  return (
    <div role="radiogroup" aria-label={nome} className="flex flex-wrap gap-1.5">
      {Array.from({ length: niveis }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} onClick={() => onChange(n)} title={rotulos[n - 1]}
          className={cn('h-10 px-3 rounded-xl border text-[12.5px] font-semibold transition flex items-center gap-1.5',
            valor === n ? 'bg-brand text-white border-brand' : valor && n < valor ? 'border-brand/40 bg-brand-50 text-brand' : 'border-line text-ink-2 hover:border-brand')}>
          <Icon name="Star" className="h-3.5 w-3.5" />{n}<span className="hidden sm:inline font-medium">· {rotulos[n - 1]}</span>
        </button>
      ))}
    </div>
  )
}

/** Seleção múltipla de pessoas com busca. */
export function SeletorPessoas({ pessoas, selecionadas, onChange, altura = 'max-h-64', extra }: { pessoas: Colaborador[]; selecionadas: string[]; onChange: (ids: string[]) => void; altura?: string; extra?: (c: Colaborador) => ReactNode }) {
  const [q, setQ] = useState('')
  const lista = useMemo(() => pessoas.filter((c) => !q.trim() || c.nome.toLowerCase().includes(q.trim().toLowerCase())), [pessoas, q])
  const todos = lista.length > 0 && lista.every((c) => selecionadas.includes(c.id))
  return (
    <div className="rounded-xl border border-line">
      <div className="flex items-center gap-2 p-2 border-b border-line">
        <input aria-label="Filtrar pessoas" className="input !h-9 flex-1" placeholder="Filtrar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="text-[12px] font-semibold text-brand px-2 whitespace-nowrap" onClick={() => onChange(todos ? selecionadas.filter((id) => !lista.some((c) => c.id === id)) : [...new Set([...selecionadas, ...lista.map((c) => c.id)])])}>{todos ? 'Desmarcar' : 'Marcar'} {q ? 'filtradas' : 'todas'}</button>
      </div>
      <div className={cn('overflow-y-auto p-1.5 space-y-0.5', altura)}>
        {lista.length === 0 && <p className="text-[12.5px] text-muted p-3">Ninguém encontrado.</p>}
        {lista.map((c) => {
          const on = selecionadas.includes(c.id)
          return (
            <label key={c.id} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 cursor-pointer', on ? 'bg-brand-50' : 'hover:bg-surface-2')}>
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={() => onChange(on ? selecionadas.filter((x) => x !== c.id) : [...selecionadas, c.id])} />
              <Avatar nome={c.nome} cor={c.avatarCor} size="sm" className="!h-6 !w-6 !text-[9px]" />
              <span className="text-[13px] text-ink flex-1 truncate">{c.nome}</span>
              {extra?.(c)}
            </label>
          )
        })}
      </div>
      <div className="px-3 py-1.5 border-t border-line text-[11.5px] text-muted">{selecionadas.length} selecionada(s)</div>
    </div>
  )
}

/** Cabeçalho de tabela ordenável. */
export function ThOrdenavel({ children, campo, ordem, onOrdenar, className }: { children: ReactNode; campo: string; ordem: { campo: string; dir: 'asc' | 'desc' }; onOrdenar: (c: string) => void; className?: string }) {
  const ativo = ordem.campo === campo
  return (
    <th className={className} aria-sort={ativo ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onOrdenar(campo)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink">
        {children}<Icon name={ativo ? (ordem.dir === 'asc' ? 'ArrowUp' : 'ArrowDown') : 'ChevronsUpDown'} className="h-3 w-3" />
      </button>
    </th>
  )
}

export function useOrdenacao<T>(itens: T[], acessores: Record<string, (t: T) => string | number>, inicial: string) {
  const [ordem, setOrdem] = useState<{ campo: string; dir: 'asc' | 'desc' }>({ campo: inicial, dir: 'asc' })
  const ordenados = useMemo(() => {
    const f = acessores[ordem.campo]
    if (!f) return itens
    return [...itens].sort((a, b) => {
      const x = f(a), y = f(b)
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR')
      return ordem.dir === 'asc' ? r : -r
    })
  }, [itens, ordem])
  const onOrdenar = (campo: string) => setOrdem((o) => ({ campo, dir: o.campo === campo && o.dir === 'asc' ? 'desc' : 'asc' }))
  return { ordenados, ordem, onOrdenar }
}

/** Imprimir / salvar como PDF (usa o estilo de impressão do app). */
export function BotaoImprimir({ rotulo = 'Imprimir / PDF' }: { rotulo?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="no-print inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-line bg-surface text-ink text-[13.5px] font-semibold hover:bg-surface-2">
      <Icon name="Printer" className="h-[17px] w-[17px]" />{rotulo}
    </button>
  )
}
