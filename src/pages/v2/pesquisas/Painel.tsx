/* Painel da Central de pesquisas: números reais, alertas e participação (sem identificar ninguém). */
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, PageHeader, Progress, StatCard, Tabela, TD, TH } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { LinhaTempo } from '@/components/v2/charts2'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { useApi } from '@/data/v2/api'
import { STATUS_PESQUISA } from '@/domain/v2/pesquisaTipos'
import { dataBR, numero, pct } from '@/lib/fmt'

interface Painel {
  porStatus: Record<string, number>
  elegiveis: number; convitesEnviados: number; respostas: number; pendentes: number; taxaResposta: number | null
  proximasDoFim: { id: string; titulo: string; fim: string; taxa: number | null }[]
  alertas: { tipo: string; pesquisaId: string; titulo: string; mensagem: string }[]
  respostasPorDia: { data: string; qtd: number }[]
  participacaoPorArea: { setorId: string; area: string; convidados: number; respostas: number | null; taxa: number | null; suprimido: boolean }[]
  resultadosRecentes: { id: string; titulo: string; respostas: number; taxaResposta: number | null; encerradaEm?: string }[]
}

export default function PainelPesquisas() {
  const nav = useNavigate()
  const r = useApi<Painel>('pesquisas/painel')
  return (
    <>
      <PageHeader title="Central de pesquisas" subtitle="Participação, prazos e resultados das pesquisas organizacionais."
        actions={<><Button variant="ghost" icon="LibraryBig" onClick={() => nav('/pesquisas-rh/modelos')}>Modelos</Button><Button icon="Plus" onClick={() => nav('/pesquisas-rh/nova')}>Nova pesquisa</Button></>} />
      <SoComBanco>
        <Aguardar r={r} linhas={4}>
          {(d) => {
            const total = Object.values(d.porStatus).reduce((a, b) => a + b, 0)
            if (!total) return <Card><EmptyState icon="ClipboardList" title="Nenhuma pesquisa criada" desc="Crie a primeira a partir de um modelo pronto (eNPS, clima, engajamento…) ou do zero." action={<Button icon="LibraryBig" onClick={() => nav('/pesquisas-rh/modelos')}>Escolher um modelo</Button>} /></Card>
            return (
              <div className="space-y-6">
                {d.alertas.length > 0 && (
                  <div className="space-y-2" role="region" aria-label="Alertas">
                    {d.alertas.map((a) => (
                      <Callout key={a.tipo + a.pesquisaId} tone="warning" icon={a.tipo === 'fim_proximo' ? 'CalendarClock' : 'TrendingDown'}>
                        <b>{a.titulo}</b> — {a.mensagem} <Link className="font-semibold underline" to={`/pesquisas-rh/${a.pesquisaId}`}>Abrir e enviar lembretes</Link>
                      </Callout>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon="Play" tone="success" value={d.porStatus.aberta ?? 0} label="Em andamento" />
                  <StatCard icon="FilePen" tone="ink" value={d.porStatus.rascunho ?? 0} label="Rascunhos" />
                  <StatCard icon="CalendarClock" tone="brand" value={d.porStatus.agendada ?? 0} label="Agendadas" />
                  <StatCard icon="CheckCircle2" tone="ink" value={d.porStatus.encerrada ?? 0} label="Encerradas" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon="Users" value={numero(d.elegiveis)} label="Pessoas convidadas (pesquisas ativas)" />
                  <StatCard icon="Send" value={numero(d.convitesEnviados)} label="Convites emitidos" />
                  <StatCard icon="MessageSquareText" tone="success" value={numero(d.respostas)} label="Respostas recebidas" />
                  <StatCard icon="Hourglass" tone="warning" value={numero(d.pendentes)} label="Respostas pendentes" trend={d.taxaResposta !== null ? <span className="text-brand">Participação {pct(d.taxaResposta)}</span> : undefined} />
                </div>
                <p className="text-[12px] text-muted -mt-3">Participação mede quantas pessoas responderam; não é um índice de satisfação.</p>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHead title="Respostas por dia" sub="Últimos 30 dias, todas as pesquisas" />
                    <div className="p-5"><LinhaTempo titulo="Respostas por dia" pontos={d.respostasPorDia.map((x) => ({ rotulo: dataBR(x.data).slice(0, 5), valor: x.qtd }))} /></div>
                  </Card>
                  <Card>
                    <CardHead title="Perto do encerramento" sub="Em andamento, próximos 7 dias" />
                    {d.proximasDoFim.length === 0 ? <p className="p-5 text-[13px] text-muted">Nenhuma pesquisa encerra nos próximos 7 dias.</p> : (
                      <ul className="divide-y divide-line">
                        {d.proximasDoFim.map((p) => (
                          <li key={p.id} className="px-5 py-3 flex items-center gap-3">
                            <div className="min-w-0 flex-1"><Link to={`/pesquisas-rh/${p.id}`} className="font-semibold text-ink hover:text-brand truncate block">{p.titulo}</Link><div className="text-[12px] text-muted">até {dataBR(p.fim)}</div></div>
                            <div className="w-28"><div className="text-[12px] text-right mb-1">{pct(p.taxa)}</div><Progress value={p.taxa ?? 0} /></div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>

                <Card>
                  <CardHead title="Participação por área" sub="Áreas com poucas respostas ficam ocultas para proteger o anonimato." />
                  {d.participacaoPorArea.length === 0 ? <p className="p-5 text-[13px] text-muted">Sem convites emitidos ainda.</p> : (
                    <Tabela minWidth={520}>
                      <thead><tr><th className={TH}>Área</th><th className={TH}>Convidados</th><th className={TH}>Respostas</th><th className={TH}>Participação</th></tr></thead>
                      <tbody>
                        {d.participacaoPorArea.map((a) => (
                          <tr key={a.setorId}>
                            <td className={TD}>{a.area}</td><td className={TD}>{a.convidados}</td>
                            <td className={TD}>{a.suprimido ? <Badge>oculto (poucas respostas)</Badge> : a.respostas}</td>
                            <td className={TD}>{a.suprimido ? '—' : pct(a.taxa)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Tabela>
                  )}
                </Card>

                <Card>
                  <CardHead title="Resultados recentes" action={<Button size="sm" variant="ghost" onClick={() => nav('/pesquisas-rh/lista')}>Ver todas</Button>} />
                  {d.resultadosRecentes.length === 0 ? <p className="p-5 text-[13px] text-muted">Nenhuma pesquisa encerrada ainda.</p> : (
                    <ul className="divide-y divide-line">
                      {d.resultadosRecentes.map((p) => (
                        <li key={p.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                          <StatusBadge mapa={STATUS_PESQUISA} valor="encerrada" />
                          <Link to={`/pesquisas-rh/${p.id}/resultados`} className="font-semibold text-ink hover:text-brand flex-1 min-w-[180px]">{p.titulo}</Link>
                          <span className="text-[12.5px] text-muted">{p.respostas} respostas · participação {pct(p.taxaResposta)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            )
          }}
        </Aguardar>
      </SoComBanco>
    </>
  )
}
