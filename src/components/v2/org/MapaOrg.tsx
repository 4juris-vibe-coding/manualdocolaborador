/* Mapa interativo: cartões, conexões, zoom, arrastar, centralizar e foco. DOM + SVG + CSS transform, sem bibliotecas. */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import { Avatar, Button, Icon } from '@/components/ui'
import { cn } from '@/lib/utils'
import { calcularLayout, MEDIDAS, type NoLayout } from './layoutArvore'
import type { NoUI } from './tipos'

export interface MapaHandle { centralizar: () => void; focar: (chave: string) => void }
interface Props {
  visiveis: { no: NoUI; nivel: number; paiChave: string | null }[]
  expandidos: Set<string>
  carregandoRamo: Set<string>
  faltaCarregar: (id: string) => boolean
  selecionado: string | null
  onSelecionar: (id: string) => void
  onAlternar: (id: string) => void
}

const K_MIN = 0.3, K_MAX = 1.8

export const MapaOrg = forwardRef<MapaHandle, Props>(function MapaOrg({ visiveis, expandidos, carregandoRamo, faltaCarregar, selecionado, onSelecionar, onAlternar }, ref) {
  const vp = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState({ x: 24, y: 24, k: 1 })
  const arrasto = useRef<{ sx: number; sy: number; ox: number; oy: number; moveu: boolean } | null>(null)
  const foiArrasto = useRef(false)

  const layout = useMemo(() => {
    const porChave = new Map<string, NoLayout>()
    const raizes: NoLayout[] = []
    for (const v of visiveis) porChave.set(v.no.chave, { chave: v.no.chave, filhos: [] })
    for (const v of visiveis) {
      const n = porChave.get(v.no.chave)!
      if (v.paiChave && porChave.has(v.paiChave)) porChave.get(v.paiChave)!.filhos.push(n)
      else raizes.push(n)
    }
    return calcularLayout(raizes)
  }, [visiveis])
  const pos = useMemo(() => new Map(layout.nos.map((n) => [n.chave, n])), [layout])
  const porChave = useMemo(() => new Map(visiveis.map((v) => [v.no.chave, v.no])), [visiveis])

  const ajustar = useCallback(() => {
    const el = vp.current
    if (!el || !layout.largura) return
    const k = Math.min(1, (el.clientWidth - 48) / layout.largura, (el.clientHeight - 48) / layout.altura)
    const kk = Math.max(K_MIN, k)
    setVista({ k: kk, x: Math.max(24, (el.clientWidth - layout.largura * kk) / 2), y: 24 })
  }, [layout])

  const focar = useCallback((chave: string) => {
    const el = vp.current, p = pos.get(chave)
    if (!el || !p) return
    setVista((v) => ({ ...v, x: el.clientWidth / 2 - (p.x + MEDIDAS.largura / 2) * v.k, y: el.clientHeight / 2 - (p.y + MEDIDAS.altura / 2) * v.k }))
  }, [pos])
  useImperativeHandle(ref, () => ({ centralizar: ajustar, focar }), [ajustar, focar])

  // Ajusta uma vez ao receber a primeira árvore.
  const jaAjustou = useRef(false)
  useEffect(() => { if (!jaAjustou.current && layout.largura) { jaAjustou.current = true; ajustar() } }, [layout, ajustar])

  const zoom = useCallback((fator: number, cx?: number, cy?: number) => {
    const el = vp.current
    setVista((v) => {
      const k = Math.min(K_MAX, Math.max(K_MIN, v.k * fator))
      const px = cx ?? (el?.clientWidth ?? 0) / 2, py = cy ?? (el?.clientHeight ?? 0) / 2
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k }
    })
  }, [])

  // Roda do mouse: Ctrl/⌘ amplia em torno do cursor; sem Ctrl rola o mapa. Precisa de listener não passivo.
  useEffect(() => {
    const el = vp.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - r.left, e.clientY - r.top)
      } else setVista((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom])

  const iniciarArrasto = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    arrasto.current = { sx: e.clientX, sy: e.clientY, ox: vista.x, oy: vista.y, moveu: false }
    const mover = (ev: PointerEvent) => {
      const a = arrasto.current
      if (!a) return
      const dx = ev.clientX - a.sx, dy = ev.clientY - a.sy
      if (!a.moveu && Math.abs(dx) + Math.abs(dy) < 5) return
      a.moveu = true
      setVista((v) => ({ ...v, x: a.ox + dx, y: a.oy + dy }))
    }
    const soltar = () => {
      foiArrasto.current = !!arrasto.current?.moveu
      arrasto.current = null
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      setTimeout(() => { foiArrasto.current = false }, 0)
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
  }

  const teclas = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    const passo = 80
    if (e.key === '+' || e.key === '=') zoom(1.15)
    else if (e.key === '-') zoom(1 / 1.15)
    else if (e.key === '0') ajustar()
    else if (e.key === 'ArrowLeft') setVista((v) => ({ ...v, x: v.x + passo }))
    else if (e.key === 'ArrowRight') setVista((v) => ({ ...v, x: v.x - passo }))
    else if (e.key === 'ArrowUp') setVista((v) => ({ ...v, y: v.y + passo }))
    else if (e.key === 'ArrowDown') setVista((v) => ({ ...v, y: v.y - passo }))
    else return
    e.preventDefault()
  }

  return (
    <div className="relative rounded-2xl border border-line bg-surface-2 overflow-hidden">
      <div className="absolute z-10 right-3 top-3 flex flex-col gap-1.5">
        <Button size="icon-sm" variant="ghost" icon="Plus" aria-label="Ampliar" onClick={() => zoom(1.2)} />
        <Button size="icon-sm" variant="ghost" icon="Minus" aria-label="Reduzir" onClick={() => zoom(1 / 1.2)} />
        <Button size="icon-sm" variant="ghost" icon="Maximize" aria-label="Centralizar e ajustar à tela" onClick={ajustar} />
      </div>
      <div className="absolute z-10 left-3 bottom-3 text-[11px] text-muted bg-surface/90 rounded-lg px-2.5 py-1.5 border border-line pointer-events-none" aria-hidden>
        {Math.round(vista.k * 100)}% · arraste para mover · Ctrl + roda para ampliar
      </div>
      <div
        ref={vp} tabIndex={0} role="application" aria-label="Mapa do organograma. Use as setas para mover, mais e menos para ampliar e zero para centralizar. Há uma visão em lista como alternativa."
        onPointerDown={iniciarArrasto} onKeyDown={teclas}
        className="h-[68vh] min-h-[460px] cursor-grab active:cursor-grabbing select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      >
        <div style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})`, transformOrigin: '0 0', width: layout.largura, height: layout.altura, position: 'relative' }}>
          <svg width={layout.largura} height={layout.altura} className="absolute inset-0 overflow-visible pointer-events-none" aria-hidden>
            {layout.arestas.map((a) => {
              const meio = a.y1 + (a.y2 - a.y1) / 2
              return <path key={a.de + a.para} d={`M${a.x1},${a.y1} V${meio} H${a.x2} V${a.y2}`} fill="none" stroke="rgb(var(--c-line-strong))" strokeWidth="1.5" />
            })}
          </svg>
          {layout.nos.map((p) => {
            const no = porChave.get(p.chave)
            if (!no) return null
            const estilo = { left: p.x, top: p.y, width: MEDIDAS.largura, height: MEDIDAS.altura }
            if (no.tipo === 'vaga') {
              return (
                <div key={p.chave} style={estilo} className="absolute rounded-2xl border-2 border-dashed border-brand/50 bg-brand-50 px-3.5 py-3 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700 flex items-center gap-1"><Icon name="UserPlus" className="h-3 w-3" /> Posição vaga{no.vaga.abertas > 1 ? ` · ${no.vaga.abertas}` : ''}</span>
                  <span className="text-[13px] font-semibold text-ink truncate mt-1">{no.vaga.titulo}</span>
                  <span className="text-[11.5px] text-muted truncate">{[no.vaga.cargo, no.vaga.setor].filter(Boolean).join(' · ') || 'Vaga em aberto'}</span>
                </div>
              )
            }
            const c = no.pessoa
            const aberto = expandidos.has(c.id)
            const temFilhos = c.filhosNaVisao > 0 || faltaCarregar(c.id)
            return (
              <div key={p.chave} style={estilo} className="absolute">
                <button
                  type="button"
                  onClick={() => { if (!foiArrasto.current) onSelecionar(c.id) }}
                  aria-label={`${c.apelido || c.nome}, ${c.cargo ?? 'sem função definida'}, ${c.setor ?? 'sem área'}. ${c.diretos} subordinados diretos. Abrir detalhes.`}
                  className={cn('h-full w-full text-left rounded-2xl border bg-surface px-3 py-2.5 flex items-center gap-3 transition shadow-sm hover:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    selecionado === c.id ? 'border-brand ring-2 ring-brand/30' : 'border-line')}
                  style={{ borderLeft: `4px solid ${c.setorCor ?? 'rgb(var(--c-line-strong))'}` }}
                >
                  <Avatar nome={c.nome} cor={c.avatarCor ?? undefined} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-ink truncate">{c.apelido || c.nome}</span>
                    <span className="block text-[11.5px] text-ink-2 truncate">{c.cargo ?? 'Função não definida'}</span>
                    <span className="block text-[11px] text-muted truncate">{c.setor ?? 'Sem área'}{c.diretos > 0 ? ` · ${c.diretos} direto${c.diretos > 1 ? 's' : ''}` : ''}</span>
                  </span>
                  {c.pendente && <Icon name="AlertTriangle" className="h-4 w-4 text-warning shrink-0 absolute top-2 right-2" aria-label="Cadastro com pendência" />}
                </button>
                {temFilhos && (
                  <button
                    type="button"
                    onClick={() => onAlternar(c.id)}
                    aria-expanded={aberto}
                    aria-label={`${aberto ? 'Recolher' : 'Expandir'} equipe de ${c.apelido || c.nome}`}
                    className="absolute left-1/2 -bottom-3 -translate-x-1/2 h-6 min-w-6 px-1.5 rounded-full border border-line bg-surface text-[10.5px] font-bold text-ink-2 hover:bg-winter flex items-center justify-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {carregandoRamo.has(c.id) ? <Icon name="Loader2" className="h-3 w-3 animate-spin" /> : aberto ? <Icon name="Minus" className="h-3 w-3" /> : <>+{c.diretos || c.filhosNaVisao}</>}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})
