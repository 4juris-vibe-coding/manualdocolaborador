/* Renderização dos slides. Cada slide é desenhado em 1280×720 e escalado por CSS,
   então preview, miniaturas, apresentação e PDF ficam idênticos. */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { SlideInstancia, TemaApresentacao } from '@/lib/types'
import { slideDoModelo, itensDe, type ModeloApresentacao } from '@/domain/apresentacoes'
import { corTextoSobre } from '@/components/ui'
import logo from '@/LOGO4JURIS.jpg'

export const LARGURA = 1280
export const ALTURA = 720

interface Paleta { fundo: string; texto: string; suave: string; cartao: string; linha: string; acento: string; sobreAcento: string }
function paleta(t: TemaApresentacao): Paleta {
  const escuro = t.variante === 'escuro'
  return {
    fundo: escuro ? '#122029' : '#ffffff', texto: escuro ? '#ffffff' : '#122029', suave: escuro ? '#b5c0c9' : '#4a5864',
    cartao: escuro ? 'rgba(255,255,255,.07)' : '#f3f6fa', linha: escuro ? 'rgba(255,255,255,.14)' : '#dde3ea',
    acento: t.cor, sobreAcento: corTextoSobre(t.cor),
  }
}
/** Acento legível como TEXTO sobre o fundo do tema (no escuro, clareia). */
function acentoTexto(t: TemaApresentacao): string {
  if (t.variante === 'claro') return t.cor
  const m = t.cor.replace('#', '').match(/.{2}/g)!.map((h) => parseInt(h, 16))
  return `rgb(${m.map((v) => Math.round(v + (255 - v) * 0.55)).join(',')})`
}

const base: CSSProperties = { width: LARGURA, height: ALTURA, position: 'relative', overflow: 'hidden', fontFamily: "'Sora', system-ui, sans-serif", boxSizing: 'border-box' }

export function SlideConteudo({ slide, modelo, tema, numero, total }: { slide: SlideInstancia; modelo: ModeloApresentacao; tema: TemaApresentacao; numero?: number; total?: number }) {
  const sm = slideDoModelo(modelo, slide.modeloSlideId)
  const p = paleta(tema)
  const at = acentoTexto(tema)
  const v = (k: string) => slide.valores[k] ?? ''
  const rodape = (
    <>
      {tema.mostrarLogo && sm.layout !== 'capa' && <img src={logo} alt="" style={{ position: 'absolute', left: 64, bottom: 40, height: 40, width: 40, borderRadius: 10, objectFit: 'contain' }} />}
      {numero != null && sm.layout !== 'capa' && <div style={{ position: 'absolute', right: 64, bottom: 48, fontSize: 18, color: p.suave, fontWeight: 600 }}>{numero}{total ? ` / ${total}` : ''}</div>}
    </>
  )
  const barra = <div style={{ width: 72, height: 8, borderRadius: 4, background: p.acento, marginBottom: 28 }} />
  const titulo = (txt: string, tam = 56) => <h2 style={{ margin: 0, fontSize: tam, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', color: p.texto }}>{txt}</h2>

  switch (sm.layout) {
    case 'capa':
      return (
        <div style={{ ...base, background: p.fundo, color: p.texto, padding: '0 96px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 280, background: p.acento }} />
          <div style={{ position: 'absolute', right: 280, top: 0, bottom: 0, width: 10, background: p.cartao }} />
          {tema.mostrarLogo && <img src={logo} alt="" style={{ position: 'absolute', left: 96, top: 64, height: 64, width: 64, borderRadius: 14, objectFit: 'contain' }} />}
          <div style={{ maxWidth: 800 }}>
            {barra}
            <h1 style={{ margin: 0, fontSize: 76, lineHeight: 1.04, fontWeight: 800, letterSpacing: '-0.03em' }}>{v('titulo')}</h1>
            <p style={{ margin: '28px 0 0', fontSize: 30, lineHeight: 1.35, color: p.suave }}>{v('subtitulo')}</p>
          </div>
          <div style={{ position: 'absolute', left: 96, bottom: 64, fontSize: 20, color: p.suave, fontWeight: 600 }}>{v('rodape')}</div>
        </div>
      )
    case 'topicos':
      return (
        <div style={{ ...base, background: p.fundo, color: p.texto, padding: '72px 96px' }}>
          {barra}{titulo(v('titulo'))}
          <ol style={{ listStyle: 'none', margin: '40px 0 0', padding: 0, display: 'grid', gap: 18 }}>
            {itensDe(v('itens')).slice(0, 6).map((it, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 30, lineHeight: 1.25 }}>
                <span style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: 14, background: p.acento, color: p.sobreAcento, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>{i + 1}</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
          {rodape}
        </div>
      )
    case 'destaques':
      return (
        <div style={{ ...base, background: p.fundo, color: p.texto, padding: '72px 96px' }}>
          {barra}{titulo(v('titulo'))}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28, marginTop: 56 }}>
            {[1, 2, 3].map((n) => (
              <div key={n} style={{ background: p.cartao, borderLeft: `1px solid ${p.linha}`, borderRight: `1px solid ${p.linha}`, borderBottom: `1px solid ${p.linha}`, borderTop: `8px solid ${p.acento}`, borderRadius: 28, paddingTop: 36, paddingBottom: 36, paddingLeft: 32, paddingRight: 32 }}>
                <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em', color: at }}>{v(`v${n}`)}</div>
                <div style={{ marginTop: 18, fontSize: 24, lineHeight: 1.3, color: p.suave }}>{v(`r${n}`)}</div>
              </div>
            ))}
          </div>
          {v('nota') && <div style={{ position: 'absolute', left: 96, right: 96, bottom: 100, fontSize: 18, color: p.suave }}>{v('nota')}</div>}
          {rodape}
        </div>
      )
    case 'texto':
      return (
        <div style={{ ...base, background: p.fundo, color: p.texto, padding: '72px 96px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 64 }}>
          <div>{barra}{titulo(v('titulo'))}<p style={{ margin: '36px 0 0', fontSize: 28, lineHeight: 1.5, color: p.suave, whiteSpace: 'pre-line' }}>{v('corpo')}</p></div>
          <div style={{ alignSelf: 'center', background: p.acento, color: p.sobreAcento, borderRadius: 32, padding: '48px 40px', fontSize: 34, lineHeight: 1.25, fontWeight: 800 }}>{v('destaque')}</div>
          {rodape}
        </div>
      )
    case 'citacao':
      return (
        <div style={{ ...base, background: p.fundo, color: p.texto, padding: '0 128px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 160, lineHeight: 0.7, color: at, fontWeight: 800, height: 80 }}>“</div>
          <p style={{ margin: '24px 0 0', fontSize: 48, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.01em' }}>{v('citacao')}</p>
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 18, fontSize: 24, color: p.suave }}><span style={{ width: 56, height: 4, borderRadius: 2, background: p.acento }} />{v('autor')}</div>
          {rodape}
        </div>
      )
    case 'encerramento':
      return (
        <div style={{ ...base, background: p.acento, color: p.sobreAcento, padding: '0 96px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
          {tema.mostrarLogo && <img src={logo} alt="" style={{ height: 72, width: 72, borderRadius: 16, objectFit: 'contain', marginBottom: 40 }} />}
          <h2 style={{ margin: 0, fontSize: 88, lineHeight: 1.02, fontWeight: 800, letterSpacing: '-0.03em' }}>{v('titulo')}</h2>
          <p style={{ margin: '28px 0 0', fontSize: 32, lineHeight: 1.35, maxWidth: 820, opacity: 0.92 }}>{v('mensagem')}</p>
          <div style={{ marginTop: 48, fontSize: 26, fontWeight: 700, padding: '12px 24px', borderRadius: 999, border: `2px solid ${p.sobreAcento}` }}>{v('contato')}</div>
          {numero != null && <div style={{ position: 'absolute', right: 64, bottom: 48, fontSize: 18, fontWeight: 600, opacity: 0.8 }}>{numero}{total ? ` / ${total}` : ''}</div>}
        </div>
      )
  }
}

/** Slide escalado para caber na largura do contêiner (proporção 16:9). */
export function SlideEscalado({ slide, modelo, tema, numero, total, className = '', borda = true }: { slide: SlideInstancia; modelo: ModeloApresentacao; tema: TemaApresentacao; numero?: number; total?: number; className?: string; borda?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.4)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ajustar = () => setEscala(el.clientWidth / LARGURA)
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={`relative w-full overflow-hidden ${borda ? 'rounded-xl border border-line shadow-xs' : ''} ${className}`} style={{ aspectRatio: '16 / 9' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: LARGURA, height: ALTURA, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
        <SlideConteudo slide={slide} modelo={modelo} tema={tema} numero={numero} total={total} />
      </div>
    </div>
  )
}

/** Modo apresentação em tela cheia (setas, espaço, clique, Esc). */
export function Apresentar({ slides, modelo, tema, inicio = 0, onSair }: { slides: SlideInstancia[]; modelo: ModeloApresentacao; tema: TemaApresentacao; inicio?: number; onSair: () => void }) {
  const [i, setI] = useState(Math.min(inicio, slides.length - 1))
  const raiz = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    const ajustar = () => setEscala(Math.min(window.innerWidth / LARGURA, window.innerHeight / ALTURA))
    ajustar()
    window.addEventListener('resize', ajustar)
    raiz.current?.requestFullscreen?.().catch(() => undefined)
    const tecla = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(slides.length - 1, x + 1)) }
      if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
      if (e.key === 'Home') setI(0)
      if (e.key === 'End') setI(slides.length - 1)
      if (e.key === 'Escape') onSair()
    }
    const sairFs = () => { if (!document.fullscreenElement) onSair() }
    window.addEventListener('keydown', tecla)
    document.addEventListener('fullscreenchange', sairFs)
    return () => { window.removeEventListener('resize', ajustar); window.removeEventListener('keydown', tecla); document.removeEventListener('fullscreenchange', sairFs); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined) }
  }, [slides.length, onSair])
  const s = slides[i]
  return (
    <div ref={raiz} role="dialog" aria-modal="true" aria-label="Modo apresentação" className="fixed inset-0 z-[500] bg-black flex items-center justify-center select-none" onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))}>
      <div style={{ width: LARGURA * escala, height: ALTURA * escala, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: LARGURA, height: ALTURA, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
          <SlideConteudo slide={s} modelo={modelo} tema={tema} numero={i + 1} total={slides.length} />
        </div>
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 text-white rounded-full px-4 py-2 text-[13px] opacity-0 hover:opacity-100 focus-within:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="px-2 py-1 rounded hover:bg-white/15 disabled:opacity-40" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Slide anterior">◀</button>
        <span className="tabular-nums">{i + 1} / {slides.length}</span>
        <button type="button" className="px-2 py-1 rounded hover:bg-white/15 disabled:opacity-40" disabled={i === slides.length - 1} onClick={() => setI(i + 1)} aria-label="Próximo slide">▶</button>
        <button type="button" className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25" onClick={onSair}>Sair (Esc)</button>
      </div>
    </div>
  )
}
