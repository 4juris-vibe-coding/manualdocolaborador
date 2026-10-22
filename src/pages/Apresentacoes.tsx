import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Apresentacao } from '@/lib/types'
import { Card, Badge, Button, Icon, Field, EmptyState, Tabs } from '@/components/ui'
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
  const [busca, setBusca] = useState('')
  const [novaApresentacao, setNovaApresentacao] = useState(false)
  const [novaArte, setNovaArte] = useState<{ w: number; h: number; nome: string } | null>(null)
  const [remover, setRemover] = useState<Apresentacao | null>(null)
  const [criando, setCriando] = useState<string | null>(null)
  const termo = busca.trim().toLowerCase()
  const passa = (a: Apresentacao) => (filtro === 'todos' || (filtro === 'arte') === ehArte(a.modeloId)) && (!termo || a.titulo.toLowerCase().includes(termo))
  const minhas = s.apresentacoes.filter((a) => a.criadaPorId === eu)
  const compartilhadas = s.apresentacoes.filter((a) => a.compartilhada && a.criadaPorId !== eu)
  const lista = (tab === 'minhas' ? minhas : compartilhadas).filter(passa).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))

  // Um clique num modelo cria o design (com o nome do modelo como título, editável no editor) e abre o editor em tela cheia.
  const usarModelo = (modeloId: string, nome: string) => {
    if (criando) return
    setCriando(modeloId)
    const r = s.criarApresentacao(modeloId, nome)
    if (feedback(r, 'Design criado. Bom trabalho!') && r.ok) navigate(`/canva/${r.id}`)
    else setCriando(null)
  }

  return (
    <>
      {/* ---------- Topo: o que criar ---------- */}
      <section aria-labelledby="canva-h" className="rounded-3xl bg-midnight text-white p-5 sm:p-8 mb-8 relative overflow-hidden tech-grid dark:border dark:border-line-strong">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl pointer-events-none" aria-hidden />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[.14em] text-brand-300"><Icon name="Sparkles" className="h-3.5 w-3.5" />4juris Canva</div>
            <h1 id="canva-h" className="text-[24px] sm:text-[30px] font-extrabold tracking-tight mt-2 leading-tight">O que vamos criar hoje?</h1>
            <p className="text-[13.5px] text-[#b5c0c9] mt-1.5 max-w-xl">Apresentações, posts, stories e artes com a identidade 4JURIS. Escolha um formato ou um modelo e edite direto na tela.</p>
          </div>
          <label className="relative w-full lg:w-[340px] shrink-0">
            <span className="sr-only">Buscar nos seus designs</span>
            <Icon name="Search" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-white/60 pointer-events-none" />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nos seus designs…"
              className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white/10 border border-white/15 text-[13.5px] text-white placeholder:text-white/50 outline-none focus:border-brand-300 focus:bg-white/15 transition" />
          </label>
        </div>
        <div className="relative mt-6 grid grid-cols-2 min-[520px]:grid-cols-4 xl:grid-cols-8 gap-2.5">
          <TileCriar nome="Apresentação" desc="16:9 · slides" w={16} h={9} icone="Presentation" destaque onClick={() => setNovaApresentacao(true)} />
          {FORMATOS_ARTE.filter((f) => f.id !== '16x9').map((f) => <TileCriar key={f.id} nome={f.nome} desc={f.desc} w={f.w} h={f.h} icone={f.icone} onClick={() => setNovaArte({ w: f.w, h: f.h, nome: f.nome })} />)}
          <TileCriar nome="Tamanho personalizado" desc="Largura e altura" w={1} h={1} icone="Pencil" tracejado onClick={() => setNovaArte({ w: 1080, h: 1080, nome: 'Personalizado' })} />
        </div>
      </section>

      {/* ---------- Modelos prontos: abrem direto no editor ---------- */}
      <section aria-labelledby="modelos-h" className="mb-9">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 id="modelos-h" className="text-[16px] font-bold text-ink">Comece por um modelo</h2>
            <p className="text-[12.5px] text-muted">Um clique cria o design e abre o editor. Tudo pode ser trocado: textos, fotos e cores.</p>
          </div>
        </div>
        <ul className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MODELOS_EDITOR_LIVRE.map((mo) => {
            const id = `${MODELO_EDITOR_LIVRE}:${mo.id}`
            return (
              <li key={mo.id}>
                <CartaoModelo nome={mo.nome} desc={mo.descricao} etiqueta="Editor livre" ocupado={criando === id} desabilitado={!!criando} onUsar={() => usarModelo(id, mo.nome)}>
                  <div className="relative w-full h-full bg-gradient-to-br from-midnight via-midnight-soft to-brand-800 flex items-center justify-center overflow-hidden">
                    <svg viewBox="225 217 631 647" aria-hidden className="absolute -right-[10%] -bottom-[25%] h-[110%] text-white/[.06] fill-current"><path fillRule="evenodd" d="M482 217H754V609H856V733H754V864H601V733H225V488C365 462 462 350 482 217ZM601 318C555 460 450 565 308 609H601Z" /></svg>
                    <span className="h-14 w-14 rounded-2xl bg-white/10 border border-white/15 text-white flex items-center justify-center transition duration-300 group-hover:scale-110"><Icon name={mo.icone} className="h-7 w-7" /></span>
                  </div>
                </CartaoModelo>
              </li>
            )
          })}
          {MODELOS.map((mo) => {
            const exemplo = { id: 'x', modeloSlideId: mo.roteiro[0], valores: Object.fromEntries(mo.slides.find((x) => x.id === mo.roteiro[0])!.campos.map((c) => [c.chave, c.padrao])) }
            return (
              <li key={mo.id}>
                <CartaoModelo nome={mo.nome} desc={mo.descricao} etiqueta={`${mo.roteiro.length} slides`} ocupado={criando === mo.id} desabilitado={!!criando} onUsar={() => usarModelo(mo.id, mo.nome)}>
                  <div className="w-full h-full flex items-center justify-center bg-surface-3 p-2"><SlideEscalado slide={exemplo} modelo={mo} tema={mo.temaPadrao} borda={false} className="rounded-md" /></div>
                </CartaoModelo>
              </li>
            )
          })}
        </ul>
      </section>

      {/* ---------- Designs ---------- */}
      <section aria-labelledby="designs-h">
        <h2 id="designs-h" className="sr-only">Designs</h2>
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 mb-5 border-b border-line">
          <Tabs className="mb-0 border-b-0" tabs={[{ key: 'minhas', label: `Meus designs (${minhas.length})` }, { key: 'compartilhadas', label: `Compartilhados (${compartilhadas.length})` }]} active={tab} onChange={setTab} />
          <div className="flex gap-2 pb-2.5" role="group" aria-label="Filtrar por tipo">
            {([['todos', 'Todos'], ['apresentacao', 'Apresentações'], ['arte', 'Artes']] as const).map(([k, rot]) => (
              <button key={k} type="button" aria-pressed={filtro === k} onClick={() => setFiltro(k)} className={cn('chip', filtro === k && 'chip-active')}>{rot}</button>
            ))}
          </div>
        </div>

        {lista.length === 0 ? (
          <Card><EmptyState icon={termo ? 'SearchX' : 'Presentation'}
            title={termo ? 'Nenhum design com esse nome' : tab === 'minhas' ? 'Nenhum design por aqui ainda' : 'Nenhum design compartilhado'}
            desc={termo ? 'Tente outro termo ou limpe a busca.' : tab === 'minhas' ? 'Escolha um formato ou um modelo acima para começar.' : 'Quando alguém compartilhar um design com a comunidade, ele aparece aqui.'}
            action={termo ? <Button variant="ghost" onClick={() => setBusca('')}>Limpar busca</Button> : undefined} /></Card>
        ) : (
          <ul className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                <li key={a.id}>
                  <Card className="group overflow-hidden flex flex-col h-full transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <Link to={`/canva/${a.id}`} aria-label={`Abrir ${a.titulo}`} className="relative block p-2.5 pb-0 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded-t-2xl">
                      <Miniatura a={a} modelo={m} />
                      <span className="absolute inset-2.5 bottom-0 rounded-xl bg-midnight/0 group-hover:bg-midnight/35 transition flex items-center justify-center" aria-hidden>
                        <span className="opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition bg-white text-midnight text-[12.5px] font-bold rounded-lg px-3 py-1.5 shadow-md">{meu ? 'Editar' : 'Abrir'}</span>
                      </span>
                    </Link>
                    <div className="p-3.5 flex-1 flex flex-col">
                      <Link to={`/canva/${a.id}`} className="text-[14px] font-bold text-ink hover:text-brand line-clamp-1">{a.titulo}</Link>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        <Badge tone={arte ? 'brand' : 'neutral'}>{tipo}</Badge>
                        {a.compartilhada && <Badge tone="brand"><Icon name="Share2" className="h-3 w-3" />Compartilhado</Badge>}
                      </div>
                      <div className="flex items-center gap-1 mt-auto pt-2.5">
                        <p className="text-[11.5px] text-muted flex-1 min-w-0 truncate">{paginas} {arte ? 'página(s)' : 'slide(s)'} · {meu ? '' : `${s.nomeDe(a.criadaPorId)} · `}{fmtDate(a.atualizadaEm)}</p>
                        <Button size="icon-sm" variant="subtle" icon="Copy" aria-label={`Duplicar ${a.titulo}`} title="Duplicar" onClick={() => { const r = s.duplicarApresentacao(a.id); if (feedback(r, 'Cópia criada.') && r.ok) navigate(`/canva/${r.id}`) }} />
                        {meu && <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Excluir ${a.titulo}`} title="Excluir" onClick={() => setRemover(a)} />}
                      </div>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {novaApresentacao && <NovaModal onClose={() => setNovaApresentacao(false)} onCriada={(id) => navigate(`/canva/${id}`)} />}
      {novaArte && <NovaArteModal inicial={novaArte} onClose={() => setNovaArte(null)} onCriada={(id) => navigate(`/canva/${id}`)} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Excluir design?" confirmar="Excluir" texto={remover ? `"${remover.titulo}" será excluído definitivamente.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerApresentacao(remover.id), 'Design excluído.')) setRemover(null) }} />
    </>
  )
}

/** Cartão de modelo pronto: prévia, nome e "Usar modelo" (cria e abre o editor). */
function CartaoModelo({ nome, desc, etiqueta, children, onUsar, ocupado, desabilitado }: { nome: string; desc: string; etiqueta: string; children: React.ReactNode; onUsar: () => void; ocupado: boolean; desabilitado: boolean }) {
  return (
    <button type="button" onClick={onUsar} disabled={desabilitado} aria-label={`Usar o modelo ${nome}`}
      className="group w-full h-full text-left card overflow-hidden flex flex-col transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-brand/50 outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait">
      <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
        {children}
        <span className={cn('absolute inset-0 flex items-center justify-center transition', ocupado ? 'bg-midnight/50' : 'bg-midnight/0 group-hover:bg-midnight/35')} aria-hidden>
          <span className={cn('bg-white text-midnight text-[12.5px] font-bold rounded-lg px-3 py-1.5 shadow-md flex items-center gap-1.5 transition', ocupado ? 'opacity-100' : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0')}>
            <Icon name={ocupado ? 'Loader2' : 'Wand2'} className={cn('h-3.5 w-3.5', ocupado && 'animate-spin')} />{ocupado ? 'Abrindo…' : 'Usar modelo'}
          </span>
        </span>
      </div>
      <div className="p-3.5">
        <div className="flex items-center justify-between gap-2"><span className="text-[13.5px] font-bold text-ink truncate">{nome}</span><span className="text-[10.5px] font-semibold text-muted bg-winter rounded-full px-2 py-0.5 shrink-0">{etiqueta}</span></div>
        <p className="text-[12px] text-muted mt-0.5 line-clamp-2">{desc}</p>
      </div>
    </button>
  )
}

/** Cartão de "Criar um design" (no topo escuro): mostra a proporção do formato. */
function TileCriar({ nome, desc, w, h, icone, onClick, destaque, tracejado }: { nome: string; desc: string; w: number; h: number; icone: string; onClick: () => void; destaque?: boolean; tracejado?: boolean }) {
  const k = 40 / Math.max(w, h)
  return (
    <button type="button" onClick={onClick} className={cn('group text-left rounded-2xl border p-2.5 transition duration-200 hover:-translate-y-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
      tracejado ? 'border-dashed border-white/25 hover:border-white/50' : 'border-white/10 hover:border-white/30', destaque ? 'bg-brand/25 hover:bg-brand/35' : 'bg-white/[.06] hover:bg-white/[.1]')}>
      <div className="h-[52px] flex items-center justify-center rounded-xl bg-white/[.06] mb-2">
        <span className={cn('flex items-center justify-center rounded-[5px] text-white transition duration-300 group-hover:scale-110', tracejado ? 'bg-white/25' : 'bg-brand')} style={{ width: Math.max(24, w * k), height: Math.max(24, h * k) }}><Icon name={icone} className="h-3.5 w-3.5" /></span>
      </div>
      <div className="text-[12px] font-bold text-white leading-tight">{nome}</div>
      <div className="text-[10.5px] text-white/55 mt-0.5 leading-snug">{desc}</div>
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
  return <div className={caixa} style={{ aspectRatio: '16 / 10' }}>{a.slides[0] ? <SlideEscalado slide={a.slides[0]} modelo={modelo} tema={a.tema} borda={false} /> : <CapaLivre titulo={a.titulo} />}</div>
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
