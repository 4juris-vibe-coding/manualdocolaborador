import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, IndicadorCard, ColunasMensais, BarList, Select, Callout, Tabela, TH, TD } from '@/components/ui'
import { BotaoImprimir } from '@/components/inputs'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { rotatividade, serie12Meses } from '@/domain/metricas'

export default function Rotatividade() {
  const s = useStore()
  const hoje = hojeISO()
  const [area, setArea] = useState('')
  const pessoas = s.colaboradores.filter((c) => !area || c.setorId === area)
  const janelas = [30, 90, 365].map((d) => rotatividade(pessoas, hoje, d))
  const ini12 = somarDias(hoje, -365)
  const enc12 = pessoas.filter((c) => c.encerramento && c.encerramento.data > ini12)
  const porArea = s.setores.map((a) => ({ rotulo: a.nome, valor: enc12.filter((c) => c.setorId === a.id).length, cor: a.cor })).filter((x) => x.valor)
  const porMotivo = s.motivosEncerramento.map((m) => ({ rotulo: m.nome, valor: enc12.filter((c) => c.encerramento?.motivoId === m.id).length })).filter((x) => x.valor)
  return (
    <>
      <PageHeader title="Rotatividade de parcerias" subtitle="Novas parcerias, encerramentos e taxa por janela de tempo (portado de Rotatividade do sistema de RH)." actions={<BotaoImprimir />} />
      <div className="flex gap-3 mb-5 no-print"><Select label="Área" value={area} onChange={setArea}><option value="">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {janelas.map((j) => (
          <IndicadorCard key={j.dias} titulo={`Taxa — ${j.dias === 365 ? '12 meses' : `${j.dias} dias`}`} valor={`${j.taxa.toLocaleString('pt-BR')}%`} detalhe={`${j.encerramentos} encerramento(s) · ${j.inicios} início(s) · média ${j.mediaAtivos} ativas`}
            icon="RefreshCw" tone={j.taxa > 10 ? 'warning' : 'brand'} definicao="Encerramentos ÷ ((ativas no início + ativas no fim) ÷ 2) × 100." fonte={`Cadastro de pessoas · ${fmtDate(j.inicio)} a ${fmtDate(j.fim)}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card><CardHead title="Encerramentos por mês" sub="Últimos 12 meses" /><div className="p-5"><ColunasMensais dados={serie12Meses(pessoas.map((c) => c.encerramento?.data), hoje)} rotulo="Encerramentos por mês" /></div></Card>
        <Card><CardHead title="Novas parcerias por mês" sub="Últimos 12 meses" /><div className="p-5"><ColunasMensais dados={serie12Meses(pessoas.map((c) => c.dataEntrada), hoje)} rotulo="Novas parcerias por mês" /></div></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card><CardHead title="Encerramentos por área" sub="12 meses" /><div className="p-5"><BarList itens={porArea} vazio="Nenhum encerramento." /></div></Card>
        <Card><CardHead title="Encerramentos por motivo" sub="12 meses" /><div className="p-5"><BarList itens={porMotivo} vazio="Nenhum encerramento." /></div></Card>
      </div>
      <Card>
        <CardHead title="Janelas detalhadas" />
        <Tabela minWidth={560}>
          <thead><tr><th className={TH}>Janela</th><th className={TH}>Ativas no início</th><th className={TH}>Novas</th><th className={TH}>Encerradas</th><th className={TH}>Média</th><th className={TH}>Taxa</th></tr></thead>
          <tbody>{janelas.map((j) => <tr key={j.dias}><td className={TD}>{fmtDate(j.inicio)} → {fmtDate(j.fim)}</td><td className={TD}>{pessoas.filter((c) => c.dataEntrada <= j.inicio && (!c.encerramento || c.encerramento.data > j.inicio)).length}</td><td className={TD}>{j.inicios}</td><td className={TD}>{j.encerramentos}</td><td className={TD}>{j.mediaAtivos}</td><td className={TD}><b>{j.taxa.toLocaleString('pt-BR')}%</b></td></tr>)}</tbody>
        </Tabela>
      </Card>
      <Callout tone="neutral" icon="Info" className="mt-5">Indicador descritivo. Encerramentos de parceria têm causas diversas (fim de projeto, não renovação, distrato) — veja Métricas de encerramento.</Callout>
    </>
  )
}
