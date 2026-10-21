import { Badge } from '@/components/ui'

export interface MapaStatus { [valor: string]: { rotulo: string; tom: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold' } }

/** Badge de status com rótulo e cor vindos de um mapa (ver src/domain/v2/rotulos.ts). */
export function StatusBadge({ mapa, valor, dot = true }: { mapa: MapaStatus; valor: string | null | undefined; dot?: boolean }) {
  const m = valor ? mapa[valor] : undefined
  return <Badge tone={m?.tom ?? 'neutral'} dot={dot}>{m?.rotulo ?? valor ?? '—'}</Badge>
}
