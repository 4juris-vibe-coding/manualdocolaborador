/* Gráficos SVG simples e acessíveis para os módulos v2 (sem dependências novas). */
import { numero } from '@/lib/fmt'

export interface PontoLinha { rotulo: string; valor: number | null }

export function LinhaTempo({ pontos, titulo, formato = (v: number) => numero(v), altura = 180, cor = 'rgb(var(--c-brand))' }: {
  pontos: PontoLinha[]; titulo: string; formato?: (v: number) => string; altura?: number; cor?: string
}) {
  const validos = pontos.filter((p) => p.valor !== null) as { rotulo: string; valor: number }[]
  if (validos.length === 0) return <p className="text-[13px] text-muted py-8 text-center">Sem dados no período.</p>
  const W = 600, H = altura, pad = { t: 14, r: 12, b: 26, l: 36 }
  const max = Math.max(...validos.map((p) => p.valor), 1), min = Math.min(0, ...validos.map((p) => p.valor))
  const x = (i: number) => pad.l + (pontos.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (pontos.length - 1))
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b)
  const caminho = pontos.map((p, i) => (p.valor === null ? null : `${x(i)},${y(p.valor)}`)).filter(Boolean)
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={titulo}>
        <line x1={pad.l} x2={W - pad.r} y1={y(min)} y2={y(min)} stroke="rgb(var(--c-line))" />
        <text x={4} y={y(max) + 4} fontSize="10" fill="rgb(var(--c-muted))">{formato(max)}</text>
        <text x={4} y={y(min)} fontSize="10" fill="rgb(var(--c-muted))">{formato(min)}</text>
        <polyline points={caminho.join(' ')} fill="none" stroke={cor} strokeWidth="2.5" strokeLinejoin="round" />
        {pontos.map((p, i) => p.valor !== null && (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.valor)} r="3.5" fill={cor}><title>{`${p.rotulo}: ${formato(p.valor)}`}</title></circle>
            {(pontos.length <= 12 || i % Math.ceil(pontos.length / 12) === 0) && <text x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="rgb(var(--c-muted))">{p.rotulo}</text>}
          </g>
        ))}
      </svg>
      <figcaption className="sr-only">{titulo}: {validos.map((p) => `${p.rotulo} ${formato(p.valor)}`).join('; ')}</figcaption>
    </figure>
  )
}

export interface EtapaFunil { rotulo: string; valor: number }
/** Funil horizontal: cada barra é proporcional ao maior estágio; mostra a conversão em relação à etapa anterior. */
export function Funil({ etapas, vazio = 'Sem dados no período.' }: { etapas: EtapaFunil[]; vazio?: string }) {
  if (!etapas.length || etapas.every((e) => e.valor === 0)) return <p className="text-[13px] text-muted py-8 text-center">{vazio}</p>
  const topo = Math.max(...etapas.map((e) => e.valor), 1)
  return (
    <ul className="space-y-2" aria-label="Funil">
      {etapas.map((e, i) => {
        const ant = i > 0 ? etapas[i - 1].valor : null
        return (
          <li key={e.rotulo}>
            <div className="flex items-baseline justify-between text-[12.5px] mb-1">
              <span className="font-semibold text-ink">{e.rotulo}</span>
              <span className="text-muted tabular-nums">{numero(e.valor)}{ant ? ` · ${numero((e.valor / ant) * 100)}% da etapa anterior` : ''}</span>
            </div>
            <div className="h-6 rounded-lg bg-winter overflow-hidden">
              <div className="h-full rounded-lg bg-brand/85 transition-all" style={{ width: `${(e.valor / topo) * 100}%`, minWidth: e.valor ? 6 : 0 }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
