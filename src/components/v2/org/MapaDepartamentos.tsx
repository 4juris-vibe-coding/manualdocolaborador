/* Organograma estrutural: departamentos e subdepartamentos com líder, cargos e pessoas. Rola na própria caixa. */
import { useMemo, useState } from 'react'
import { Avatar, Badge, Button, Card, EmptyState, Icon } from '@/components/ui'
import { Drawer } from '@/components/v2/Drawer'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/fmt'
import type { ArvoreDepartamentos, NoDepartamento } from '@/domain/v2/departamentos'
import { calcularLayout, type Medidas, type NoLayout } from './layoutArvore'

const M: Medidas = { largura: 236, altura: 118, espacoH: 22, espacoV: 52 }

export function MapaDepartamentos({ arvore, onEditar }: { arvore: ArvoreDepartamentos; onEditar?: (id: string) => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const [modo, setModo] = useState<'mapa' | 'lista'>(() => (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches ? 'mapa' : 'lista'))
  const porId = useMemo(() => new Map(arvore.nos.map((n) => [n.id, n])), [arvore])
  const layout = useMemo(() => {
    const no = (id: string): NoLayout => ({ chave: id, filhos: (porId.get(id)?.filhos ?? []).map(no) })
    return calcularLayout(arvore.raizes.map(no), M)
  }, [arvore, porId])

  if (!arvore.nos.length) return <Card><EmptyState icon="Building2" title="Nenhum departamento cadastrado" desc="Crie departamentos em RH → Departamentos & unidades." /></Card>
  const d = sel ? porId.get(sel) : undefined

  const lista = (ids: string[]): JSX.Element => (
    <ul className="space-y-1.5" role="group">
      {ids.map((id) => {
        const n = porId.get(id)!
        return (
          <li key={id}>
            <button type="button" onClick={() => setSel(id)} className="w-full text-left rounded-xl border border-line bg-surface px-3 py-2.5 flex items-center gap-3 hover:bg-winter" style={{ borderLeft: `4px solid ${n.cor ?? 'rgb(var(--c-line-strong))'}` }}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-ink truncate">{n.nome}</span>
                <span className="block text-[12px] text-muted truncate">{n.lider ? `Líder: ${n.lider.nome}` : 'Sem líder definido'} · {plural(n.pessoasTotal, 'pessoa', 'pessoas')}</span>
              </span>
            </button>
            {n.filhos.length > 0 && <div className="pl-5 mt-1.5 border-l-2 border-line ml-3">{lista(n.filhos)}</div>}
          </li>
        )
      })}
    </ul>
  )

  return (
    <>
      <div className="flex justify-end mb-3">
        <div role="group" aria-label="Forma de exibição" className="inline-flex rounded-lg border border-line overflow-hidden">
          {(['mapa', 'lista'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={modo === k} onClick={() => setModo(k)} className={`h-9 px-3 text-[12.5px] font-semibold ${modo === k ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:bg-winter'}`}>{k === 'mapa' ? 'Mapa' : 'Lista'}</button>
          ))}
        </div>
      </div>
      {modo === 'lista' ? <Card className="p-4">{lista(arvore.raizes)}</Card> : (
        <div className="rounded-2xl border border-line bg-surface-2 overflow-auto max-h-[70vh] p-6">
          <div style={{ width: layout.largura, height: layout.altura, position: 'relative' }} className="mx-auto">
            <svg width={layout.largura} height={layout.altura} className="absolute inset-0 overflow-visible pointer-events-none" aria-hidden>
              {layout.arestas.map((a) => {
                const meio = a.y1 + (a.y2 - a.y1) / 2
                return <path key={a.de + a.para} d={`M${a.x1},${a.y1} V${meio} H${a.x2} V${a.y2}`} fill="none" stroke="rgb(var(--c-line-strong))" strokeWidth="1.5" />
              })}
            </svg>
            {layout.nos.map((p) => {
              const n = porId.get(p.chave)!
              return (
                <button key={p.chave} type="button" onClick={() => setSel(n.id)} style={{ left: p.x, top: p.y, width: M.largura, height: M.altura, borderTop: `4px solid ${n.cor ?? 'rgb(var(--c-line-strong))'}` }}
                  aria-label={`${n.nome}. ${n.lider ? `Líder: ${n.lider.nome}` : 'Sem líder definido'}. ${plural(n.pessoasTotal, 'pessoa', 'pessoas')}. Abrir detalhes.`}
                  className={cn('absolute text-left rounded-2xl border bg-surface px-3.5 py-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition outline-none focus-visible:ring-2 focus-visible:ring-brand', sel === n.id ? 'border-brand ring-2 ring-brand/30' : 'border-line')}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 h-6 w-6 rounded-lg flex items-center justify-center text-white" style={{ background: n.cor ?? 'rgb(var(--c-line-strong))' }}><Icon name={n.icon ?? 'Building2'} className="h-3.5 w-3.5" /></span>
                    <span className="text-[13.5px] font-bold text-ink truncate">{n.nome}</span>
                  </span>
                  {n.lider ? (
                    <span className="flex items-center gap-2 min-w-0"><Avatar nome={n.lider.nome} cor={n.lider.avatarCor ?? undefined} size="sm" /><span className="min-w-0"><span className="block text-[10.5px] uppercase tracking-wide font-bold text-muted">Líder</span><span className="block text-[12.5px] font-semibold text-ink-2 truncate">{n.lider.nome}</span></span></span>
                  ) : <span className="text-[12px] text-muted italic py-1.5">Sem líder definido</span>}
                  <span className="text-[11.5px] text-muted truncate mt-auto">{plural(n.pessoasTotal, 'pessoa', 'pessoas')} · {plural(n.cargos.length, 'cargo', 'cargos')}{n.filhos.length ? ` · ${plural(n.filhos.length, 'subdepartamento', 'subdepartamentos')}` : ''}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <Drawer open={!!d} onClose={() => setSel(null)} titulo={d?.nome ?? ''} subtitulo={d ? caminho(d, porId) : undefined}
        rodape={d && onEditar ? <Button icon="Pencil" onClick={() => { onEditar(d.id); setSel(null) }}>Editar departamento</Button> : undefined}>
        {d && <Detalhes d={d} porId={porId} onAbrir={setSel} />}
      </Drawer>
    </>
  )
}

function caminho(d: NoDepartamento, porId: Map<string, NoDepartamento>) {
  const out: string[] = []
  let cur = d.paiId ? porId.get(d.paiId) : undefined
  while (cur && out.length < 50) { out.unshift(cur.nome); cur = cur.paiId ? porId.get(cur.paiId) : undefined }
  return out.length ? `Dentro de ${out.join(' › ')}` : 'Departamento de topo'
}

function Detalhes({ d, porId, onAbrir }: { d: NoDepartamento; porId: Map<string, NoDepartamento>; onAbrir: (id: string) => void }) {
  const titulo = 'text-[12px] font-bold uppercase tracking-wide text-muted mb-2'
  return (
    <div className="space-y-6">
      <section>
        <h3 className={titulo}>Liderança</h3>
        {d.lider ? <div className="flex items-center gap-3"><Avatar nome={d.lider.nome} cor={d.lider.avatarCor ?? undefined} size="md" /><div><div className="text-[14px] font-semibold text-ink">{d.lider.nome}</div><div className="text-[12px] text-muted">Líder do departamento · responde por quem não tem gestor imediato definido</div></div></div>
          : <p className="text-[13px] text-muted">Sem líder definido.{d.paiId ? ' As pessoas sem gestor imediato ficam abaixo do líder do departamento pai.' : ''}</p>}
        {d.liderancas.length > 0 && <p className="text-[12.5px] text-ink-2 mt-2">Também coordenam: {d.liderancas.map((l) => l.nome).join(', ')}</p>}
      </section>
      <section>
        <h3 className={titulo}>Cargos ({d.cargos.length})</h3>
        {d.cargos.length === 0 ? <p className="text-[13px] text-muted">Nenhum cargo neste departamento.</p> : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {d.cargos.map((c) => <li key={c.id} className="flex items-center gap-2 px-3 py-2"><span className="flex-1 text-[13px] text-ink">{c.nome}</span>{c.nivel && <Badge tone="neutral">{c.nivel}</Badge>}<span className="text-[12px] text-muted w-20 text-right">{plural(c.pessoas, 'pessoa', 'pessoas')}</span></li>)}
          </ul>
        )}
      </section>
      <section>
        <h3 className={titulo}>Pessoas</h3>
        <p className="text-[13px] text-ink-2">{plural(d.pessoas, 'pessoa ativa', 'pessoas ativas')} lotadas aqui{d.pessoasTotal > d.pessoas ? ` · ${d.pessoasTotal} contando os subdepartamentos` : ''}.</p>
      </section>
      {d.filhos.length > 0 && (
        <section>
          <h3 className={titulo}>Subdepartamentos</h3>
          <ul className="space-y-1.5">{d.filhos.map((id) => { const f = porId.get(id)!; return <li key={id}><button type="button" className="text-[13.5px] font-semibold text-brand hover:underline" onClick={() => onAbrir(id)}>{f.nome}</button><span className="text-[12px] text-muted"> · {f.lider ? f.lider.nome : 'sem líder'}</span></li> })}</ul>
        </section>
      )}
    </div>
  )
}
