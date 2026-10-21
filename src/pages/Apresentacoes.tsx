import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Apresentacao } from '@/lib/types'
import { PageHeader, Card, Badge, Button, Icon, Field, EmptyState, Tabs } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { SlideEscalado } from '@/components/SlideView'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'
import { MODELOS, MODELO_EDITOR_LIVRE, modeloPorId } from '@/domain/apresentacoes'

export default function Apresentacoes() {
  const s = useStore()
  const navigate = useNavigate()
  const eu = s.realUser().id
  const [tab, setTab] = useState('minhas')
  const [novo, setNovo] = useState(false)
  const [remover, setRemover] = useState<Apresentacao | null>(null)
  const minhas = s.apresentacoes.filter((a) => a.criadaPorId === eu)
  const compartilhadas = s.apresentacoes.filter((a) => a.compartilhada && a.criadaPorId !== eu)
  const lista = (tab === 'minhas' ? minhas : compartilhadas).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))

  return (
    <>
      <PageHeader title="Apresentações" subtitle="Monte apresentações a partir de modelos prontos: você só altera as informações e acompanha o resultado ao lado."
        actions={<Button icon="Plus" onClick={() => setNovo(true)}>Nova apresentação</Button>} />
      <Tabs tabs={[{ key: 'minhas', label: `Minhas (${minhas.length})` }, { key: 'compartilhadas', label: `Compartilhadas (${compartilhadas.length})` }]} active={tab} onChange={setTab} />
      {lista.length === 0 ? (
        <Card><EmptyState icon="Presentation" title={tab === 'minhas' ? 'Você ainda não criou apresentações' : 'Nenhuma apresentação compartilhada'} desc={tab === 'minhas' ? 'Escolha um modelo e edite apenas o conteúdo.' : 'Quando alguém compartilhar uma apresentação com a comunidade, ela aparece aqui.'}
          action={tab === 'minhas' ? <Button icon="Plus" onClick={() => setNovo(true)}>Nova apresentação</Button> : undefined} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map((a) => {
            const m = modeloPorId(a.modeloId)
            const meu = a.criadaPorId === eu
            const livre = a.deck !== undefined
            const nSlides = livre ? ((a.deck as { slides?: unknown[] } | null)?.slides?.length ?? '—') : a.slides.length
            return (
              <Card key={a.id} className="overflow-hidden flex flex-col">
                <Link to={`/apresentacoes/${a.id}`} aria-label={`Abrir ${a.titulo}`} className="block p-3 pb-0">
                  {livre ? <CapaLivre titulo={a.titulo} /> : <SlideEscalado slide={a.slides[0]} modelo={m} tema={a.tema} />}
                </Link>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <Badge tone="neutral">{livre ? 'Editor livre' : m.nome}</Badge>
                    {a.compartilhada && <Badge tone="brand"><Icon name="Share2" className="h-3 w-3" />Compartilhada</Badge>}
                  </div>
                  <Link to={`/apresentacoes/${a.id}`} className="text-[14.5px] font-bold text-ink hover:text-brand line-clamp-2">{a.titulo}</Link>
                  <p className="text-[12px] text-muted mt-1">{nSlides} slide(s) · {meu ? 'atualizada' : `por ${s.nomeDe(a.criadaPorId)} ·`} {fmtDate(a.atualizadaEm)}</p>
                  <div className="flex gap-2 mt-auto pt-3">
                    <Button size="sm" icon={meu ? 'Pencil' : 'Eye'} onClick={() => navigate(`/apresentacoes/${a.id}`)}>{meu ? 'Editar' : 'Abrir'}</Button>
                    <Button size="icon-sm" variant="ghost" icon="Copy" aria-label="Duplicar" title="Duplicar" onClick={() => { const r = s.duplicarApresentacao(a.id); if (feedback(r, 'Cópia criada.') && r.ok) navigate(`/apresentacoes/${r.id}`) }} />
                    {meu && <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Excluir" title="Excluir" onClick={() => setRemover(a)} />}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {novo && <NovaModal onClose={() => setNovo(false)} onCriada={(id) => navigate(`/apresentacoes/${id}`)} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Excluir apresentação?" confirmar="Excluir" texto={remover ? `"${remover.titulo}" será excluída definitivamente.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerApresentacao(remover.id), 'Apresentação excluída.')) setRemover(null) }} />
    </>
  )
}

function NovaModal({ onClose, onCriada }: { onClose: () => void; onCriada: (id: string) => void }) {
  const s = useStore()
  const [modelo, setModelo] = useState(MODELO_EDITOR_LIVRE)
  const [titulo, setTitulo] = useState('')
  const livre = modelo === MODELO_EDITOR_LIVRE
  const m = modeloPorId(modelo)
  const criar = (e: React.FormEvent) => { e.preventDefault(); const r = s.criarApresentacao(modelo, titulo); if (feedback(r, 'Apresentação criada.') && r.ok) { onClose(); onCriada(r.id!) } }
  return (
    <Modal open onClose={onClose} wide title="Nova apresentação" subtitle="Escolha um modelo. Todo o layout já vem pronto."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="ArrowRight" type="submit" form="novaApForm">Criar e editar</Button></>}>
      <form id="novaApForm" onSubmit={criar} noValidate>
        <Field label="Título" required htmlFor="ap-t"><input id="ap-t" className="input" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Resultados do 3º trimestre" /></Field>
        <fieldset><legend className="label">Modelo</legend>
          <div className="grid sm:grid-cols-2 gap-3">
            <button type="button" aria-pressed={livre} onClick={() => setModelo(MODELO_EDITOR_LIVRE)} className={cn('text-left rounded-2xl border p-3 transition sm:col-span-2', livre ? 'border-brand bg-brand-50' : 'border-line hover:border-line-strong')}>
              <div className="grid sm:grid-cols-[220px_1fr] gap-4 items-center">
                <CapaLivre titulo="4juris Day" />
                <div>
                  <div className="flex items-center gap-2"><span className="text-[13.5px] font-bold text-ink">Editor livre · 4JURIS Day</span><Badge tone="brand">Recomendado</Badge></div>
                  <div className="text-[12px] text-muted mt-1">Edite direto no slide, com 10 layouts da marca (capa, pessoas, programação, números…), fotos, cores e PDF. Já vem com o roteiro do 4JURIS Day.</div>
                </div>
              </div>
            </button>
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
