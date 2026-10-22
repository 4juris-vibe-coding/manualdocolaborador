import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, Field, PageHeader, Select } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { api, executar, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { AVISO_INTEGRACOES, Indicador, dinheiro, useOpcoesFin } from '@/components/v2/financeiro/comum'
import { dataBR, dataHoraBR } from '@/lib/fmt'
import { somarDias, somarMeses } from '@/domain/v2/financeiro'

interface Ind { valor: number | null; definicao: string; fonte: string; link?: string; quantidade?: number }
interface Painel {
  periodo: { de: string; ate: string; competencias: string }; atualizadoEm: string
  contratos: Record<'ativos' | 'valorMensalContratado' | 'aVencer60' | 'vencidosSemRegularizacao', Ind>
  financeiro: Record<'faturado' | 'aprovado' | 'previsto' | 'pago' | 'vencido' | 'futuro' | 'retidoPago', Ind>
  operacao: Record<string, Ind>
  concentracao: { rotulo: string; valor: number; percentual: number }[]; concentracaoDefinicao: string
  porCentroCusto: { rotulo: string; valor: number }[]; porCentroCustoDefinicao: string
  ultimaExecucaoAlertas: { iniciado_em: string; origem: string; notificacoes: number; renovacoes: number; erro: string | null } | null
}
interface ItemAgenda { data: string; tipo: string; titulo: string; detalhe: string; link: string; atrasado: boolean }

const hoje = () => new Date().toISOString().slice(0, 10)
const inicioMes = () => `${hoje().slice(0, 7)}-01`

const ROTULO_OPERACAO: Record<string, string> = {
  notasAConferir: 'Notas a conferir', notasAAceitar: 'Notas aguardando aceite', notasDevolvidas: 'Notas devolvidas', notasComDivergencia: 'Notas com divergência',
  contasAAutorizar: 'Pagamentos a autorizar', contasAPagar: 'Pagamentos a registrar', contasAConciliar: 'Pagamentos a conciliar',
  documentosPendentes: 'Documentos a conferir', documentosVencidos: 'Documentos vencidos', documentosLegadosSemArquivo: 'Registros antigos sem arquivo',
  diasMediosAprovacao: 'Dias até o aceite (média)', diasMediosLiquidacao: 'Dias até o pagamento (média)',
}

export default function PainelFinanceiro() {
  const [de, setDe] = useState(inicioMes())
  const [ate, setAte] = useState(somarDias(somarMeses(inicioMes(), 1), -1))
  const [centro, setCentro] = useState('')
  const [fornecedor, setFornecedor] = useState('')
  const [dias, setDias] = useState('60')
  const op = useOpcoesFin()
  const q = new URLSearchParams({ de, ate, ...(centro ? { centro } : {}), ...(fornecedor ? { fornecedor } : {}) }).toString()
  const r = useApi<Painel>(`financeiro/painel?${q}`)
  const ag = useApi<{ itens: ItemAgenda[] }>(`financeiro/agenda?dias=${dias}`)

  return (
    <>
      <PageHeader title="Gestão de prestadores · painel" subtitle="Contratos, notas fiscais, pagamentos e documentos, calculados direto do banco."
        actions={<>
          <Link to="/financeiro/notas?pendentes=1"><Button variant="ghost" icon="Inbox">Minhas pendências</Button></Link>
          <Button variant="ghost" icon="BellRing" onClick={async () => { const x = await executar(() => api.post<{ notificacoes: number; renovacoes: number }>('financeiro/alertas/processar'), undefined); if (x) { toast(`Alertas processados: ${x.notificacoes} notificação(ões), ${x.renovacoes} renovação(ões) automática(s).`); r.recarregar(); ag.recarregar() } }}>Processar alertas</Button>
        </>} />
      <SoComBanco>
        <Callout tone="neutral" icon="Info" className="mb-5">{AVISO_INTEGRACOES}</Callout>
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="De" htmlFor="p-de" className="mb-0"><input id="p-de" type="date" className="input" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} /></Field>
            <Field label="Até" htmlFor="p-ate" className="mb-0"><input id="p-ate" type="date" className="input" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} /></Field>
            <Field label="Centro de custo" className="mb-0"><Select label="Centro de custo" value={centro} onChange={setCentro} className="sm:w-full">
              <option value="">Todos</option>{op.dados?.centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</Select></Field>
            <Field label="Fornecedor" className="mb-0"><Select label="Fornecedor" value={fornecedor} onChange={setFornecedor} className="sm:w-full">
              <option value="">Todos</option>{op.dados?.fornecedores.map((f) => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}</Select></Field>
          </div>
        </Card>

        <Aguardar r={r} linhas={6}>
          {(d) => (
            <>
              <p className="text-[12px] text-muted mb-3">Período {dataBR(d.periodo.de)} a {dataBR(d.periodo.ate)} (competências {d.periodo.competencias}) · calculado em {dataHoraBR(d.atualizadoEm)}
                {d.ultimaExecucaoAlertas && <> · alertas processados em {dataHoraBR(d.ultimaExecucaoAlertas.iniciado_em)} ({d.ultimaExecucaoAlertas.origem})</>}</p>

              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Valores (contratado ≠ faturado ≠ aprovado ≠ previsto ≠ pago)</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <Indicador titulo="Contratado (mensal)" valor={dinheiro(d.contratos.valorMensalContratado.valor)} definicao={d.contratos.valorMensalContratado.definicao} link="/financeiro/contratos?status=vigente" />
                <Indicador titulo="Faturado" valor={dinheiro(d.financeiro.faturado.valor)} definicao={d.financeiro.faturado.definicao} link="/financeiro/notas" />
                <Indicador titulo="Aprovado" valor={dinheiro(d.financeiro.aprovado.valor)} definicao={d.financeiro.aprovado.definicao} link="/financeiro/notas?status=aprovada" />
                <Indicador titulo="Previsto a pagar" valor={dinheiro(d.financeiro.previsto.valor)} definicao={d.financeiro.previsto.definicao} link={d.financeiro.previsto.link} />
                <Indicador titulo="Pago" tom="success" valor={dinheiro(d.financeiro.pago.valor)} definicao={d.financeiro.pago.definicao} link={d.financeiro.pago.link} />
                <Indicador titulo="Vencido sem pagamento" tom={d.financeiro.vencido.valor ? 'danger' : 'neutral'} valor={`${dinheiro(d.financeiro.vencido.valor)} (${d.financeiro.vencido.quantidade ?? 0})`} definicao={d.financeiro.vencido.definicao} link={d.financeiro.vencido.link} />
                <Indicador titulo="Obrigações futuras" valor={dinheiro(d.financeiro.futuro.valor)} definicao={d.financeiro.futuro.definicao} link="/financeiro/contas?status=prevista,autorizada" />
                <Indicador titulo="Retido em contas pagas" valor={dinheiro(d.financeiro.retidoPago.valor)} definicao={d.financeiro.retidoPago.definicao} />
              </div>

              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Contratos</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <Indicador titulo="Ativos" valor={d.contratos.ativos.valor} definicao={d.contratos.ativos.definicao} link={d.contratos.ativos.link} />
                <Indicador titulo="Vencem em 60 dias" tom={d.contratos.aVencer60.valor ? 'warning' : 'neutral'} valor={d.contratos.aVencer60.valor} definicao={d.contratos.aVencer60.definicao} link={d.contratos.aVencer60.link} />
                <Indicador titulo="Vencidos sem regularização" tom={d.contratos.vencidosSemRegularizacao.valor ? 'danger' : 'neutral'} valor={d.contratos.vencidosSemRegularizacao.valor} definicao={d.contratos.vencidosSemRegularizacao.definicao} link={d.contratos.vencidosSemRegularizacao.link} />
              </div>

              <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Operação</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {Object.entries(d.operacao).map(([k, i]) => (
                  <Indicador key={k} titulo={ROTULO_OPERACAO[k] ?? k} valor={i.valor ?? '—'} definicao={i.definicao} link={i.link}
                    tom={i.valor && ['notasDevolvidas', 'notasComDivergencia', 'documentosVencidos'].includes(k) ? 'warning' : 'neutral'} />
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHead title="Concentração de pagamentos por fornecedor" sub={d.concentracaoDefinicao} />
                  <div className="p-5 space-y-2.5">
                    {d.concentracao.length === 0 ? <p className="text-[13px] text-muted">Sem pagamentos no período.</p> : d.concentracao.map((c) => (
                      <div key={c.rotulo}>
                        <div className="flex justify-between text-[13px]"><span className="truncate">{c.rotulo}</span><span className="tabular-nums font-semibold">{dinheiro(c.valor)} · {c.percentual}%</span></div>
                        <div className="h-2 rounded-full bg-winter mt-1"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, c.percentual)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <CardHead title="Faturado por centro de custo" sub={d.porCentroCustoDefinicao} />
                  <div className="p-5 space-y-2">
                    {d.porCentroCusto.length === 0 ? <p className="text-[13px] text-muted">Sem notas no período.</p> : d.porCentroCusto.map((c) => (
                      <div key={c.rotulo} className="flex justify-between text-[13px] border-b border-line pb-1.5"><span className="truncate">{c.rotulo}</span><span className="tabular-nums font-semibold">{dinheiro(c.valor)}</span></div>
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </Aguardar>

        <Card>
          <CardHead title="Agenda de obrigações" sub="Términos e renovações de contrato, validade de documentos, vencimentos de pagamento e prazo de envio das notas."
            action={<Select label="Horizonte" value={dias} onChange={setDias}><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option><option value="180">180 dias</option></Select>} />
          <Aguardar r={ag} vazio={(x) => x.itens.length ? null : <div className="p-6"><EmptyState icon="CalendarCheck" title="Nada previsto no período" /></div>}>
            {(x) => (
              <ul className="divide-y divide-line">
                {x.itens.map((i, n) => (
                  <li key={n} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-24 shrink-0 text-[12.5px] font-semibold tabular-nums">{dataBR(i.data)}</div>
                    <div className="flex-1 min-w-0">
                      <Link to={i.link} className="text-[13.5px] font-semibold text-ink hover:text-brand">{i.titulo}</Link>
                      <div className="text-[12px] text-muted truncate">{i.detalhe}</div>
                    </div>
                    {i.atrasado && <Badge tone="danger" dot>Atrasado</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </Aguardar>
        </Card>
      </SoComBanco>
    </>
  )
}
