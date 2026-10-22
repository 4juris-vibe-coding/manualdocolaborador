/* Visor de mapas (organograma de pessoas e de departamentos): enquadra, amplia, arrasta, foca e maximiza. DOM + CSS transform, sem bibliotecas.
   Regras de uso:
   · A roda do mouse rola a PÁGINA (o visor não prende a rolagem). Ctrl/⌘ + roda amplia; Shift + roda ou gesto lateral move para os lados.
   · Na página, a caixa tem a altura do conteúdo, com teto fixo (ALTURA_MAX) e nunca maior que o espaço da janela: o mapa não domina a tela.
     Para explorar mapas grandes há o modo "Maximizar" (tela cheia, com animação de entrada e saída; Esc volta).
   · O enquadramento automático nunca reduz abaixo de K_LEGIVEL (textos legíveis); "Ver tudo" enquadra o mapa inteiro, mesmo pequeno.
   · Movimentos pedidos por botões e teclado são animados; arrastar e ampliar com a roda respondem na hora. */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui'
import { useAlturaDisponivel } from '@/lib/layout'
import { cn } from '@/lib/utils'

export interface VisorHandle {
  /** Enquadra com textos legíveis (padrão ao abrir e ao trocar o recorte). */
  enquadrar: () => void
  /** Mostra o mapa inteiro, mesmo que fique pequeno. */
  verTudo: () => void
  /** Centraliza um retângulo do conteúdo (coordenadas do mapa). */
  focar: (r: { x: number; y: number; w: number; h: number }) => void
}

const K_MIN = 0.2, K_MAX = 1.8, K_LEGIVEL = 0.65
const MARGEM = 32
const ALTURA_MIN = 340
/** Teto da área do mapa dentro da página. Mais do que isso, só maximizando. */
const ALTURA_MAX = 600
const DURACAO = 320

type Vista = { x: number; y: number; k: number }

export const VisorMapa = forwardRef<VisorHandle, {
  largura: number
  altura: number
  /** Quando muda (outro recorte, expandir/recolher tudo), o visor reenquadra. */
  chaveAjuste?: string
  rotulo: string
  children: ReactNode
  className?: string
}>(function VisorMapa({ largura, altura, chaveAjuste, rotulo, children, className }, ref) {
  const caixa = useRef<HTMLDivElement>(null)
  const vp = useRef<HTMLDivElement>(null)
  const [vista, setVistaBruta] = useState<Vista>({ x: MARGEM, y: MARGEM, k: 1 })
  // "suave" liga a transição do transform só para movimentos pedidos (botões, teclado, foco).
  const [suave, setSuave] = useState(false)
  const tSuave = useRef<number>()
  const arrasto = useRef<{ sx: number; sy: number; ox: number; oy: number; moveu: boolean } | null>(null)
  // Tela cheia: 'fechado' → 'aberto' → 'fechando' (anima a saída antes de desmontar).
  const [cheia, setCheia] = useState<'fechado' | 'aberto' | 'fechando'>('fechado')
  const maximizado = cheia !== 'fechado'

  const mover = useCallback((v: Vista | ((v: Vista) => Vista), animar = false) => {
    if (animar) {
      setSuave(true)
      window.clearTimeout(tSuave.current)
      tSuave.current = window.setTimeout(() => setSuave(false), DURACAO + 40)
    } else setSuave(false)
    setVistaBruta(v)
  }, [])
  useEffect(() => () => window.clearTimeout(tSuave.current), [])

  // Altura na página: a do conteúdo, com teto fixo e nunca maior que o espaço da janela.
  const disponivel = useAlturaDisponivel(caixa, { min: 420 })
  const alturaCaixa = Math.max(ALTURA_MIN, Math.min(disponivel ?? ALTURA_MAX, ALTURA_MAX, altura + MARGEM * 2))

  const enquadrarCom = useCallback((kMinimo: number, animar = true) => {
    const el = vp.current
    if (!el || !largura) return
    const w = el.clientWidth, h = el.clientHeight
    const kCabe = Math.min(1, (w - MARGEM * 2) / largura, (h - MARGEM * 2) / altura)
    const k = Math.min(K_MAX, Math.max(kMinimo, kCabe))
    // Cabe: centraliza. Não cabe: centraliza no meio do mapa (onde fica o topo da hierarquia) e mostra a partir do primeiro nível.
    const x = (w - largura * k) / 2
    const y = altura * k + MARGEM * 2 <= h ? (h - altura * k) / 2 : MARGEM
    mover({ k, x, y }, animar)
  }, [largura, altura, mover])
  const enquadrar = useCallback(() => enquadrarCom(K_LEGIVEL), [enquadrarCom])
  const verTudo = useCallback(() => enquadrarCom(K_MIN), [enquadrarCom])

  const focar = useCallback((r: { x: number; y: number; w: number; h: number }) => {
    const el = vp.current
    if (!el) return
    mover((v) => {
      const k = Math.max(v.k, K_LEGIVEL)
      return { k, x: el.clientWidth / 2 - (r.x + r.w / 2) * k, y: el.clientHeight / 2 - (r.y + r.h / 2) * k }
    }, true)
  }, [mover])
  useImperativeHandle(ref, () => ({ enquadrar, verTudo, focar }), [enquadrar, verTudo, focar])

  // Enquadra ao abrir, quando o espaço muda e quando o recorte muda — não a cada nó expandido (o mapa não "pula").
  const ultimaChave = useRef<string | null>(null)
  useEffect(() => {
    if (!largura || disponivel === null) return
    const chave = `${chaveAjuste ?? ''}|${alturaCaixa}|${cheia === 'aberto'}`
    if (ultimaChave.current === chave) return
    const primeira = ultimaChave.current === null
    ultimaChave.current = chave
    // Espera o layout da nova caixa (tela cheia) antes de medir.
    requestAnimationFrame(() => enquadrarCom(K_LEGIVEL, !primeira))
  }, [chaveAjuste, alturaCaixa, cheia, largura, disponivel, enquadrarCom])
  useEffect(() => {
    const el = vp.current
    if (!el) return
    let w = el.clientWidth
    const ro = new ResizeObserver(() => { if (el.clientWidth !== w) { w = el.clientWidth; enquadrarCom(K_LEGIVEL, false) } })
    ro.observe(el)
    return () => ro.disconnect()
  }, [enquadrarCom, maximizado])

  const zoom = useCallback((fator: number, cx?: number, cy?: number, animar = true) => {
    const el = vp.current
    mover((v) => {
      const k = Math.min(K_MAX, Math.max(K_MIN, v.k * fator))
      const px = cx ?? (el?.clientWidth ?? 0) / 2, py = cy ?? (el?.clientHeight ?? 0) / 2
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k }
    }, animar)
  }, [mover])

  // Roda: só é capturada para ampliar (Ctrl/⌘) ou mover para os lados; a rolagem vertical comum segue para a página.
  // Em tela cheia não há página por trás: a roda move o mapa.
  useEffect(() => {
    const el = vp.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const r = el.getBoundingClientRect()
        zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top, false)
      } else if (maximizado || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
        const dy = e.shiftKey ? 0 : e.deltaY
        mover((v) => ({ ...v, x: v.x - dx, y: maximizado ? v.y - dy : v.y }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, mover, maximizado])

  // Arrastar move o mapa. Um clique sem arrasto chega normalmente aos cartões.
  const iniciarArrasto = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    arrasto.current = { sx: e.clientX, sy: e.clientY, ox: vista.x, oy: vista.y, moveu: false }
    const aoMover = (ev: PointerEvent) => {
      const a = arrasto.current
      if (!a) return
      const dx = ev.clientX - a.sx, dy = ev.clientY - a.sy
      if (!a.moveu && Math.abs(dx) + Math.abs(dy) < 5) return
      a.moveu = true
      mover((v) => ({ ...v, x: a.ox + dx, y: a.oy + dy }))
    }
    const soltar = () => {
      const moveu = !!arrasto.current?.moveu
      arrasto.current = null
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', soltar)
      // O clique (se houver) é disparado logo após o pointerup; se o botão foi solto fora da janela, ele não vem e o filtro expira.
      if (moveu) {
        const engolir = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
        window.addEventListener('click', engolir, { capture: true, once: true })
        setTimeout(() => window.removeEventListener('click', engolir, { capture: true }), 0)
      }
    }
    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', soltar)
  }

  const abrirCheia = () => setCheia('aberto')
  const fecharCheia = useCallback(() => setCheia((c) => (c === 'aberto' ? 'fechando' : c)), [])
  useEffect(() => {
    if (cheia === 'fechando') { const t = window.setTimeout(() => setCheia('fechado'), 200); return () => window.clearTimeout(t) }
    if (cheia !== 'aberto') return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharCheia() }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    vp.current?.focus()
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [cheia, fecharCheia])

  const teclas = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    const passo = 80
    if (e.key === '+' || e.key === '=') zoom(1.15)
    else if (e.key === '-') zoom(1 / 1.15)
    else if (e.key === '0') enquadrar()
    else if (e.key === 'ArrowLeft') mover((v) => ({ ...v, x: v.x + passo }), true)
    else if (e.key === 'ArrowRight') mover((v) => ({ ...v, x: v.x - passo }), true)
    else if (e.key === 'ArrowUp') mover((v) => ({ ...v, y: v.y + passo }), true)
    else if (e.key === 'ArrowDown') mover((v) => ({ ...v, y: v.y - passo }), true)
    else return
    e.preventDefault()
  }

  const ferramentas = (
    <div className="absolute z-10 right-3 top-3 flex items-center gap-1 rounded-xl border border-line bg-surface/95 backdrop-blur p-1 shadow-sm">
      <Button size="icon-sm" variant="subtle" icon="Minus" aria-label="Reduzir" title="Reduzir (−)" onClick={() => zoom(1 / 1.2)} />
      <button type="button" onClick={() => zoom(1 / vista.k)} title="Tamanho real (100%)"
        className="h-9 min-w-[52px] px-1.5 rounded-lg text-[12px] font-bold tabular-nums text-ink-2 hover:bg-winter outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {Math.round(vista.k * 100)}%
      </button>
      <Button size="icon-sm" variant="subtle" icon="Plus" aria-label="Ampliar" title="Ampliar (+)" onClick={() => zoom(1.2)} />
      <span className="w-px h-5 bg-line mx-0.5" aria-hidden />
      <Button size="icon-sm" variant="subtle" icon="Crosshair" aria-label="Enquadrar com textos legíveis" title="Enquadrar (0)" onClick={enquadrar} />
      <Button size="icon-sm" variant="subtle" icon="ScanSearch" aria-label="Ver o mapa inteiro" title="Ver o mapa inteiro" onClick={verTudo} />
      <span className="w-px h-5 bg-line mx-0.5" aria-hidden />
      {maximizado
        ? <Button size="icon-sm" variant="subtle" icon="Minimize2" aria-label="Sair da tela cheia" title="Sair da tela cheia (Esc)" onClick={fecharCheia} />
        : <Button size="icon-sm" variant="subtle" icon="Maximize2" aria-label="Maximizar o mapa" title="Maximizar" onClick={abrirCheia} />}
    </div>
  )

  const area = (
    <div
      role={maximizado ? 'dialog' : undefined}
      aria-modal={maximizado || undefined}
      aria-label={maximizado ? rotulo : undefined}
      className={cn(
        'relative rounded-2xl border border-line bg-surface-2 overflow-hidden',
        maximizado && 'fixed inset-3 sm:inset-6 z-[170] shadow-lg flex flex-col',
        cheia === 'aberto' && 'animate-expandir', cheia === 'fechando' && 'animate-recolher',
      )}
      // Grade pontilhada de fundo (como uma prancheta): ajuda a ler distâncias e o movimento do mapa.
      style={{ backgroundImage: 'radial-gradient(rgb(var(--c-line-strong) / .7) 1px, transparent 1.2px)', backgroundSize: `${22 * vista.k}px ${22 * vista.k}px`, backgroundPosition: `${vista.x}px ${vista.y}px` }}
    >
      {ferramentas}
      <div className="absolute z-10 left-3 bottom-3 hidden sm:block text-[11px] text-muted bg-surface/90 backdrop-blur rounded-lg px-2.5 py-1.5 border border-line pointer-events-none" aria-hidden>
        {maximizado ? 'Arraste ou role para mover · Ctrl + roda amplia · Esc sai da tela cheia' : 'Arraste para mover · Ctrl + roda amplia · Shift + roda move para os lados'}
      </div>
      <div
        ref={vp} tabIndex={0} role="application"
        aria-label={`${rotulo}. Use as setas para mover, mais e menos para ampliar e zero para enquadrar. Há uma visão em lista como alternativa.`}
        onPointerDown={iniciarArrasto} onKeyDown={teclas}
        style={maximizado ? undefined : { height: alturaCaixa }}
        className={cn('cursor-grab active:cursor-grabbing select-none touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset', maximizado && 'flex-1 min-h-0')}
      >
        <div style={{
          transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})`, transformOrigin: '0 0', width: largura, height: altura, position: 'relative',
          transition: suave ? `transform ${DURACAO}ms cubic-bezier(.2,.8,.3,1)` : undefined,
        }}>
          {children}
        </div>
      </div>
    </div>
  )

  return (
    // O invólucro fica sempre na página: mede o espaço disponível e guarda o lugar do mapa enquanto ele está maximizado (a página não "pula").
    <div ref={caixa} className={className}>
      {maximizado ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-2/60 flex items-center justify-center text-[13px] text-muted" style={{ height: alturaCaixa + 2 }}>
          Mapa aberto em tela cheia
        </div>
      ) : area}
      {maximizado && createPortal(
        <>
          <div className={cn('fixed inset-0 z-[165] bg-midnight/50 backdrop-blur-sm', cheia === 'fechando' ? 'animate-fade-out' : 'animate-fade-in')} onMouseDown={fecharCheia} aria-hidden />
          {area}
        </>, document.body)}
    </div>
  )
})

/** Conexões em "cotovelo" entre pai e filhos. Quando o mapa muda (expandir/recolher), as linhas deslizam junto com os cartões. */
export function Conexoes({ largura, altura, arestas }: { largura: number; altura: number; arestas: { de: string; para: string; x1: number; y1: number; x2: number; y2: number }[] }) {
  return (
    <svg width={largura} height={altura} className="absolute inset-0 overflow-visible pointer-events-none" aria-hidden>
      {arestas.map((a) => {
        const meio = a.y1 + (a.y2 - a.y1) / 2
        const d = `M${a.x1},${a.y1} V${meio} H${a.x2} V${a.y2}`
        // A propriedade CSS `d` anima o caminho nos navegadores que a suportam; nos demais, o atributo mantém o desenho correto.
        return <path key={a.de + a.para} d={d} className="animate-fade-in" fill="none" stroke="rgb(var(--c-line-strong))" strokeWidth="1.5"
          style={{ d: `path("${d}")`, transition: `d ${DURACAO}ms cubic-bezier(.2,.8,.3,1)` } as React.CSSProperties} />
      })}
    </svg>
  )
}

/** Estilo de posição dos cartões: deslizam para o novo lugar quando o mapa se reorganiza. */
export const estiloNo = (x: number, y: number, w: number, h: number): React.CSSProperties => ({
  left: x, top: y, width: w, height: h,
  transition: `left ${DURACAO}ms cubic-bezier(.2,.8,.3,1), top ${DURACAO}ms cubic-bezier(.2,.8,.3,1)`,
})
