/* Gráficos mensais interativos (SVG, sem biblioteca): colunas agrupadas e linhas.
   - Um único eixo por gráfico (nunca eixo duplo).
   - Hover: tooltip com todos os valores do mês; clique: seleciona o mês (detalhamento).
   - Cores das séries: tokens --viz-1/--viz-2 (validados para daltonismo, claro e escuro).
   - Texto sempre nas cores de texto; a cor identifica a série só na marca e na legenda. */
import { useEffect, useRef, useState } from 'react'

export interface Serie { nome: string; cor: string; valores: (number | null)[] }

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloMes = (m: string, ano = false) => `${MESES_CURTOS[Number(m.slice(5, 7)) - 1]}${ano ? `/${m.slice(2, 4)}` : ''}`

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Escala "bonita" para o eixo (0 sempre visível). */
function escala(min: number, max: number, inteiro = false) {
  const lo = Math.min(0, min), hi = Math.max(0, max, 1)
  const passoBruto = (hi - lo) / 4
  const mag = 10 ** Math.floor(Math.log10(passoBruto))
  let passo = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= passoBruto) ?? passoBruto
  // Contagens (pessoas) nunca têm frações no eixo.
  if (inteiro) passo = Math.max(1, Math.ceil(passo))
  const ini = Math.floor(lo / passo) * passo, fim = Math.ceil(hi / passo) * passo
  const ticks: number[] = []
  for (let v = ini; v <= fim + passo / 2; v += passo) ticks.push(Math.round(v * 100) / 100)
  return { ini, fim, ticks }
}

const ALT = 220, M = { t: 12, r: 12, b: 26, l: 40 }

interface Props {
  meses: string[]
  series: Serie[]
  selecionado?: string | null
  onSelecionar?: (mes: string) => void
  formato?: (v: number) => string
  titulo: string
}

function Legenda({ series }: { series: Serie[] }) {
  if (series.length < 2) return null
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-[12px] text-ink-2" aria-label="Legenda">
      {series.map((s) => <li key={s.nome} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} aria-hidden />{s.nome}</li>)}
    </ul>
  )
}

function Dica({ x, w, mes, series, i, fmt }: { x: number; w: number; mes: string; series: Serie[]; i: number; fmt: (v: number) => string }) {
  const esquerda = x > w - 170
  return (
    <div role="status" className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface shadow-lg px-3 py-2 text-[12px] min-w-[140px]"
      style={esquerda ? { right: w - x + 10 } : { left: x + 10 }}>
      <div className="font-semibold text-ink mb-1">{rotuloMes(mes, true)}</div>
      {series.map((s) => <div key={s.nome} className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-ink-2"><span className="h-2 w-2 rounded-sm" style={{ background: s.cor }} />{s.nome}</span><b className="text-ink">{s.valores[i] == null ? '—' : fmt(s.valores[i]!)}</b></div>)}
      <div className="text-[11px] text-muted mt-1">Clique para ver as pessoas</div>
    </div>
  )
}

export function ColunasMensaisGrupo({ meses, series, selecionado, onSelecionar, formato = (v) => v.toLocaleString('pt-BR'), titulo }: Props) {
  const [ref, w] = useLargura<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const vals = series.flatMap((s) => s.valores.filter((v): v is number => v != null))
  const { ini, fim, ticks } = escala(Math.min(0, ...vals), Math.max(0, ...vals), vals.every(Number.isInteger))
  const iw = w - M.l - M.r, ih = ALT - M.t - M.b
  const y = (v: number) => M.t + ih - ((v - ini) / (fim - ini || 1)) * ih
  const slot = iw / Math.max(1, meses.length)
  const gap = 2
  const larg = Math.max(3, Math.min(18, (slot * 0.7 - gap * (series.length - 1)) / series.length))
  const grupo = larg * series.length + gap * (series.length - 1)
  const mostrarRotulo = (i: number) => meses.length <= 12 || i % Math.ceil(meses.length / 12) === 0
  return (
    <figure ref={ref} className="relative" aria-label={titulo}>
      <Legenda series={series} />
      <svg width={w} height={ALT} role="img" aria-label={titulo} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--c-line))" strokeWidth={t === 0 ? 1.5 : 1} /><text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="rgb(var(--c-muted))">{formato(t)}</text></g>)}
        {meses.map((m, i) => {
          const cx = M.l + slot * i + slot / 2
          const sel = selecionado === m
          return (
            <g key={m}>
              {(sel || hover === i) && <rect x={M.l + slot * i} y={M.t} width={slot} height={ih} fill="rgb(var(--c-brand) / 0.07)" rx={6} />}
              {series.map((s, k) => {
                const v = s.valores[i]
                if (v == null || v === 0) return null
                const x = cx - grupo / 2 + k * (larg + gap)
                const y0 = y(0), y1 = y(v)
                const h = Math.abs(y0 - y1)
                const topo = Math.min(y0, y1)
                const r = Math.min(4, larg / 2, h)
                // Ponta arredondada só na extremidade do dado; a base fica reta na linha do zero.
                const d = v > 0
                  ? `M${x},${y0} V${topo + r} Q${x},${topo} ${x + r},${topo} H${x + larg - r} Q${x + larg},${topo} ${x + larg},${topo + r} V${y0} Z`
                  : `M${x},${y0} V${topo + h - r} Q${x},${topo + h} ${x + r},${topo + h} H${x + larg - r} Q${x + larg},${topo + h} ${x + larg},${topo + h - r} V${y0} Z`
                return <path key={s.nome} d={d} fill={s.cor} opacity={selecionado && !sel ? 0.45 : 1} />
              })}
              {mostrarRotulo(i) && <text x={cx} y={ALT - 8} textAnchor="middle" fontSize="10.5" fill={sel ? 'rgb(var(--c-ink))' : 'rgb(var(--c-muted))'} fontWeight={sel ? 700 : 400}>{rotuloMes(m, meses.length > 12 || i === 0 || m.endsWith('-01'))}</text>}
              <rect x={M.l + slot * i} y={M.t} width={slot} height={ih + M.b} fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHover(i)} onClick={() => onSelecionar?.(m)} role="button" tabIndex={0} aria-label={`${rotuloMes(m, true)}: ${series.map((s) => `${s.nome} ${s.valores[i] ?? '—'}`).join(', ')}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelecionar?.(m) } }} />
            </g>
          )
        })}
      </svg>
      {hover != null && <Dica x={M.l + slot * hover + slot / 2} w={w} mes={meses[hover]} series={series} i={hover} fmt={formato} />}
    </figure>
  )
}

export function LinhasMensais({ meses, series, selecionado, onSelecionar, formato = (v) => v.toLocaleString('pt-BR'), titulo }: Props) {
  const [ref, w] = useLargura<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const vals = series.flatMap((s) => s.valores.filter((v): v is number => v != null))
  const { ini, fim, ticks } = escala(vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) : 1, vals.every(Number.isInteger))
  const iw = w - M.l - M.r, ih = ALT - M.t - M.b
  const y = (v: number) => M.t + ih - ((v - ini) / (fim - ini || 1)) * ih
  const x = (i: number) => M.l + (meses.length <= 1 ? iw / 2 : (iw * i) / (meses.length - 1))
  const mostrarRotulo = (i: number) => meses.length <= 12 || i % Math.ceil(meses.length / 12) === 0
  const caminho = (s: Serie) => {
    let d = '', caneta = false
    s.valores.forEach((v, i) => { if (v == null) { caneta = false; return } d += `${caneta ? 'L' : 'M'}${x(i)},${y(v)} `; caneta = true })
    return d
  }
  const hit = Math.max(16, iw / Math.max(1, meses.length - 1))
  return (
    <figure ref={ref} className="relative" aria-label={titulo}>
      <Legenda series={series} />
      <svg width={w} height={ALT} role="img" aria-label={titulo} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={M.l} x2={w - M.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--c-line))" /><text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10.5" fill="rgb(var(--c-muted))">{formato(t)}</text></g>)}
        {selecionado && meses.includes(selecionado) && <line x1={x(meses.indexOf(selecionado))} x2={x(meses.indexOf(selecionado))} y1={M.t} y2={M.t + ih} stroke="rgb(var(--c-brand) / 0.18)" strokeWidth={10} />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={M.t + ih} stroke="rgb(var(--c-muted-2))" strokeDasharray="3 3" />}
        {series.map((s) => <path key={s.nome} d={caminho(s)} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {series.map((s) => s.valores.map((v, i) => v != null && (hover === i || selecionado === meses[i] || meses.length <= 1) && (
          <circle key={`${s.nome}${i}`} cx={x(i)} cy={y(v)} r={4.5} fill={s.cor} stroke="rgb(var(--c-surface))" strokeWidth={2} />
        )))}
        {/* Rótulo direto só no último ponto (seletivo, nunca em todos). */}
        {series.length <= 4 && series.map((s) => { const i = s.valores.length - 1; const v = s.valores[i]; return v != null && meses.length > 1 && hover == null ? <text key={`u${s.nome}`} x={x(i) - 4} y={y(v) - 8} textAnchor="end" fontSize="11" fontWeight={700} fill="rgb(var(--c-ink))">{formato(v)}</text> : null })}
        {meses.map((m, i) => mostrarRotulo(i) && <text key={m} x={x(i)} y={ALT - 8} textAnchor="middle" fontSize="10.5" fill={selecionado === m ? 'rgb(var(--c-ink))' : 'rgb(var(--c-muted))'} fontWeight={selecionado === m ? 700 : 400}>{rotuloMes(m, meses.length > 12 || i === 0 || m.endsWith('-01'))}</text>)}
        {meses.map((m, i) => (
          <rect key={`h${m}`} x={x(i) - hit / 2} y={M.t} width={hit} height={ih + M.b} fill="transparent" className="cursor-pointer"
            onMouseEnter={() => setHover(i)} onClick={() => onSelecionar?.(m)} role="button" tabIndex={0} aria-label={`${rotuloMes(m, true)}: ${series.map((s) => `${s.nome} ${s.valores[i] ?? '—'}`).join(', ')}`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelecionar?.(m) } }} />
        ))}
      </svg>
      {hover != null && <Dica x={x(hover)} w={w} mes={meses[hover]} series={series} i={hover} fmt={formato} />}
    </figure>
  )
}
