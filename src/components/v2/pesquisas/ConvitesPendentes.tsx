/* Convites da Central de pesquisas para a pessoa logada (aparecem na página "Pesquisas" do portal). */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card } from '@/components/ui'
import { MODO_API } from '@/data/config'
import { api, executar, useApi } from '@/data/v2/api'
import { dataBR } from '@/lib/fmt'

interface Convite { conviteId: string; titulo: string; modo: 'anonima' | 'identificada'; prazo: string; tempoMin: number | null }

export function ConvitesPendentes() {
  const nav = useNavigate()
  const r = useApi<{ itens: Convite[] }>(MODO_API ? 'pesquisas/meus-convites' : null)
  const [abrindo, setAbrindo] = useState<string | null>(null)
  if (!MODO_API || !r.dados?.itens.length) return null

  async function responder(c: Convite) {
    setAbrindo(c.conviteId)
    const t = await executar(() => api.post<{ token: string }>(`pesquisas/meus-convites/${c.conviteId}/abrir`))
    setAbrindo(null)
    if (t) nav(`/responder/${t.token}`)
  }
  return (
    <section className="mb-8" aria-label="Convites para responder">
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Convites para você</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {r.dados.itens.map((c) => (
          <Card key={c.conviteId} className="p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="brand" dot>Aguardando sua resposta</Badge>
              <Badge tone={c.modo === 'anonima' ? 'success' : 'warning'}>{c.modo === 'anonima' ? 'Anônima' : 'Identificada'}</Badge>
              <span className="text-[12px] text-muted">até {dataBR(c.prazo)}</span>
            </div>
            <h3 className="text-[15.5px] font-bold text-ink flex-1">{c.titulo}</h3>
            <div className="flex items-center justify-between mt-4">
              <span className="text-[12px] text-muted">{c.tempoMin ? `~${c.tempoMin} min` : ''}</span>
              <Button size="sm" icon="PenLine" disabled={abrindo === c.conviteId} onClick={() => responder(c)}>Responder</Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
