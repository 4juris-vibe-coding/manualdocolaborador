import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, BarList, Button, Callout, Card, CardHead, ColunasMensais, EmptyState, IndicadorCard, PageHeader, Progress, StatCard, Tabs } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Funil } from '@/components/v2/charts2'
import { AprovacoesPendentes, BarraFiltros, queryDe, useFiltrosUrl, useOpcoes } from '@/components/v2/vagas/comum'
import { api, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { dataBR, numero, pct } from '@/lib/fmt'

interface Painel {
  cards: Record<string, number>
  indicadores: { tempoMedioFechamentoDias: number | null; tempoMedioFechamentoN: number; tempoMedioPrimeiraCandidaturaDias: number | null; tempoMedioPrimeiraCandidaturaN: number; tempoPorEtapa: { etapa: string; dias: number; n: number }[]; taxaConversao: number | null; noPrazo: { dentro: number; fora: number; taxa: number | null } }
  funil: { tipo: string; rotulo: string; alcancaram: number; conversaoDaAnterior: number | null }[]
  origens: { origem: string; qtd: number }[]
  candidaturasPorVaga: { vagaId: string; codigo: string; titulo: string; total: number; ativas: number }[]
  distribuicao: Record<'porSetor' | 'porUnidade' | 'porGestor' | 'porRecrutador', { id: string | null; nome: string; vagas: number; ativas: number; candidaturas: number }[]>
  evolucao: { mes: string; abertas: number; contratacoes: number }[]
  definicoes: Record<string, string>
  semDadosDeCandidatos: boolean
}
const ROTULO_ORIGEM: Record<string, string> = { portal: 'Portal de carreiras', indicacao: 'Indicação', linkedin: 'LinkedIn', manual: 'Cadastro manual', importacao: 'Importação', banco_talentos: 'Banco de talentos', outro: 'Outro' }
const EM_ABERTO = 'em_aprovacao,ajustes,aprovada,publicada,pausada'
const dias = (v: number | null) => (v === null ? '—' : `${numero(v, 1)} d`)

export default function PainelVagas() {
  const f = useFiltrosUrl()
  const opcoes = useOpcoes()
  const gestao = useTem('vagas:gerenciar')
  const solicita = useTem('vagas:solicitar')
  const [aba, setAba] = useState<'porSetor' | 'porUnidade' | 'porGestor' | 'porRecrutador'>('porSetor')
  const filtrosPainel = useMemo(() => { const { q, ...resto } = f.valores; return resto }, [f.valores])
  const painel = useApi<Painel>(`recrutamento/painel${queryDe(filtrosPainel)}`)
  const alertas = useApi<{ itens: { tipo: string; severidade: string; vagaId: string; codigo: string; titulo: string; mensagem: string; link: string }[] }>('recrutamento/alertas')

  // Processa alertas e publicações agendadas (idempotente) ao abrir o painel.
  useEffect(() => { if (gestao) api.post('recrutamento/alertas/processar').then(() => alertas.recarregar()).catch(() => undefined) }, [gestao]) // eslint-disable-line react-hooks/exhaustive-deps

  const lista = (extra: Record<string, string> = {}) => `/recrutamento/vagas${queryDe({ ...filtrosPainel, ...extra })}`
  const c = painel.dados?.cards

  return (
    <>
      <PageHeader title="Painel de vagas" subtitle="Visão executiva e operacional do recrutamento. Clique em um indicador para ver as vagas correspondentes."
        eyebrow={<Badge tone="brand">Recrutamento</Badge>}
        actions={<>
          {solicita && <Link to="/recrutamento/vagas/nova"><Button icon="Plus">Nova vaga</Button></Link>}
          <Link to="/recrutamento/vagas"><Button variant="ghost" icon="List">Ver todas</Button></Link>
        </>} />
      <SoComBanco>
        <BarraFiltros {...f} opcoes={opcoes.dados} comBusca={false} />

        <AprovacoesPendentes />

        <Aguardar r={painel} linhas={4}>
          {(p) => (
            <div className="space-y-6">
              {p.cards.total === 0 ? (
                <Card><EmptyState icon="Briefcase" title="Nenhuma vaga encontrada" desc={f.ativos ? 'Nenhuma vaga corresponde aos filtros. Ajuste ou limpe os filtros.' : 'Ainda não há vagas cadastradas. Crie a primeira para começar a acompanhar o recrutamento.'}
                  action={solicita && !f.ativos ? <Link to="/recrutamento/vagas/nova"><Button icon="Plus">Criar vaga</Button></Link> : undefined} /></Card>
              ) : (
                <>
                  <section aria-label="Situação das vagas" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                    {[
                      { icon: 'FolderOpen', v: p.cards.abertas, l: 'Vagas em aberto', to: lista({ status: EM_ABERTO }) },
                      { icon: 'Hourglass', v: p.cards.emAprovacao, l: 'Em aprovação', to: lista({ status: 'em_aprovacao' }), tone: 'warning' },
                      { icon: 'CircleCheck', v: p.cards.aprovadasAguardando, l: 'Aprovadas, aguardando publicação', to: lista({ status: 'aprovada' }) },
                      { icon: 'Globe', v: p.cards.publicadas, l: 'Publicadas', to: lista({ status: 'publicada' }), tone: 'success' },
                      { icon: 'Pause', v: p.cards.pausadas, l: 'Pausadas ou suspensas', to: lista({ status: 'pausada' }), tone: 'warning' },
                      { icon: 'Activity', v: p.cards.emAndamento, l: 'Em andamento (com candidatos ativos)', to: lista({ status: 'publicada' }) },
                      { icon: 'CalendarClock', v: p.cards.proximasPrazo, l: 'Próximas do prazo (7 dias)', to: lista({ prazo: 'proxima' }), tone: 'warning' },
                      { icon: 'AlarmClockOff', v: p.cards.vencidas, l: 'Com prazo vencido', to: lista({ prazo: 'vencida' }), tone: 'danger' },
                      { icon: 'Flame', v: p.cards.criticas, l: 'Críticas ou prioritárias', to: lista({ criticas: '1' }), tone: 'danger' },
                      { icon: 'PencilLine', v: p.cards.rascunhos, l: 'Rascunhos', to: lista({ status: 'rascunho' }), tone: 'ink' },
                      { icon: 'CircleCheckBig', v: p.cards.encerradas, l: 'Encerradas', to: lista({ status: 'encerrada' }), tone: 'ink' },
                      { icon: 'Ban', v: p.cards.canceladas, l: 'Canceladas', to: lista({ status: 'cancelada' }), tone: 'ink' },
                      { icon: 'Users', v: p.cards.candidaturasRecebidas, l: 'Candidaturas recebidas', to: '/recrutamento/candidatos' },
                      { icon: 'UserCheck', v: p.cards.contratacoes, l: 'Contratações concluídas', to: '/recrutamento/candidatos', tone: 'success' },
                      { icon: 'Armchair', v: p.cards.posicoesEmAberto, l: 'Posições ainda em aberto', to: lista({ status: EM_ABERTO }) },
                    ].map((k) => (
                      <Link key={k.l} to={k.to} className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand hover:-translate-y-0.5 transition">
                        <StatCard icon={k.icon} tone={k.tone ?? 'brand'} value={numero(k.v)} label={k.l} />
                      </Link>
                    ))}
                  </section>

                  <section aria-label="Indicadores" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <IndicadorCard titulo="Tempo médio de fechamento" icon="Timer" valor={dias(p.indicadores.tempoMedioFechamentoDias)} definicao={p.definicoes.tempoPreenchimento} fonte="Vagas e contratações registradas" detalhe={p.indicadores.tempoMedioFechamentoN ? `${p.indicadores.tempoMedioFechamentoN} vaga(s) fechada(s)` : 'Sem vagas totalmente preenchidas no período'} />
                    <IndicadorCard titulo="Tempo até a 1ª candidatura" icon="Hourglass" valor={dias(p.indicadores.tempoMedioPrimeiraCandidaturaDias)} definicao={p.definicoes.tempoPrimeiraCandidatura} fonte="Publicação da vaga e candidaturas" detalhe={p.indicadores.tempoMedioPrimeiraCandidaturaN ? `${p.indicadores.tempoMedioPrimeiraCandidaturaN} vaga(s)` : 'Sem candidaturas ainda'} />
                    <IndicadorCard titulo="Conversão de candidatos" icon="Percent" valor={pct(p.indicadores.taxaConversao, 1)} definicao={p.definicoes.taxaConversao} fonte="Candidaturas e contratações" detalhe={`${numero(p.cards.contratacoes)} contratação(ões) em ${numero(p.cards.candidaturasRecebidas)} candidatura(s)`} />
                    <IndicadorCard titulo="Vagas dentro do prazo" icon="CalendarCheck" valor={pct(p.indicadores.noPrazo.taxa, 0)} definicao={p.definicoes.noPrazo} fonte="Prazo de preenchimento das vagas" detalhe={p.indicadores.noPrazo.taxa === null ? 'Nenhuma vaga com prazo definido' : `${p.indicadores.noPrazo.dentro} no prazo · ${p.indicadores.noPrazo.fora} fora`} />
                  </section>

                  {p.semDadosDeCandidatos && <Callout tone="neutral" icon="Info">Ainda não há candidaturas nas vagas filtradas, por isso funil, conversão e tempos por etapa aparecem vazios. Eles são calculados somente com dados reais.</Callout>}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <Card><CardHead title="Funil do processo seletivo" sub="Candidaturas que chegaram a cada etapa" /><div className="p-5"><Funil etapas={p.funil.map((e) => ({ rotulo: e.rotulo, valor: e.alcancaram }))} vazio="Sem candidaturas para montar o funil." /></div></Card>
                    <Card><CardHead title="Tempo médio por etapa" sub="Dias que as candidaturas ficaram em cada etapa" />
                      <div className="p-5"><BarList itens={p.indicadores.tempoPorEtapa.map((t) => ({ rotulo: `${t.etapa} (${t.n})`, valor: t.dias, sufixo: ' d' }))} vazio="Sem movimentações suficientes para calcular." /></div></Card>
                    <Card><CardHead title="Origem das candidaturas" />
                      <div className="p-5"><BarList itens={p.origens.map((o) => ({ rotulo: ROTULO_ORIGEM[o.origem] ?? o.origem, valor: o.qtd }))} vazio="Sem candidaturas no período." /></div></Card>
                    <Card><CardHead title="Candidaturas por vaga" sub="As 10 vagas com mais candidaturas" />
                      {p.candidaturasPorVaga.length === 0 ? <p className="p-5 text-[13px] text-muted">Sem candidaturas no período.</p> : (
                        <ul className="divide-y divide-line">
                          {p.candidaturasPorVaga.map((v) => (
                            <li key={v.vagaId}><Link to={`/recrutamento/candidatos?vaga=${v.vagaId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2 outline-none focus-visible:bg-surface-2">
                              <span className="min-w-0"><span className="block text-[13.5px] font-semibold text-ink truncate">{v.titulo}</span><span className="text-[11.5px] text-muted">{v.codigo}</span></span>
                              <span className="text-[13px] font-bold tabular-nums shrink-0">{v.total}<span className="text-muted font-medium"> · {v.ativas} ativas</span></span>
                            </Link></li>
                          ))}
                        </ul>
                      )}</Card>
                  </div>

                  <Card>
                    <CardHead title="Distribuição das vagas" sub="Clique em um item para abrir a lista filtrada" />
                    <div className="p-5">
                      <Tabs tabs={[{ key: 'porSetor', label: 'Departamento' }, { key: 'porUnidade', label: 'Unidade' }, { key: 'porGestor', label: 'Gestor' }, { key: 'porRecrutador', label: 'Recrutador' }]} active={aba} onChange={(k) => setAba(k as typeof aba)} />
                      <ul className="space-y-3">
                        {p.distribuicao[aba].map((d) => {
                          const chave = aba === 'porSetor' ? 'setor' : aba === 'porUnidade' ? 'unidade' : aba === 'porGestor' ? 'gestor' : 'recrutador'
                          const max = Math.max(1, ...p.distribuicao[aba].map((x) => x.vagas))
                          const corpo = (
                            <>
                              <div className="flex items-center justify-between text-[12.5px] mb-1"><span className="font-semibold text-ink truncate pr-2">{d.nome}</span><span className="font-bold text-ink-2 tabular-nums">{d.vagas} vaga(s) · {d.ativas} em aberto · {d.candidaturas} cand.</span></div>
                              <Progress value={(d.vagas / max) * 100} />
                            </>
                          )
                          return <li key={d.id ?? 'nd'}>{d.id ? <Link to={lista({ [chave]: d.id })} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand hover:opacity-80">{corpo}</Link> : corpo}</li>
                        })}
                      </ul>
                    </div>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <Card><CardHead title="Vagas abertas por mês" /><div className="p-5">{p.evolucao.length ? <ColunasMensais dados={p.evolucao.map((e) => ({ mes: e.mes, qtd: e.abertas }))} rotulo="Vagas abertas por mês" /> : <p className="text-[13px] text-muted">Sem dados no período.</p>}</div></Card>
                    <Card><CardHead title="Contratações por mês" /><div className="p-5">{p.evolucao.some((e) => e.contratacoes) ? <ColunasMensais dados={p.evolucao.map((e) => ({ mes: e.mes, qtd: e.contratacoes }))} rotulo="Contratações por mês" /> : <p className="text-[13px] text-muted">Nenhuma contratação registrada no período.</p>}</div></Card>
                  </div>
                </>
              )}
            </div>
          )}
        </Aguardar>

        {c && (alertas.dados?.itens.length ?? 0) > 0 && (
          <Card className="mt-6">
            <CardHead title="Alertas" sub="Vagas que precisam de atenção" />
            <ul className="divide-y divide-line">
              {alertas.dados!.itens.slice(0, 12).map((a, i) => (
                <li key={i}><Link to={a.link} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2 outline-none focus-visible:bg-surface-2">
                  <Badge tone={a.severidade === 'danger' ? 'danger' : a.severidade === 'warning' ? 'warning' : 'brand'}>{a.severidade === 'danger' ? 'Urgente' : a.severidade === 'warning' ? 'Atenção' : 'Aviso'}</Badge>
                  <span className="text-[13px] text-ink-2"><b className="text-ink">{a.codigo} · {a.titulo}</b><br />{a.mensagem}</span>
                </Link></li>
              ))}
            </ul>
          </Card>
        )}
      </SoComBanco>
    </>
  )
}
