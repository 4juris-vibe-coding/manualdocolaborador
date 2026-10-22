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
import { travarRolagem } from '@/lib/rolagem'
import type { Aresta } from './layoutArvore'

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
    const chave = `${chaveAjuste ?? ''}|${alturaCaixa}`
    if (ultimaChave.current === chave) return
    const primeira = ultimaChave.current === null
    ultimaChave.current = chave
    // Espera o layout da nova caixa (tela cheia) antes de medir.
    requestAnimationFrame(() => enquadrarCom(K_LEGIVEL, !primeira))
  }, [chaveAjuste, alturaCaixa, largura, disponivel, enquadrarCom])
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

  // Pinça (dois dedos) amplia em torno do ponto entre os dedos; o arrasto de um dedo fica suspenso enquanto isso.
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const pinca = useRef<{ d0: number; k0: number; px: number; py: number } | null>(null)
  const iniciarPinca = () => {
    const [a, b] = [...dedos.current.values()]
    const r = vp.current?.getBoundingClientRect()
    if (!a || !b || !r) return
    const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top
    // Ponto do mapa sob o centro da pinça: continua sob os dedos enquanto o zoom muda.
    pinca.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: vista.k, px: (cx - vista.x) / vista.k, py: (cy - vista.y) / vista.k }
    arrasto.current = null
  }
  const acompanharDedo = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const mov = (ev: PointerEvent) => {
      if (!dedos.current.has(ev.pointerId)) return
      dedos.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      const pc = pinca.current, r = vp.current?.getBoundingClientRect()
      if (!pc || dedos.current.size < 2 || !r) return
      const [a, b] = [...dedos.current.values()]
      const k = Math.min(K_MAX, Math.max(K_MIN, pc.k0 * Math.hypot(a.x - b.x, a.y - b.y) / pc.d0))
      const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top
      mover(() => ({ k, x: cx - pc.px * k, y: cy - pc.py * k }), false)
    }
    const fim = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      dedos.current.delete(ev.pointerId)
      if (dedos.current.size < 2) pinca.current = null
      window.removeEventListener('pointermove', mov); window.removeEventListener('pointerup', fim); window.removeEventListener('pointercancel', fim)
    }
    window.addEventListener('pointermove', mov); window.addEventListener('pointerup', fim); window.addEventListener('pointercancel', fim)
    if (dedos.current.size === 2) iniciarPinca()
  }

  // Arrastar move o mapa. Um clique sem arrasto chega normalmente aos cartões.
  const iniciarArrasto = (e: React.PointerEvent) => {
    acompanharDedo(e)
    if (e.button !== 0 || dedos.current.size > 1) return
    arrasto.current = { sx: e.clientX, sy: e.clientY, ox: vista.x, oy: vista.y, moveu: false }
    const aoMover = (ev: PointerEvent) => {
      const a = arrasto.current
      if (!a || pinca.current) return
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

  // Maximizar/minimizar mantém a mesma visão: o ponto do mapa no centro e o zoom são guardados e reaplicados na nova caixa.
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const centroGuardado = useRef<{ cx: number; cy: number; k: number } | null>(null)
  const guardarCentro = () => {
    const el = vp.current, v = vistaRef.current
    if (el) centroGuardado.current = { cx: (el.clientWidth / 2 - v.x) / v.k, cy: (el.clientHeight / 2 - v.y) / v.k, k: v.k }
  }
  const abrirCheia = () => { guardarCentro(); setCheia('aberto') }
  const fecharCheia = useCallback(() => { guardarCentro(); setCheia((c) => (c === 'aberto' ? 'fechando' : c)) }, [])
  useEffect(() => {
    if (cheia === 'fechando') return
    const c = centroGuardado.current
    if (!c) return
    centroGuardado.current = cheia === 'fechado' ? null : c
    // Espera a nova caixa (portal ou página) ter tamanho antes de reposicionar.
    requestAnimationFrame(() => {
      const el = vp.current
      if (!el) return
      mover({ k: c.k, x: el.clientWidth / 2 - c.cx * c.k, y: el.clientHeight / 2 - c.cy * c.k })
    })
  }, [cheia, mover])
  useEffect(() => {
    if (cheia === 'fechando') { const t = window.setTimeout(() => setCheia('fechado'), 200); return () => window.clearTimeout(t) }
    if (cheia !== 'aberto') return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fecharCheia() }
    document.addEventListener('keydown', esc)
    const destravar = travarRolagem()
    vp.current?.focus({ preventScroll: true })
    return () => { document.removeEventListener('keydown', esc); destravar() }
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
        // Na página, deslizar na vertical rola a página (o mapa responde ao horizontal e à pinça); em tela cheia, o dedo move o mapa em qualquer direção.
        className={cn('cursor-grab active:cursor-grabbing select-none outline-none', maximizado ? 'touch-none' : 'touch-pan-y', 'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset', maximizado && 'flex-1 min-h-0')}
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
export function Conexoes({ largura, altura, arestas }: { largura: number; altura: number; arestas: Aresta[] }) {
  return (
    <svg width={largura} height={altura} className="absolute inset-0 overflow-visible pointer-events-none" aria-hidden>
      {arestas.map((a) => {
        const d = a.d
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
