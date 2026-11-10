/* Área da liderança: membros, pendências, devolutivas/PDI, evolução e o feedback consolidado sobre a própria liderança. */
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, PageHeader, Tabela, TD, TH } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { StatusCiclo } from '@/components/v2/desenvolvimento/comuns'
import { useApi } from '@/data/v2/api'
import { dataBR } from '@/lib/fmt'
import type { Marco } from '@/domain/v2/desenvolvimento'
import type { LinhaCiclo } from './Meu'

interface Equipe {
  membros: { id: string; nome: string; cargo: string | null; admissao: string | null; direto: boolean; cicloAtual: LinhaCiclo | null; ultimoConcluido: LinhaCiclo | null; proximo: Marco | null; acoes: { abertas: number; atrasadas: number; concluidas: number } }[]
  formularios: { id: string; tipo: string; rotulo: string; prazo: string; atrasado: boolean; sobre: string | null; marco: string }[]
  tarefas: LinhaCiclo[]
  feedbackLideranca: { cicloId: string; rotulo: string; data: string; respostas: number | null; liberado: boolean; media: number | null }[]
  minimoEquipe: number
}

export default function DesenvolvimentoEquipe() {
  const nav = useNavigate()
  const r = useApi<Equipe>('desenvolvimento/equipe')
  return (
    <>
      <PageHeader title="Desenvolvimento da equipe" subtitle="Acompanhamentos, avaliações, devolutivas e PDIs das pessoas que você lidera."
        actions={<Button variant="ghost" icon="Sprout" onClick={() => nav('/desenvolvimento')}>Minha própria jornada</Button>} />
      <SoComBanco>
        <Aguardar r={r} linhas={4}>
          {(d) => (
            <div className="space-y-8">
              {d.formularios.length > 0 && (
                <section aria-label="Avaliações para você fazer">
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Para você preencher</h2>
                  <Card>
                    <ul className="divide-y divide-line">
                      {d.formularios.map((f) => (
                        <li key={f.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[200px]"><div className="text-[13.5px] font-semibold text-ink">{f.rotulo} · {f.sobre}</div><div className="text-[12px] text-muted">{f.marco} · até {dataBR(f.prazo)}</div></div>
                          {f.atrasado && <Badge tone="danger" dot>Prazo vencido</Badge>}
                          <Button size="sm" icon="PenLine" onClick={() => nav(`/desenvolvimento/responder/${f.id}`)}>Responder</Button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              )}
              {d.tarefas.length > 0 && (
                <section aria-label="Devolutivas e PDIs">
                  <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Conversas a conduzir</h2>
                  <Card>
                    <ul className="divide-y divide-line">
                      {d.tarefas.map((c) => (
                        <li key={c.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[200px]"><div className="text-[13.5px] font-semibold text-ink">{c.colaboradorNome}</div><div className="text-[12px] text-muted">{c.rotulo} · prazo {dataBR(c.prazo)}</div></div>
                          <StatusCiclo status={c.status} atrasado={c.atrasado} />
                          <Button size="sm" variant="soft" icon="ArrowRight" onClick={() => nav(`/desenvolvimento/ciclos/${c.id}`)}>Abrir</Button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              )}

              <Card>
                <CardHead title="Sua equipe" sub="Situação do ciclo de cada pessoa. A liderança vem do cadastro (responsável direto ou liderança da área)." />
                {d.membros.length === 0 ? <EmptyState icon="Users" title="Ninguém na sua equipe direta" desc="Se isso parece um engano, peça ao RH para conferir o responsável direto no cadastro." /> : (
                  <Tabela minWidth={820}>
                    <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Ciclo atual</th><th className={TH}>Próximo marco</th><th className={TH}>Ações (PDI)</th><th className={TH}></th></tr></thead>
                    <tbody>
                      {d.membros.map((m) => (
                        <tr key={m.id}>
                          <td className={TD}><div className="font-semibold text-ink">{m.nome}</div><div className="text-[12px] text-muted">{m.cargo ?? '—'}{m.admissao && ` · desde ${dataBR(m.admissao)}`}{!m.direto && ' · designado(a) pelo RH'}</div></td>
                          <td className={TD}>{m.cicloAtual ? <Link to={`/desenvolvimento/ciclos/${m.cicloAtual.id}`} className="block hover:text-brand"><div className="text-[12.5px] font-semibold">{m.cicloAtual.rotulo}</div><StatusCiclo status={m.cicloAtual.status} atrasado={m.cicloAtual.atrasado} /></Link> : <span className="text-[12.5px] text-muted">Nenhum em andamento</span>}</td>
                          <td className={TD}>{m.proximo ? <><div className="text-[12.5px]">{m.proximo.rotulo}</div><div className="text-[12px] text-muted">{dataBR(m.proximo.data)}</div></> : '—'}</td>
                          <td className={TD}><span className="text-[12.5px]">{m.acoes.abertas} em aberto · {m.acoes.concluidas} concluída(s)</span>{m.acoes.atrasadas > 0 && <Badge className="ml-1.5" tone="danger">{m.acoes.atrasadas} atrasada(s)</Badge>}</td>
                          <td className={TD}><Button size="sm" variant="ghost" icon="Route" onClick={() => nav(`/desenvolvimento/pessoas/${m.id}`)}>Jornada</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </Tabela>
                )}
              </Card>

              <Card>
                <CardHead title="Feedback sobre a sua liderança" sub="Você também é avaliada(o): pela sua liderança, por você e pela sua equipe." />
                <div className="p-5 space-y-3">
                  <Callout tone="neutral" icon="ShieldCheck">Você recebe médias e uma síntese preparada pelo RH, nunca respostas individuais, e só quando houver pelo menos {d.minimoEquipe} respostas. Use como ponto de partida para evoluir, não para descobrir quem disse o quê.</Callout>
                  {d.feedbackLideranca.length === 0 ? <p className="text-[13px] text-muted">Aparece a partir da sua AVD semestral como liderança.</p> : (
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {d.feedbackLideranca.map((f) => (
                        <li key={f.cicloId} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-[160px]"><div className="text-[13.5px] font-semibold text-ink">{f.rotulo}</div><div className="text-[12px] text-muted">{dataBR(f.data)}</div></div>
                          {f.liberado ? <Badge tone="success">Média {String(f.media ?? '—').replace('.', ',')} · {f.respostas} respostas</Badge> : <Badge>Ainda não liberado</Badge>}
                          <Button size="sm" variant="ghost" onClick={() => nav(`/desenvolvimento/ciclos/${f.cicloId}`)}>Ver</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}
