/* 4juris Canva · editor em tela cheia (como um editor de design): barra própria no topo e a área de trabalho ocupando o resto da janela.
   Dois tipos de design abrem aqui com a mesma experiência:
   · Editor livre (apresentações livres e artes): HTML embutido num iframe que ocupa toda a área.
   · Modelos com campos: painel de propriedades à esquerda, slide no palco ao centro e tira de miniaturas embaixo. */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { SlideInstancia, TemaApresentacao } from '@/lib/types'
import { Card, Button, Icon, Field, Toggle, Callout, EmptyState, Logo, Segmentado } from '@/components/ui'
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

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function NaoEncontrada() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-surface-3">
      <Card className="max-w-md w-full"><EmptyState icon="Presentation" title="Design não encontrado" desc="Ele pode ter sido excluído ou não estar compartilhado com você."
        action={<Link to="/canva" className="text-brand font-semibold">Voltar para o 4juris Canva</Link>} /></Card>
    </div>
  )
}

/** Barra superior do editor: voltar, título (editável), estado de salvamento e ações. */
function BarraCanva({ titulo, onTitulo, detalhe, salvoEm, meu, compartilhada, onCompartilhar, acoes }: {
  titulo: string; onTitulo?: (t: string) => void; detalhe: string; salvoEm: string | null; meu: boolean
  compartilhada: boolean; onCompartilhar?: (v: boolean) => void; acoes?: ReactNode
}) {
  return (
    <header className="h-14 shrink-0 bg-midnight text-white flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 border-b border-white/10 animate-entrar-cima">
      <Link to="/canva" title="Voltar para o 4juris Canva" aria-label="Voltar para o 4juris Canva"
        className="h-9 pl-1.5 pr-2.5 rounded-lg flex items-center gap-2 hover:bg-white/10 transition outline-none focus-visible:ring-2 focus-visible:ring-brand-300 shrink-0">
        <Icon name="ChevronLeft" className="h-4 w-4 text-white/70" />
        <Logo size={26} rounded="rounded-md" />
        <span className="hidden md:inline text-[13px] font-bold tracking-tight">Canva</span>
      </Link>
      <span className="h-6 w-px bg-white/15 hidden sm:block" aria-hidden />
      <div className="min-w-0 flex-1 flex items-center gap-2.5">
        {onTitulo ? (
          <input aria-label="Título do design" value={titulo} maxLength={80} onChange={(e) => onTitulo(e.target.value)}
            className="min-w-0 w-full max-w-[360px] bg-transparent rounded-lg px-2 py-1.5 text-[14px] font-bold border border-transparent hover:border-white/20 focus:border-brand-300 focus:bg-white/5 outline-none transition truncate" />
        ) : <h1 className="text-[14px] font-bold truncate px-2">{titulo}</h1>}
        <span className="hidden lg:inline text-[11.5px] text-white/55 whitespace-nowrap">{detalhe}</span>
        <span className={cn('hidden sm:inline-flex items-center gap-1.5 text-[11.5px] whitespace-nowrap rounded-full px-2 py-1', meu ? 'text-white/70' : 'bg-brand/30 text-white')}>
          {meu ? <><Icon name={salvoEm ? 'CheckCircle2' : 'Cloud'} className="h-3.5 w-3.5" />{salvoEm ? `Salvo às ${salvoEm}` : 'Salvamento automático'}</> : 'Somente leitura'}
        </span>
      </div>
      {meu && onCompartilhar && (
        <button type="button" onClick={() => onCompartilhar(!compartilhada)} aria-pressed={compartilhada}
          className={cn('h-9 px-3 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 transition outline-none focus-visible:ring-2 focus-visible:ring-brand-300 shrink-0',
            compartilhada ? 'bg-white/15 hover:bg-white/20' : 'hover:bg-white/10 text-white/80')}
          title={compartilhada ? 'Compartilhado com a comunidade (clique para deixar só com você)' : 'Só você vê (clique para compartilhar com a comunidade)'}>
          <Icon name={compartilhada ? 'Users' : 'Lock'} className="h-4 w-4" /><span className="hidden md:inline">{compartilhada ? 'Compartilhado' : 'Privado'}</span>
        </button>
      )}
      {acoes}
    </header>
  )
}

/* Editor livre (HTML embutido): o iframe ocupa toda a área abaixo da barra. */
function EditorLivre({ id }: { id: string }) {
  const s = useStore()
  const navigate = useNavigate()
  const a = s.apresentacoes.find((x) => x.id === id)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  if (!a) return <NaoEncontrada />
  const meu = a.criadaPorId === s.realUser().id
  const arte = ehArte(a.modeloId)
  return (
    <div className="h-dvh flex flex-col bg-midnight">
      <BarraCanva titulo={a.titulo} meu={meu} salvoEm={salvoEm} compartilhada={a.compartilhada}
        detalhe={arte ? `Arte · ${tamanhoDe(a.modeloId).w}×${tamanhoDe(a.modeloId).h} px` : 'Apresentação'}
        onCompartilhar={(v) => feedback(s.salvarApresentacao(a.id, { compartilhada: v }), v ? 'Compartilhado com a comunidade.' : 'Agora só você vê.')}
        acoes={!meu && <Button size="sm" icon="Copy" onClick={() => { const r = s.duplicarApresentacao(a.id); if (feedback(r, 'Cópia criada em "Meus designs".') && r.ok) navigate(`/canva/${r.id}`) }}>Duplicar para editar</Button>} />
      <EditorLivreApresentacao a={a} preencher somenteLeitura={!meu} onSalvo={() => setSalvoEm(hora())} />
    </div>
  )
}

/* Modelos com campos: painel à esquerda, palco ao centro, tira de slides embaixo. */
function EditorModelo() {
  const { id = '' } = useParams()
  const s = useStore()
  const navigate = useNavigate()
  const a = s.apresentacoes.find((x) => x.id === id)
  const eu = s.realUser().id
  const [sel, setSel] = useState(0)
  const [painel, setPainel] = useState<'conteudo' | 'aparencia'>('conteudo')
  const [apresentando, setApresentando] = useState(false)
  const [imprimindo, setImprimindo] = useState(false)
  const [remover, setRemover] = useState<number | null>(null)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)

  useEffect(() => { setSel((i) => Math.min(i, Math.max(0, (a?.slides.length ?? 1) - 1))) }, [a?.slides.length])
  const modelo = modeloPorId(a?.modeloId ?? '')
  const problemas = useMemo(() => (a ? revisar(modelo, a) : []), [a, modelo])
  // Setas do teclado trocam de slide quando o foco não está num campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (apresentando || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setSel((i) => Math.min(i + 1, (a?.slides.length ?? 1) - 1))
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setSel((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [a?.slides.length, apresentando])

  if (!a) return <NaoEncontrada />
  const meu = a.criadaPorId === eu
  const slide = a.slides[sel] ?? a.slides[0]
  const sm = slideDoModelo(modelo, slide.modeloSlideId)

  // Edição ao vivo: cada alteração salva e atualiza o palco na hora.
  const salvar = (patch: Parameters<typeof s.salvarApresentacao>[1]) => {
    const r = s.salvarApresentacao(a.id, patch)
    if (!r.ok) toast(r.erro, 'danger')
    else setSalvoEm(hora())
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
    <div className="lg:h-dvh min-h-dvh flex flex-col bg-surface-3">
      <BarraCanva titulo={a.titulo} onTitulo={meu ? (t) => salvar({ titulo: t }) : undefined} meu={meu} salvoEm={salvoEm} compartilhada={a.compartilhada}
        detalhe={`${modelo.nome} · ${a.slides.length} slide(s)`}
        onCompartilhar={(v) => salvar({ compartilhada: v })}
        acoes={<>
          {!meu && <Button size="sm" icon="Copy" onClick={() => { const r = s.duplicarApresentacao(a.id); if (feedback(r, 'Cópia criada em "Meus designs".') && r.ok) navigate(`/canva/${r.id}`) }}>Duplicar</Button>}
          <button type="button" onClick={() => setImprimindo(true)} title="Exportar PDF" aria-label="Exportar PDF"
            className="h-9 px-3 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 hover:bg-white/10 text-white/85 transition outline-none focus-visible:ring-2 focus-visible:ring-brand-300 shrink-0">
            <Icon name="FileDown" className="h-4 w-4" /><span className="hidden md:inline">PDF</span>
          </button>
          <Button size="sm" icon="Play" onClick={() => setApresentando(true)} className="shrink-0">Apresentar</Button>
        </>} />

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ---------- Painel de propriedades (rolagem própria: é a área de edição, ao lado do palco fixo) ---------- */}
        <aside aria-label="Propriedades" className="order-2 lg:order-1 lg:w-[360px] shrink-0 bg-surface border-t lg:border-t-0 lg:border-r border-line flex flex-col min-h-0 animate-entrar-esq">
          {meu && (
            <div className="px-4 pt-4 pb-3 border-b border-line">
              <Segmentado tamanho="sm" rotulo="Painel" valor={painel} onChange={setPainel} opcoes={[['conteudo', 'Conteúdo'], ['aparencia', 'Aparência']] as const} />
            </div>
          )}
          <div className="flex-1 min-h-0 lg:overflow-y-auto overscroll-contain px-4 py-4">
            {painel === 'conteudo' || !meu ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-[13px] font-bold text-ink">Slide {sel + 1} · {sm.nome}</h2>
                  {meu && <div className="flex gap-0.5">
                    <Button size="icon-sm" variant="subtle" icon="ArrowUp" aria-label="Mover para antes" disabled={sel === 0} onClick={() => mover(sel, -1)} />
                    <Button size="icon-sm" variant="subtle" icon="ArrowDown" aria-label="Mover para depois" disabled={sel === a.slides.length - 1} onClick={() => mover(sel, 1)} />
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
              </>
            ) : (
              <div className="space-y-5">
                <div><span className="label">Tema</span><div className="flex gap-2">{(['escuro', 'claro'] as const).map((vv) => <button key={vv} type="button" aria-pressed={a.tema.variante === vv} onClick={() => setTema({ variante: vv })} className={cn('chip', a.tema.variante === vv && 'chip-active')}>{vv === 'escuro' ? 'Escuro' : 'Claro'}</button>)}</div></div>
                <div><span className="label">Cor de destaque</span><div className="flex flex-wrap gap-2">{CORES_TEMA.map((c) => <button key={c.cor} type="button" aria-label={c.nome} aria-pressed={a.tema.cor === c.cor} title={c.nome} onClick={() => setTema({ cor: c.cor })} className={cn('h-9 w-9 rounded-xl transition hover:scale-105', a.tema.cor === c.cor && 'ring-2 ring-offset-2 ring-offset-surface ring-ink')} style={{ background: c.cor }} />)}</div></div>
                <Toggle checked={a.tema.mostrarLogo} onChange={(v) => setTema({ mostrarLogo: v })} label="Mostrar logo nos slides" />
              </div>
            )}
          </div>
        </aside>

        {/* ---------- Palco: o slide centralizado, do maior tamanho que cabe ---------- */}
        <section aria-label="Palco" className="order-1 lg:order-2 flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8">
            {/* Largura limitada pela altura disponível (16:9): o slide nunca transborda o palco. */}
            <div key={slide.id} className="w-full animate-scale-in" style={{ maxWidth: 'min(1100px, calc((100dvh - 56px - 190px) * 16 / 9))' }}>
              <SlideEscalado slide={slide} modelo={modelo} tema={a.tema} numero={sel + 1} total={a.slides.length} className="shadow-md" />
            </div>
          </div>
          {problemas.length > 0 && (
            <p className="text-center text-[12px] text-muted -mt-2 mb-2 px-4"><Icon name="ListChecks" className="h-3.5 w-3.5 inline mr-1 -mt-0.5" /><b className="text-ink-2">{problemas.length} ponto(s) para revisar</b> antes de apresentar (marcados com ⚠ nas miniaturas).</p>
          )}
          {/* Tira de slides */}
          <nav aria-label="Slides" className="shrink-0 border-t border-line bg-surface/80 backdrop-blur">
            <ol className="flex gap-2.5 overflow-x-auto px-4 py-3 items-end">
              {a.slides.map((x, i) => (
                <li key={x.id} className="shrink-0 w-[132px]">
                  <button type="button" onClick={() => setSel(i)} aria-current={i === sel} aria-label={`Slide ${i + 1}: ${slideDoModelo(modelo, x.modeloSlideId).nome}`}
                    className={cn('block w-full rounded-lg p-1 transition text-left outline-none focus-visible:ring-2 focus-visible:ring-brand', i === sel ? 'ring-2 ring-brand bg-brand-50' : 'hover:bg-winter')}>
                    <SlideEscalado slide={x} modelo={modelo} tema={a.tema} borda={false} className="rounded-md" />
                    <span className="flex items-center gap-1 text-[11px] text-muted mt-1 px-0.5 min-w-0"><b className="text-ink-2">{i + 1}</b> <span className="truncate">{slideDoModelo(modelo, x.modeloSlideId).nome}</span>{problemas.some((p) => p.slideId === x.id) && <Icon name="AlertTriangle" className="h-3 w-3 text-warning ml-auto shrink-0" aria-label="tem avisos" />}</span>
                  </button>
                </li>
              ))}
              {meu && (
                <li className="shrink-0">
                  <details className="relative">
                    <summary className="list-none cursor-pointer w-[96px] rounded-lg border-2 border-dashed border-line-strong text-muted hover:border-brand hover:text-brand transition flex flex-col items-center justify-center gap-1 text-[11.5px] font-semibold [&::-webkit-details-marker]:hidden" style={{ aspectRatio: '16 / 11' }}>
                      <Icon name="Plus" className="h-5 w-5" />Slide
                    </summary>
                    <div className="absolute bottom-full right-0 z-20 mb-2 w-60 bg-surface border border-line rounded-xl shadow-lg p-1.5 animate-scale-in">
                      {modelo.slides.map((x) => <button key={x.id} type="button" onClick={(e) => { adicionar(x.id); (e.currentTarget.closest('details') as HTMLDetailsElement).open = false }} className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-ink hover:bg-surface-2">{x.nome}</button>)}
                    </div>
                  </details>
                </li>
              )}
            </ol>
          </nav>
        </section>
      </div>

      {apresentando && <Apresentar slides={a.slides} modelo={modelo} tema={a.tema} inicio={sel} onSair={() => setApresentando(false)} />}
      {imprimindo && <ImpressaoApresentacao slides={a.slides} modelo={modelo} tema={a.tema} titulo={a.titulo} onFim={() => setImprimindo(false)} />}
      <ConfirmModal open={remover != null} onClose={() => setRemover(null)} titulo="Excluir slide?" confirmar="Excluir" texto={remover != null ? `O slide ${remover + 1} (${slideDoModelo(modelo, a.slides[remover].modeloSlideId).nome}) será removido.` : ''} onConfirm={() => remover != null && excluir(remover)} />
    </div>
  )
}
