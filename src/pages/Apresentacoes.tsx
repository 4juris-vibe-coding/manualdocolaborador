import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Apresentacao } from '@/lib/types'
import { PageHeader, Card, Badge, Button, Icon, Field, EmptyState, Tabs } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { SlideEscalado } from '@/components/SlideView'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'
import { MODELOS, MODELOS_EDITOR_LIVRE, MODELO_EDITOR_LIVRE, ehEditorLivre, modeloPorId } from '@/domain/apresentacoes'
import { FORMATOS_ARTE, TAMANHO_MAX, TAMANHO_MIN, ehArte, ehEmbutido, modeloIdArte, tamanhoDe } from '@/domain/canva'

type Filtro = 'todos' | 'apresentacao' | 'arte'

/** 4juris Canva: ponto de partida para criar apresentações, posts, stories e artes com a identidade 4JURIS. */
export default function Canva() {
  const s = useStore()
  const navigate = useNavigate()
  const eu = s.realUser().id
  const [tab, setTab] = useState('minhas')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [novaApresentacao, setNovaApresentacao] = useState(false)
  const [novaArte, setNovaArte] = useState<{ w: number; h: number; nome: string } | null>(null)
  const [remover, setRemover] = useState<Apresentacao | null>(null)
  const passa = (a: Apresentacao) => filtro === 'todos' || (filtro === 'arte') === ehArte(a.modeloId)
  const minhas = s.apresentacoes.filter((a) => a.criadaPorId === eu)
  const compartilhadas = s.apresentacoes.filter((a) => a.compartilhada && a.criadaPorId !== eu)
  const lista = (tab === 'minhas' ? minhas : compartilhadas).filter(passa).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))

  return (
    <>
      <PageHeader title="4juris Canva" subtitle="Crie apresentações, posts, stories e artes com a identidade 4JURIS: escolha o tamanho, parta de um modelo e edite direto na tela." />

      <section aria-labelledby="criar-h" className="mb-8">
        <h2 id="criar-h" className="text-[13px] font-bold text-ink mb-3">Criar um design</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          <TileCriar nome="Apresentação" desc="16:9 · slides" w={16} h={9} icone="Presentation" destaque onClick={() => setNovaApresentacao(true)} />
          {FORMATOS_ARTE.filter((f) => f.id !== '16x9').map((f) => <TileCriar key={f.id} nome={f.nome} desc={f.desc} w={f.w} h={f.h} icone={f.icone} onClick={() => setNovaArte({ w: f.w, h: f.h, nome: f.nome })} />)}
          <TileCriar nome="Tamanho personalizado" desc="Defina largura e altura" w={1} h={1} icone="Pencil" tracejado onClick={() => setNovaArte({ w: 1080, h: 1080, nome: 'Personalizado' })} />
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs tabs={[{ key: 'minhas', label: `Meus designs (${minhas.length})` }, { key: 'compartilhadas', label: `Compartilhados (${compartilhadas.length})` }]} active={tab} onChange={setTab} />
        <div className="flex gap-2 mb-6" role="group" aria-label="Filtrar por tipo">
          {([['todos', 'Todos'], ['apresentacao', 'Apresentações'], ['arte', 'Artes']] as const).map(([k, rot]) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={cn('chip', filtro === k && 'chip-active')}>{rot}</button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <Card><EmptyState icon="Presentation" title={tab === 'minhas' ? 'Nenhum design por aqui ainda' : 'Nenhum design compartilhado'} desc={tab === 'minhas' ? 'Escolha um formato acima para começar com um modelo pronto.' : 'Quando alguém compartilhar um design com a comunidade, ele aparece aqui.'} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {lista.map((a) => {
            const m = modeloPorId(a.modeloId)
            const meu = a.criadaPorId === eu
            const embutido = ehEmbutido(a)
            const arte = ehArte(a.modeloId)
            const pronto = ehEditorLivre(a.modeloId) ? MODELOS_EDITOR_LIVRE.find((x) => a.modeloId === `${MODELO_EDITOR_LIVRE}:${x.id}`) : undefined
            const t = arte ? tamanhoDe(a.modeloId) : null
            const n = embutido ? (a.deck as { slides?: unknown[]; pages?: unknown[] } | null | undefined) : null
            const paginas = embutido ? (arte ? n?.pages?.length : n?.slides?.length) ?? 1 : a.slides.length
            const tipo = arte ? `Arte · ${t!.w}×${t!.h}` : embutido ? (pronto?.nome ?? 'Apresentação') : m.nome
            return (
              <Card key={a.id} className="overflow-hidden flex flex-col">
                <Link to={`/canva/${a.id}`} aria-label={`Abrir ${a.titulo}`} className="block p-3 pb-0"><Miniatura a={a} modelo={m} /></Link>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <Badge tone={arte ? 'brand' : 'neutral'}>{tipo}</Badge>
                    {a.compartilhada && <Badge tone="brand"><Icon name="Share2" className="h-3 w-3" />Compartilhado</Badge>}
                  </div>
                  <Link to={`/canva/${a.id}`} className="text-[14.5px] font-bold text-ink hover:text-brand line-clamp-2">{a.titulo}</Link>
                  <p className="text-[12px] text-muted mt-1">{paginas} {arte ? 'página(s)' : 'slide(s)'} · {meu ? 'atualizado' : `por ${s.nomeDe(a.criadaPorId)} ·`} {fmtDate(a.atualizadaEm)}</p>
                  <div className="flex gap-2 mt-auto pt-3">
                    <Button size="sm" icon={meu ? 'Pencil' : 'Eye'} onClick={() => navigate(`/canva/${a.id}`)}>{meu ? 'Editar' : 'Abrir'}</Button>
                    <Button size="icon-sm" variant="ghost" icon="Copy" aria-label="Duplicar" title="Duplicar" onClick={() => { const r = s.duplicarApresentacao(a.id); if (feedback(r, 'Cópia criada.') && r.ok) navigate(`/canva/${r.id}`) }} />
                    {meu && <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Excluir" title="Excluir" onClick={() => setRemover(a)} />}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {novaApresentacao && <NovaModal onClose={() => setNovaApresentacao(false)} onCriada={(id) => navigate(`/canva/${id}`)} />}
      {novaArte && <NovaArteModal inicial={novaArte} onClose={() => setNovaArte(null)} onCriada={(id) => navigate(`/canva/${id}`)} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Excluir design?" confirmar="Excluir" texto={remover ? `"${remover.titulo}" será excluído definitivamente.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerApresentacao(remover.id), 'Design excluído.')) setRemover(null) }} />
    </>
  )
}

/** Cartão de "Criar um design": mostra a proporção do formato. */
function TileCriar({ nome, desc, w, h, icone, onClick, destaque, tracejado }: { nome: string; desc: string; w: number; h: number; icone: string; onClick: () => void; destaque?: boolean; tracejado?: boolean }) {
  const k = 46 / Math.max(w, h)
  return (
    <button type="button" onClick={onClick} className={cn('group text-left rounded-2xl border bg-surface p-3 transition hover:border-brand hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand', tracejado ? 'border-dashed border-line-strong' : 'border-line', destaque && 'ring-1 ring-brand/30')}>
      <div className="h-[60px] flex items-center justify-center rounded-xl bg-surface-3 mb-2.5">
        <span className={cn('flex items-center justify-center rounded-[5px] text-white', tracejado ? 'bg-muted-2' : 'bg-brand')} style={{ width: Math.max(26, w * k), height: Math.max(26, h * k) }}><Icon name={icone} className="h-3.5 w-3.5" /></span>
      </div>
      <div className="text-[12.5px] font-bold text-ink leading-tight">{nome}</div>
      <div className="text-[11px] text-muted mt-0.5 leading-snug">{desc}</div>
    </button>
  )
}

/** Miniatura do design na lista: a capa gerada pelo editor, ou um substituto. */
function Miniatura({ a, modelo }: { a: Apresentacao; modelo: ReturnType<typeof modeloPorId> }) {
  const caixa = 'relative w-full overflow-hidden rounded-xl border border-line bg-surface-3 flex items-center justify-center'
  if (ehEmbutido(a)) {
    return (
      <div className={caixa} style={{ aspectRatio: '16 / 10' }}>
        {a.capa ? <img src={a.capa} alt="" className="max-h-full max-w-full object-contain" /> : <CapaLivre titulo={a.titulo} />}
      </div>
    )
  }
  return <div className={caixa} style={{ aspectRatio: '16 / 10' }}><SlideEscalado slide={a.slides[0]} modelo={modelo} tema={a.tema} borda={false} /></div>
}

/** Nova arte: título + tamanho (formatos prontos ou personalizado). */
function NovaArteModal({ inicial, onClose, onCriada }: { inicial: { w: number; h: number; nome: string }; onClose: () => void; onCriada: (id: string) => void }) {
  const s = useStore()
  const [titulo, setTitulo] = useState('')
  const [w, setW] = useState(inicial.w)
  const [h, setH] = useState(inicial.h)
  const formato = FORMATOS_ARTE.find((f) => f.w === w && f.h === h)
  const valido = [w, h].every((v) => Number.isFinite(v) && v >= TAMANHO_MIN && v <= TAMANHO_MAX)
  const criar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valido) return
    const r = s.criarApresentacao(modeloIdArte(w, h), titulo.trim() || formato?.nome || 'Nova arte')
    if (feedback(r, 'Design criado.') && r.ok) { onClose(); onCriada(r.id!) }
  }
  return (
    <Modal open onClose={onClose} wide title="Nova arte" subtitle="Escolha o tamanho. Na próxima tela você escolhe um modelo e edita livremente."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="ArrowRight" type="submit" form="novaArteForm" disabled={!valido}>Criar e editar</Button></>}>
      <form id="novaArteForm" onSubmit={criar} noValidate>
        <Field label="Título" htmlFor="arte-t"><input id="arte-t" className="input" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Aviso de recesso · dezembro" /></Field>
        <fieldset>
          <legend className="label">Tamanho</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {FORMATOS_ARTE.map((f) => (
              <button key={f.id} type="button" aria-pressed={w === f.w && h === f.h} onClick={() => { setW(f.w); setH(f.h) }} className={cn('flex items-center gap-3 text-left rounded-xl border p-3 transition', w === f.w && h === f.h ? 'border-brand bg-brand-50' : 'border-line hover:border-line-strong')}>
                <span className="h-9 w-9 shrink-0 rounded-lg bg-brand-50 text-brand flex items-center justify-center"><Icon name={f.icone} className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0"><span className="block text-[13px] font-bold text-ink">{f.nome}</span><span className="block text-[11.5px] text-muted">{f.desc}</span></span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4 max-w-sm">
            <Field label="Largura (px)" htmlFor="arte-w"><input id="arte-w" type="number" className="input" min={TAMANHO_MIN} max={TAMANHO_MAX} value={w} onChange={(e) => setW(Math.round(+e.target.value))} /></Field>
            <Field label="Altura (px)" htmlFor="arte-h"><input id="arte-h" type="number" className="input" min={TAMANHO_MIN} max={TAMANHO_MAX} value={h} onChange={(e) => setH(Math.round(+e.target.value))} /></Field>
          </div>
          {!valido && <p role="alert" className="text-[12px] text-danger font-medium">Use valores entre {TAMANHO_MIN} e {TAMANHO_MAX} px.</p>}
          <p className="text-[12px] text-muted mt-1">{formato ? `${formato.nome} · ${formato.desc}` : 'Tamanho personalizado'}. Dá para mudar depois: o conteúdo se reposiciona sozinho.</p>
        </fieldset>
      </form>
    </Modal>
  )
}

function NovaModal({ onClose, onCriada }: { onClose: () => void; onCriada: (id: string) => void }) {
  const s = useStore()
  const [modelo, setModelo] = useState(`${MODELO_EDITOR_LIVRE}:avisos`)
  const [titulo, setTitulo] = useState('')
  const livre = ehEditorLivre(modelo)
  const m = modeloPorId(modelo)
  const criar = (e: React.FormEvent) => { e.preventDefault(); const r = s.criarApresentacao(modelo, titulo); if (feedback(r, 'Apresentação criada.') && r.ok) { onClose(); onCriada(r.id!) } }
  return (
    <Modal open onClose={onClose} wide title="Nova apresentação" subtitle="Escolha um modelo. Todo o layout já vem pronto."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="ArrowRight" type="submit" form="novaApForm">Criar e editar</Button></>}>
      <form id="novaApForm" onSubmit={criar} noValidate>
        <Field label="Título" required htmlFor="ap-t"><input id="ap-t" className="input" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Resultados do 3º trimestre" /></Field>
        <fieldset><legend className="label">Modelo</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-2"><span className="text-[13px] font-bold text-ink">Editor livre · 4JURIS Day</span><Badge tone="brand">Recomendado</Badge></div>
              <p className="text-[12px] text-muted mb-3">Edite direto no slide, com fotos, cores da marca, PDF e imagem (PNG). Escolha um ponto de partida:</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {MODELOS_EDITOR_LIVRE.map((mo) => {
                  const id = `${MODELO_EDITOR_LIVRE}:${mo.id}`
                  return (
                    <button key={mo.id} type="button" aria-pressed={modelo === id} onClick={() => setModelo(id)} className={cn('flex items-center gap-3 text-left rounded-xl border p-3 transition', modelo === id ? 'border-brand bg-brand-50' : 'border-line hover:border-line-strong')}>
                      <span className="h-9 w-9 shrink-0 rounded-lg bg-brand-50 text-brand flex items-center justify-center"><Icon name={mo.icone} className="h-[18px] w-[18px]" /></span>
                      <span className="min-w-0"><span className="block text-[13px] font-bold text-ink">{mo.nome}</span><span className="block text-[11.5px] text-muted leading-snug">{mo.descricao}</span></span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="sm:col-span-2 -mb-1 mt-1 text-[13px] font-bold text-ink">Modelos com campos (formulário)</div>
            {MODELOS.map((mo) => {
              const exemplo = { id: 'x', modeloSlideId: mo.roteiro[0], valores: Object.fromEntries(mo.slides.find((x) => x.id === mo.roteiro[0])!.campos.map((c) => [c.chave, c.padrao])) }
              return (
                <button key={mo.id} type="button" aria-pressed={modelo === mo.id} onClick={() => setModelo(mo.id)} className={cn('text-left rounded-2xl border p-3 transition', modelo === mo.id ? 'border-brand bg-brand-50' : 'border-line hover:border-line-strong')}>
                  <SlideEscalado slide={exemplo} modelo={mo} tema={mo.temaPadrao} />
                  <div className="text-[13.5px] font-bold text-ink mt-2.5">{mo.nome}</div>
                  <div className="text-[12px] text-muted">{mo.descricao}</div>
                </button>
              )
            })}
          </div>
        </fieldset>
        <p className="text-[12px] text-muted mt-3">{livre ? 'Você pode adicionar, remover e reordenar slides depois.' : `Vem com ${m.roteiro.length} slides. Você pode adicionar, remover e reordenar depois.`}</p>
      </form>
    </Modal>
  )
}

/** Miniatura das apresentações do Editor livre (o conteúdo vive no iframe, então a lista mostra uma capa da marca). */
function CapaLivre({ titulo }: { titulo: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-line bg-midnight text-white" style={{ aspectRatio: '16 / 9' }}>
      <svg viewBox="225 217 631 647" aria-hidden className="absolute -right-[6%] -top-[8%] h-[125%] text-white/10 fill-current"><path fillRule="evenodd" d="M482 217H754V609H856V733H754V864H601V733H225V488C365 462 462 350 482 217ZM601 318C555 460 450 565 308 609H601Z" /></svg>
      <div className="absolute inset-0 p-[7%] flex flex-col justify-end"><span className="text-[10px] tracking-[.3em] uppercase text-white/70">4JURIS</span><span className="text-[clamp(14px,2.2vw,22px)] font-extrabold leading-tight line-clamp-2">{titulo}</span></div>
    </div>
  )
}
