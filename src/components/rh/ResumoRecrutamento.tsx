/* ============================================================
   Painel de RH · resumo do funil de recrutamento no período.
   Lê o bloco `recrutamento` de GET analytics/resumo (mesmas definições
   do People Analytics). Sem permissão (ou bloco indisponível), não
   mostra nada. Só agregados: nenhum nome de candidato.
   ============================================================ */
import { Link } from 'react-router-dom'
import { Card, CardHead, StatCard } from '@/components/ui'
import { qs, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { numero } from '@/lib/fmt'

interface IndicadorRec { chave: string; valor: number | null; base?: number; disponivel: boolean; dependencia?: string }
interface BlocoRec {
  disponivel: boolean
  indicadores?: IndicadorRec[]
  vagasEncerradas?: number
  origensContratados?: { origem: string; rotulo: string; qtd: number }[]
}

export function ResumoRecrutamento({ de, ate }: { de: string; ate: string }) {
  const pode = useTem('analytics:ver')
  const r = useApi<{ blocos: { recrutamento: BlocoRec } }>(pode ? `analytics/resumo${qs({ de, ate })}` : null)
  const b = r.dados?.blocos.recrutamento
  if (!pode || r.erro || (r.dados && !b?.disponivel)) return null
  if (!b) return <Card className="p-5"><div className="h-24 animate-pulse rounded-xl bg-winter" aria-label="Carregando recrutamento" /></Card>

  const ind = (k: string) => b.indicadores?.find((i) => i.chave === k)
  const tempo = ind('tempo_preenchimento')
  const conv = ind('taxa_conversao')
  const abertas = ind('vagas_periodo')
  const origens = (b.origensContratados ?? []).slice(0, 3)
  const totalContr = (b.origensContratados ?? []).reduce((s, o) => s + o.qtd, 0)

  return (
    <Card>
      <CardHead title="Recrutamento no período" sub="Vagas abertas no período e o que delas resultou."
        action={<Link to="/rh/analytics?aba=recrutamento" className="text-[12.5px] font-semibold text-brand hover:underline">Ver detalhes</Link>} />
      <div className="p-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard compacto icon="Hourglass" tone="brand" label="Tempo médio para contratar"
          value={tempo?.valor !== null && tempo?.valor !== undefined ? `${numero(tempo.valor, 1)} dias` : '—'} />
        <StatCard compacto icon="Percent" tone="success" label={`Candidatura → contratação${conv?.base ? ` (${conv.base} candidaturas)` : ''}`}
          value={conv?.valor !== null && conv?.valor !== undefined ? `${numero(conv.valor, 1)}%` : '—'} />
        <StatCard compacto icon="Briefcase" tone="ink" label="Vagas abertas no período" value={abertas?.valor ?? 0} />
        <StatCard compacto icon="CheckCircle2" tone="warning" label="Vagas encerradas no período" value={b.vagasEncerradas ?? 0} />
      </div>
      <div className="px-5 pb-5">
        <div className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">Origem dos contratados</div>
        {origens.length === 0 ? <p className="text-[12.5px] text-muted">Nenhuma contratação nas vagas do período.</p> : (
          <ul className="space-y-1.5">
            {origens.map((o) => (
              <li key={o.origem} className="flex items-center gap-3 text-[13px]">
                <span className="w-40 truncate text-ink-2">{o.rotulo}</span>
                <span className="flex-1 h-2 rounded-full bg-winter overflow-hidden" aria-hidden><span className="block h-full bg-brand rounded-full" style={{ width: `${totalContr ? Math.round((o.qtd / totalContr) * 100) : 0}%` }} /></span>
                <span className="tabular-nums font-semibold text-ink w-8 text-right">{o.qtd}</span>
              </li>
            ))}
          </ul>
        )}
        {tempo && !tempo.disponivel && tempo.dependencia && <p className="text-[11.5px] text-muted mt-3">Tempo para contratar: {tempo.dependencia}</p>}
      </div>
    </Card>
  )
}
