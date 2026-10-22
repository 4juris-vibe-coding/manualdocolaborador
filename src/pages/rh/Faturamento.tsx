import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { MODO_API } from '@/data/config'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, IndicadorCard, BarList, Tabela, TH, TD, Select, Badge, Button, EmptyState } from '@/components/ui'
import { BotaoImprimir } from '@/components/inputs'
import { toast } from '@/components/toast'
import { brl, mesLabel, STATUS_SOLIC } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { faturamento } from '@/domain/metricas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'

const competenciasAte = (fim: string, n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)) - 1 - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })

/** Com banco, a tela é o módulo de gestão de prestadores (servidor); esta versão atende o modo demonstração. */
export default function Faturamento() {
  if (MODO_API) return <Navigate to="/financeiro" replace />
  return <FaturamentoDemo />
}

function FaturamentoDemo() {
  const s = useStore()
  const [periodo, setPeriodo] = useState('1')
  const [fim, setFim] = useState(hojeISO().slice(0, 7))
  const comps = useMemo(() => competenciasAte(fim, Number(periodo)), [fim, periodo])
  const f = faturamento(s, comps)
  const porComp = comps.map((c) => ({ c, ...faturamento(s, [c]) }))
  const porPessoa = useMemo(() => {
    const m = new Map<string, number>()
    f.notas.forEach((n) => m.set(n.colaboradorId, (m.get(n.colaboradorId) ?? 0) + n.valor))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [f.notas])

  const exportar = () => {
    baixarArquivo(gerarCSV(f.notas, [
      { titulo: 'Competência', valor: (n) => n.competencia }, { titulo: 'Pessoa', valor: (n) => s.nomeDe(n.colaboradorId) }, { titulo: 'CNPJ', valor: (n) => s.pessoa(n.colaboradorId)?.cnpj ?? '' },
      { titulo: 'Área', valor: (n) => s.setorNome(s.pessoa(n.colaboradorId)?.setorId) }, { titulo: 'Valor', valor: (n) => n.valor.toFixed(2).replace('.', ',') }, { titulo: 'Situação', valor: (n) => STATUS_SOLIC[n.status].label }, { titulo: 'Pago em', valor: (n) => n.pagaEm ?? '' },
    ], [`Faturamento de serviços · ${comps.slice().reverse().join(', ')}`, `Gerado em ${new Date().toLocaleString('pt-BR')}`]), `faturamento-${comps[comps.length - 1]}-a-${comps[0]}.csv`)
    toast('Faturamento exportado.')
  }

  return (
    <>
      <PageHeader title="Faturamento de serviços" subtitle="Notas fiscais dos prestadores e reembolsos por competência." actions={<><BotaoImprimir /><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Link to="/notas"><Button icon="FileText">Central de notas</Button></Link></>} />
      <Card className="p-4 mb-5 no-print"><div className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="ft-m">Até a competência</label><input id="ft-m" type="month" className="input w-auto" value={fim} onChange={(e) => setFim(e.target.value || hojeISO().slice(0, 7))} /></div>
        <div><span className="label">Período</span><Select label="Período" value={periodo} onChange={setPeriodo}>{[['1', 'Só este mês'], ['3', 'Últimos 3 meses'], ['6', 'Últimos 6 meses'], ['12', 'Últimos 12 meses']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Select></div>
      </div></Card>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <IndicadorCard titulo="Total faturado" valor={brl(f.total)} detalhe={`${f.qtdNotas} nota(s)`} icon="Landmark" definicao="Soma das notas fiscais das competências selecionadas (todas as situações)." fonte="Central de notas fiscais" />
        <IndicadorCard titulo="Pago" valor={brl(f.pago)} icon="BadgeCheck" tone="success" definicao="Notas com pagamento registrado." fonte="Central de notas fiscais" />
        <IndicadorCard titulo="A pagar" valor={brl(f.aPagar)} icon="Wallet" tone="warning" definicao="Notas aprovadas ou aguardando pagamento." fonte="Central de notas fiscais" />
        <IndicadorCard titulo="Em análise" valor={brl(f.emAnalise)} icon="Send" tone="brand" definicao="Notas enviadas aguardando aprovação." fonte="Central de notas fiscais" />
        <IndicadorCard titulo="Reembolsos" valor={brl(f.reembolsos)} detalhe={`${brl(f.reembolsosPagos)} pagos`} icon="ReceiptText" tone="ink" definicao="Reembolsos não recusados com data de despesa nas competências." fonte="Central de reembolsos" />
      </div>
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Card><CardHead title="Por área" /><div className="p-5"><BarList itens={f.porArea.map((a) => ({ rotulo: a.rotulo, valor: Math.round(a.valor), cor: a.cor, sufixo: '' }))} /></div></Card>
        <Card><CardHead title="Por competência" />
          <Tabela minWidth={480}>
            <thead><tr><th className={TH}>Competência</th><th className={TH}>Total</th><th className={TH}>Pago</th><th className={TH}>Pendente</th></tr></thead>
            <tbody>{porComp.map((x) => <tr key={x.c}><td className={TD}><span className="capitalize">{mesLabel(x.c)}</span></td><td className={TD}>{brl(x.total)}</td><td className={TD}>{brl(x.pago)}</td><td className={TD}>{brl(x.total - x.pago)}</td></tr>)}</tbody>
          </Tabela>
        </Card>
      </div>
      <Card>
        <CardHead title="Por prestador" />
        {porPessoa.length === 0 ? <EmptyState icon="FileText" title="Nenhuma nota nas competências" /> : (
          <Tabela minWidth={560}>
            <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Área</th><th className={TH}>Total</th><th className={TH}>Notas</th></tr></thead>
            <tbody>{porPessoa.map(([id, v]) => <tr key={id}><td className={TD}><Link to={`/rh/pessoas/${id}`} className="font-semibold text-ink hover:text-brand">{s.nomeDe(id)}</Link></td><td className={TD}>{s.setorNome(s.pessoa(id)?.setorId)}</td><td className={TD}><b>{brl(v)}</b></td><td className={TD}><div className="flex flex-wrap gap-1">{f.notas.filter((n) => n.colaboradorId === id).map((n) => <Badge key={n.id} tone={STATUS_SOLIC[n.status].tone}>{n.competencia.slice(5)}/{n.competencia.slice(2, 4)}</Badge>)}</div></td></tr>)}</tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
