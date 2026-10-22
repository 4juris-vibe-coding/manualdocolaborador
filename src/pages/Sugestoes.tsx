import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import type { CategoriaSugestao, StatusSugestao, Sugestao } from '@/lib/types'
import { PageHeader, Card, Badge, Button, Icon, Field, Callout, EmptyState, Select, SearchBox } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { SugestaoForm, CATEGORIAS_SUG } from '@/components/SugestaoForm'
import { cn, fmtDate } from '@/lib/utils'
import { Dropdown } from '@/components/Dropdown'

const COLUNAS: { key: StatusSugestao; titulo: string; icon: string; cor: string; vazio: string }[] = [
  { key: 'aguardando', titulo: 'Aguardando análise', icon: 'Hourglass', cor: 'text-warning', vazio: 'Nenhuma sugestão aguardando.' },
  { key: 'aprovada', titulo: 'Aprovadas', icon: 'CheckCircle2', cor: 'text-success', vazio: 'Ainda não há sugestões aprovadas.' },
  { key: 'recusada', titulo: 'Recusadas', icon: 'XCircle', cor: 'text-danger', vazio: 'Nenhuma sugestão recusada.' },
]

export default function Sugestoes() {
  const s = useStore()
  const moderador = s.pode('sugestoes:moderar')
  const [nova, setNova] = useState(false)
  const [editar, setEditar] = useState<Sugestao | null>(null)
  const [excluir, setExcluir] = useState<Sugestao | null>(null)
  const [recusa, setRecusa] = useState<{ s: Sugestao; texto: string } | null>(null)
  const [aprovacao, setAprovacao] = useState<{ s: Sugestao; texto: string } | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [soMinhas, setSoMinhas] = useState(false)
  const [ordem, setOrdem] = useState<'apoios' | 'recentes'>('apoios')
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<StatusSugestao | null>(null)

  const lista = useMemo(() => s.sugestoes
    .filter((x) => !cat || x.categoria === cat)
    .filter((x) => !q.trim() || `${x.titulo} ${x.descricao}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((x) => !soMinhas || s.sugestaoEhMinha(x.id))
    .sort((a, b) => (ordem === 'apoios' ? b.apoios.length - a.apoios.length : 0) || b.criadaEm.localeCompare(a.criadaEm)), [s, cat, q, soMinhas, ordem])

  const mover = (x: Sugestao, destino: StatusSugestao) => {
    if (x.status === destino) return
    if (destino === 'recusada') { setRecusa({ s: x, texto: x.resposta ?? '' }); return }
    if (destino === 'aprovada') { setAprovacao({ s: x, texto: x.resposta ?? '' }); return }
    feedback(s.moderarSugestao(x.id, destino), 'Sugestão devolvida para análise.')
  }
  const soltar = (destino: StatusSugestao) => {
    const x = s.sugestoes.find((y) => y.id === arrastando)
    setSobre(null); setArrastando(null)
    if (x && moderador) mover(x, destino)
  }
  const contagem = (st: StatusSugestao) => s.sugestoes.filter((x) => x.status === st).length

  return (
    <>
      <PageHeader title="Caixa de sugestões" subtitle="Ideias da comunidade, abertas a todos e enviadas de forma anônima. Acompanhe o que está em análise, foi aprovado ou recusado."
        actions={<Button icon="Lightbulb" onClick={() => setNova(true)}>Enviar sugestão</Button>} />

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        {COLUNAS.map((c) => <Card key={c.key} className="p-3 sm:p-4 flex items-center gap-3"><Icon name={c.icon} className={cn('h-5 w-5 hidden sm:block', c.cor)} /><div><div className="text-[22px] font-extrabold text-ink leading-none tabular-nums">{contagem(c.key)}</div><div className="text-[11.5px] sm:text-[12.5px] text-muted mt-1">{c.titulo}</div></div></Card>)}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Buscar nas sugestões" label="Buscar sugestões" />
        <Select label="Categoria" value={cat} onChange={setCat}><option value="">Todas as categorias</option>{CATEGORIAS_SUG.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select label="Ordenar" value={ordem} onChange={(v) => setOrdem(v as 'apoios' | 'recentes')}><option value="apoios">Mais apoiadas</option><option value="recentes">Mais recentes</option></Select>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-2 cursor-pointer select-none"><input type="checkbox" className="h-4 w-4 accent-brand" checked={soMinhas} onChange={(e) => setSoMinhas(e.target.checked)} />Só as minhas</label>
        {moderador && <span className="text-[12px] text-muted ml-auto flex items-center gap-1.5"><Icon name="MousePointerClick" className="h-4 w-4 text-brand" /><span className="toque:hidden">Como moderador(a), arraste os cartões entre as colunas.</span><span className="hidden toque:inline">Como moderador(a), mude a coluna pelo seletor de cada cartão.</span></span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {COLUNAS.map((col) => {
          const cards = lista.filter((x) => x.status === col.key)
          return (
            <section key={col.key} aria-label={col.titulo}
              onDragOver={(e) => { if (moderador) { e.preventDefault(); setSobre(col.key) } }}
              onDragLeave={() => setSobre((c) => (c === col.key ? null : c))}
              onDrop={() => soltar(col.key)}
              className={cn('rounded-2xl border bg-surface-2 min-h-[220px] transition', sobre === col.key ? 'border-brand bg-brand-50' : 'border-line')}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <Icon name={col.icon} className={cn('h-[17px] w-[17px]', col.cor)} />
                <h2 className="text-[13px] font-bold text-ink">{col.titulo}</h2>
                <span className="ml-auto text-[11.5px] font-bold text-muted bg-winter rounded-full px-2 py-0.5">{cards.length}</span>
              </div>
              <div className="p-3 space-y-3">
                {cards.length === 0 && <p className="text-[12px] text-muted text-center py-8 px-2">{col.vazio}</p>}
                {cards.map((x) => {
                  const minha = s.sugestaoEhMinha(x.id)
                  const apoiei = x.apoios.includes(s.minhaChaveApoio(x.id))
                  return (
                    <article key={x.id} draggable={moderador} onDragStart={() => setArrastando(x.id)} onDragEnd={() => { setArrastando(null); setSobre(null) }}
                      className={cn('rounded-xl border bg-surface p-3.5 shadow-xs transition', minha ? 'border-brand/50' : 'border-line', moderador && 'cursor-grab active:cursor-grabbing', arrastando === x.id && 'opacity-40')}>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <Badge tone="neutral">{x.categoria}</Badge>
                        {minha && <Badge tone="brand"><Icon name="User" className="h-3 w-3" />Sua</Badge>}
                      </div>
                      <h3 className="text-[13.5px] font-bold text-ink leading-snug">{x.titulo}</h3>
                      <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{x.descricao}</p>
                      {x.resposta && (
                        <div className={cn('mt-2.5 rounded-lg px-3 py-2 text-[12px] leading-relaxed border', x.status === 'aprovada' ? 'bg-success-soft border-success-line text-success-ink' : 'bg-danger-soft border-danger-line text-danger-ink')}>
                          <b>Resposta da equipe:</b> {x.resposta}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3 text-[11.5px] text-muted flex-wrap">
                        <button type="button" onClick={() => feedback(s.apoiarSugestao(x.id), apoiei ? 'Apoio removido.' : 'Você apoiou esta sugestão.')} disabled={minha} aria-pressed={apoiei}
                          title={minha ? 'Você não pode apoiar a própria sugestão' : apoiei ? 'Remover apoio' : 'Apoiar'}
                          className={cn('inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed', apoiei ? 'bg-brand text-white border-brand' : 'border-line text-ink-2 hover:border-brand')}>
                          <Icon name="ThumbsUp" className="h-3.5 w-3.5" />{x.apoios.length}<span className="sr-only"> apoio(s)</span>
                        </button>
                        <span>{fmtDate(x.criadaEm, { day: '2-digit', month: 'short' })}{x.editadaEm ? ' · editada' : ''}</span>
                        <div className="ml-auto flex gap-1">
                          {minha && x.status === 'aguardando' && <>
                            <Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar sugestão" onClick={() => setEditar(x)} />
                            <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Excluir sugestão" onClick={() => setExcluir(x)} />
                          </>}
                          {moderador && (
                            <Dropdown aria-label={`Mover "${x.titulo}"`} className="h-8 rounded-lg border border-line bg-surface text-[11.5px] font-semibold px-1.5" value={x.status} onChange={(e) => mover(x, e.target.value as StatusSugestao)}>
                              {COLUNAS.map((c) => <option key={c.key} value={c.key}>{c.titulo}</option>)}
                            </Dropdown>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      {s.sugestoes.length === 0 && <Card className="mt-4"><EmptyState icon="Lightbulb" title="Nenhuma sugestão ainda" desc="Seja a primeira pessoa a contribuir!" action={<Button icon="Lightbulb" onClick={() => setNova(true)}>Enviar sugestão</Button>} /></Card>}
      <p className="text-[11.5px] text-muted mt-5">Sugestões respondidas ficam no histórico para todos acompanharem. A autoria nunca é exibida; apoios também são anônimos.</p>

      {nova && <SugestaoForm onClose={() => setNova(false)} />}
      {editar && <SugestaoForm sugestao={editar} onClose={() => setEditar(null)} />}
      <ConfirmModal open={!!excluir} onClose={() => setExcluir(null)} titulo="Excluir sugestão?" confirmar="Excluir" texto={excluir ? `"${excluir.titulo}" será removida do quadro. Esta ação não pode ser desfeita.` : ''}
        onConfirm={() => { if (excluir && feedback(s.excluirSugestao(excluir.id), 'Sugestão excluída.')) setExcluir(null) }} />
      <Modal open={!!recusa} onClose={() => setRecusa(null)} title="Recusar sugestão" subtitle={recusa?.s.titulo}
        footer={<><Button variant="ghost" onClick={() => setRecusa(null)}>Cancelar</Button><Button variant="danger" icon="XCircle" onClick={() => { if (recusa && feedback(s.moderarSugestao(recusa.s.id, 'recusada', recusa.texto), 'Sugestão recusada com resposta pública.')) setRecusa(null) }}>Recusar</Button></>}>
        <Field label="Motivo (público)" required htmlFor="sg-rz" hint="Todos veem esta resposta. Seja claro e respeitoso — a pessoa não será identificada."><textarea id="sg-rz" className="input !h-auto py-2.5" rows={4} maxLength={500} value={recusa?.texto ?? ''} onChange={(e) => recusa && setRecusa({ ...recusa, texto: e.target.value })} /></Field>
      </Modal>
      <Modal open={!!aprovacao} onClose={() => setAprovacao(null)} title="Aprovar sugestão" subtitle={aprovacao?.s.titulo}
        footer={<><Button variant="ghost" onClick={() => setAprovacao(null)}>Cancelar</Button><Button icon="CheckCircle2" onClick={() => { if (aprovacao && feedback(s.moderarSugestao(aprovacao.s.id, 'aprovada', aprovacao.texto || undefined), 'Sugestão aprovada.')) setAprovacao(null) }}>Aprovar</Button></>}>
        <Field label="Próximos passos (opcional, público)" htmlFor="sg-ap"><textarea id="sg-ap" className="input !h-auto py-2.5" rows={3} maxLength={500} value={aprovacao?.texto ?? ''} onChange={(e) => aprovacao && setAprovacao({ ...aprovacao, texto: e.target.value })} placeholder="Ex.: Vamos implementar no próximo trimestre." /></Field>
      </Modal>
    </>
  )
}
