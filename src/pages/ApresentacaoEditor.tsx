import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { SlideInstancia, TemaApresentacao } from '@/lib/types'
import { PageHeader, Card, Button, Icon, Field, Badge, Toggle, Callout, EmptyState } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { SlideEscalado, Apresentar } from '@/components/SlideView'
import { ImpressaoApresentacao } from '@/components/ImpressaoApresentacao'
import { feedback, toast } from '@/components/toast'
import { cn, uid } from '@/lib/utils'
import { EditorLivreApresentacao } from '@/components/EditorLivreApresentacao'
import { ehArte, tamanhoDe } from '@/domain/canva'
import { CORES_TEMA, modeloPorId, novoSlide, revisar, slideDoModelo, itensDe } from '@/domain/apresentacoes'

export default function ApresentacaoEditor() {
  const { id = '' } = useParams()
  const deck = useStore((s) => s.apresentacoes.find((x) => x.id === id)?.deck)
  return deck !== undefined ? <EditorLivre id={id} /> : <EditorModelo />
}

/* Editor livre (HTML embutido): título, compartilhamento e duplicar ficam aqui; o conteúdo é editado no iframe. */
function EditorLivre({ id }: { id: string }) {
  const s = useStore()
  const navigate = useNavigate()
  const a = s.apresentacoes.find((x) => x.id === id)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  if (!a) return <Card><EmptyState icon="Presentation" title="Apresentação não encontrada" action={<Link to="/canva" className="text-brand font-semibold">Voltar para o 4juris Canva</Link>} /></Card>
  const meu = a.criadaPorId === s.realUser().id
  return (
    <>
      <Link to="/canva" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink mb-3"><Icon name="ArrowLeft" className="h-4 w-4" />4juris Canva</Link>
      <PageHeader title={a.titulo} subtitle={`${ehArte(a.modeloId) ? `Arte · ${tamanhoDe(a.modeloId).w}×${tamanhoDe(a.modeloId).h} px` : 'Apresentação'}${meu ? '' : ` · por ${s.nomeDe(a.criadaPorId)} (somente leitura)`}`}
        eyebrow={meu ? (salvoEm ? <Badge tone="success" dot>Salvo às {salvoEm}</Badge> : <Badge tone="neutral">Edições são salvas automaticamente</Badge>) : <Badge tone="brand">Compartilhada</Badge>}
        actions={meu
          ? <Toggle checked={a.compartilhada} onChange={(v) => feedback(s.salvarApresentacao(a.id, { compartilhada: v }), v ? 'Compartilhada com a comunidade.' : 'Agora só você vê.')} label={a.compartilhada ? 'Compartilhada com toda a comunidade' : 'Só você vê esta apresentação'} />
          : <Button variant="ghost" icon="Copy" onClick={() => { const r = s.duplicarApresentacao(a.id); if (feedback(r, 'Cópia criada em "Minhas".') && r.ok) navigate(`/canva/${r.id}`) }}>Duplicar para editar</Button>} />
      <EditorLivreApresentacao a={a} somenteLeitura={!meu} onSalvo={() => setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))} />
    </>
  )
}

function EditorModelo() {
  const { id = '' } = useParams()
  const s = useStore()
  const a = s.apresentacoes.find((x) => x.id === id)
  const eu = s.realUser().id
  const [sel, setSel] = useState(0)
  const [apresentando, setApresentando] = useState(false)
  const [imprimindo, setImprimindo] = useState(false)
  const [remover, setRemover] = useState<number | null>(null)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)

  useEffect(() => { setSel((i) => Math.min(i, Math.max(0, (a?.slides.length ?? 1) - 1))) }, [a?.slides.length])
  const modelo = modeloPorId(a?.modeloId ?? '')
  const problemas = useMemo(() => (a ? revisar(modelo, a) : []), [a, modelo])

  if (!a) return <Card><EmptyState icon="Presentation" title="Apresentação não encontrada" action={<Link to="/canva" className="text-brand font-semibold">Voltar para o 4juris Canva</Link>} /></Card>
  const meu = a.criadaPorId === eu
  const slide = a.slides[sel] ?? a.slides[0]
  const sm = slideDoModelo(modelo, slide.modeloSlideId)

  // Edição ao vivo: cada alteração salva e atualiza o preview na hora.
  const salvar = (patch: Parameters<typeof s.salvarApresentacao>[1]) => {
    const r = s.salvarApresentacao(a.id, patch)
    if (!r.ok) toast(r.erro, 'danger')
    else setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  }
  const setSlides = (slides: SlideInstancia[]) => salvar({ slides })
  const setValor = (chave: string, v: string) => setSlides(a.slides.map((x, i) => (i === sel ? { ...x, valores: { ...x.valores, [chave]: v } } : x)))
  const setTema = (t: Partial<TemaApresentacao>) => salvar({ tema: { ...a.tema, ...t } })
  const mover = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= a.slides.length) return; const c = [...a.slides]; [c[i], c[j]] = [c[j], c[i]]; setSlides(c); setSel(j) }
  const duplicar = (i: number) => { const c = [...a.slides]; c.splice(i + 1, 0, { ...c[i], id: uid('sl'), valores: { ...c[i].valores } }); setSlides(c); setSel(i + 1) }
  const adicionar = (modeloSlideId: string) => { const c = [...a.slides, novoSlide(modelo, modeloSlideId, () => uid('sl'))]; setSlides(c); setSel(c.length - 1) }
  const excluir = (i: number) => { setSlides(a.slides.filter((_, k) => k !== i)); setSel(Math.max(0, i - 1)); setRemover(null) }
  const problemasSlide = problemas.filter((p) => p.slideId === slide.id)

  return (
    <>
      <Link to="/canva" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink mb-3 no-print"><Icon name="ArrowLeft" className="h-4 w-4" />4juris Canva</Link>
      <PageHeader title={a.titulo} subtitle={`${modelo.nome} · ${a.slides.length} slide(s)${meu ? '' : ` · por ${s.nomeDe(a.criadaPorId)} (somente leitura)`}`}
        eyebrow={meu ? (salvoEm ? <Badge tone="success" dot>Salvo às {salvoEm}</Badge> : <Badge tone="neutral">Edições são salvas automaticamente</Badge>) : <Badge tone="brand">Compartilhada</Badge>}
        actions={<>
          {!meu && <Button variant="ghost" icon="Copy" onClick={() => { const r = s.duplicarApresentacao(a.id); feedback(r, 'Cópia criada em "Minhas".') }}>Duplicar para editar</Button>}
          <Button variant="ghost" icon="FileDown" onClick={() => setImprimindo(true)}>Exportar PDF</Button>
          <Button icon="Play" onClick={() => setApresentando(true)}>Apresentar</Button>
        </>} />

      <div className="grid xl:grid-cols-[400px_1fr] gap-6 items-start [&>*]:min-w-0">
        {/* ---------- Edição ---------- */}
        <div className="space-y-5 xl:sticky xl:top-[84px]">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3"><h2 className="text-[13px] font-bold text-ink">Slides</h2>
              {meu && <details className="relative"><summary className="list-none cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-50 text-brand text-[12.5px] font-semibold [&::-webkit-details-marker]:hidden"><Icon name="Plus" className="h-3.5 w-3.5" />Adicionar</summary>
                <div className="absolute right-0 z-20 mt-1.5 w-60 bg-surface border border-line rounded-xl shadow-md p-1.5">
                  {modelo.slides.map((x) => <button key={x.id} type="button" onClick={(e) => { adicionar(x.id); (e.currentTarget.closest('details') as HTMLDetailsElement).open = false }} className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-ink hover:bg-surface-2">{x.nome}</button>)}
                </div></details>}
            </div>
            <ol className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {a.slides.map((x, i) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setSel(i)} aria-current={i === sel} aria-label={`Slide ${i + 1}: ${slideDoModelo(modelo, x.modeloSlideId).nome}`} className={cn('block w-full rounded-lg p-1 transition text-left', i === sel ? 'ring-2 ring-brand bg-brand-50' : 'hover:bg-surface-2')}>
                    <SlideEscalado slide={x} modelo={modelo} tema={a.tema} borda={false} className="rounded-md" />
                    <span className="flex items-center gap-1 text-[11px] text-muted mt-1 px-0.5"><b className="text-ink-2">{i + 1}</b> {slideDoModelo(modelo, x.modeloSlideId).nome}{problemas.some((p) => p.slideId === x.id) && <Icon name="AlertTriangle" className="h-3 w-3 text-warning ml-auto" aria-label="tem avisos" />}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-[13px] font-bold text-ink">Slide {sel + 1} · {sm.nome}</h2>
              {meu && <div className="flex gap-0.5">
                <Button size="icon-sm" variant="subtle" icon="ArrowUp" aria-label="Mover para cima" disabled={sel === 0} onClick={() => mover(sel, -1)} />
                <Button size="icon-sm" variant="subtle" icon="ArrowDown" aria-label="Mover para baixo" disabled={sel === a.slides.length - 1} onClick={() => mover(sel, 1)} />
                <Button size="icon-sm" variant="subtle" icon="Copy" aria-label="Duplicar slide" onClick={() => duplicar(sel)} />
                <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Excluir slide" disabled={a.slides.length <= 1} onClick={() => setRemover(sel)} />
              </div>}
            </div>
            <fieldset disabled={!meu} className="min-w-0 border-0 p-0 m-0">
              {sm.campos.map((c) => {
                const v = slide.valores[c.chave] ?? ''
                const idc = `cmp-${slide.id}-${c.chave}`
                const excede = c.max ? (c.tipo === 'lista' ? itensDe(v).some((i) => i.length > c.max!) : v.length > c.max) : false
                return (
                  <Field key={c.chave} label={c.rotulo} htmlFor={idc} hint={[c.dica, c.max && c.tipo !== 'lista' ? `${v.length}/${c.max}` : ''].filter(Boolean).join(' · ') || undefined} erro={excede ? 'Texto longo: pode não caber no slide.' : undefined}>
                    {c.tipo === 'texto' ? <input id={idc} className="input" value={v} onChange={(e) => setValor(c.chave, e.target.value)} />
                      : <textarea id={idc} className="input !h-auto py-2.5" rows={c.tipo === 'lista' ? 5 : 4} value={v} onChange={(e) => setValor(c.chave, e.target.value)} />}
                  </Field>
                )
              })}
            </fieldset>
            {problemasSlide.length > 0 && <Callout tone="warning" icon="AlertTriangle" className="mt-1 text-[12px]">{problemasSlide.map((p) => `${p.campo}: ${p.mensagem}`).join(' · ')}</Callout>}
          </Card>

          {meu && (
            <Card className="p-4 space-y-4">
              <h2 className="text-[13px] font-bold text-ink">Aparência e compartilhamento</h2>
              <Field label="Título da apresentação" htmlFor="ap-titulo"><input id="ap-titulo" className="input" value={a.titulo} maxLength={80} onChange={(e) => salvar({ titulo: e.target.value })} /></Field>
              <div><span className="label">Tema</span><div className="flex gap-2">{(['escuro', 'claro'] as const).map((vv) => <button key={vv} type="button" aria-pressed={a.tema.variante === vv} onClick={() => setTema({ variante: vv })} className={cn('chip', a.tema.variante === vv && 'chip-active')}>{vv === 'escuro' ? 'Escuro' : 'Claro'}</button>)}</div></div>
              <div><span className="label">Cor de destaque</span><div className="flex flex-wrap gap-2">{CORES_TEMA.map((c) => <button key={c.cor} type="button" aria-label={c.nome} aria-pressed={a.tema.cor === c.cor} title={c.nome} onClick={() => setTema({ cor: c.cor })} className={cn('h-8 w-8 rounded-lg', a.tema.cor === c.cor && 'ring-2 ring-offset-2 ring-ink')} style={{ background: c.cor }} />)}</div></div>
              <Toggle checked={a.tema.mostrarLogo} onChange={(v) => setTema({ mostrarLogo: v })} label="Mostrar logo nos slides" />
              <Toggle checked={a.compartilhada} onChange={(v) => salvar({ compartilhada: v })} label={a.compartilhada ? 'Compartilhada com toda a comunidade' : 'Só você vê esta apresentação'} />
            </Card>
          )}
        </div>

        {/* ---------- Preview ---------- */}
        <div className="space-y-3">
          <Card className="p-3 sm:p-4">
            <SlideEscalado slide={slide} modelo={modelo} tema={a.tema} numero={sel + 1} total={a.slides.length} />
            <div className="flex items-center justify-between mt-3">
              <Button size="sm" variant="ghost" icon="ChevronLeft" disabled={sel === 0} onClick={() => setSel(sel - 1)}>Anterior</Button>
              <span className="text-[12.5px] text-muted tabular-nums">Slide {sel + 1} de {a.slides.length} · preview ao vivo</span>
              <Button size="sm" variant="ghost" disabled={sel === a.slides.length - 1} onClick={() => setSel(sel + 1)}>Próximo<Icon name="ChevronRight" className="h-4 w-4" /></Button>
            </div>
          </Card>
          {problemas.length > 0 && <Callout tone="neutral" icon="ListChecks" className="text-[12.5px]"><b>{problemas.length} ponto(s) para revisar</b> antes de apresentar: campos vazios ou textos longos (marcados com ⚠ nas miniaturas).</Callout>}
        </div>
      </div>

      {apresentando && <Apresentar slides={a.slides} modelo={modelo} tema={a.tema} inicio={sel} onSair={() => setApresentando(false)} />}
      {imprimindo && <ImpressaoApresentacao slides={a.slides} modelo={modelo} tema={a.tema} titulo={a.titulo} onFim={() => setImprimindo(false)} />}
      <ConfirmModal open={remover != null} onClose={() => setRemover(null)} titulo="Excluir slide?" confirmar="Excluir" texto={remover != null ? `O slide ${remover + 1} (${slideDoModelo(modelo, a.slides[remover].modeloSlideId).nome}) será removido.` : ''} onConfirm={() => remover != null && excluir(remover)} />
    </>
  )
}
