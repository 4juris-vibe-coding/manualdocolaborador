import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, IndicadorCard, BarList, Tabela, TH, TD, EmptyState } from '@/components/ui'
import { DonutChart } from '@/components/charts'
import { BotaoImprimir } from '@/components/inputs'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias, tempoParceria } from '@/domain/datas'
import { metricasEncerramento } from '@/domain/metricas'

export default function Encerramentos() {
  const s = useStore()
  const hoje = hojeISO()
  const [ini, setIni] = useState(somarDias(hoje, -365))
  const [fim, setFim] = useState(hoje)
  const m = metricasEncerramento(s, s.colaboradores, ini, fim)
  return (
    <>
      <PageHeader title="Métricas de encerramento" subtitle="Motivos, áreas, iniciativa e duração das parcerias encerradas no período." actions={<BotaoImprimir />} />
      <Card className="p-4 mb-5 no-print"><div className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="me-i">De</label><input id="me-i" type="date" className="input w-auto" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
        <div><label className="label" htmlFor="me-f">Até</label><input id="me-f" type="date" className="input w-auto" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
      </div></Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <IndicadorCard titulo="Encerramentos" valor={m.total} icon="UserMinus" definicao="Parcerias com encerramento registrado no período." fonte="Registros de encerramento" />
        <IndicadorCard titulo="Duração média" valor={m.duracaoMediaDias != null ? `${Math.round(m.duracaoMediaDias / 30.4)} meses` : '—'} icon="Hourglass" tone="ink" definicao="Média do tempo entre o início e o encerramento da parceria." fonte="Cadastro de pessoas" />
        <IndicadorCard titulo="Encerradas antes de 6 meses" valor={m.antesDe6Meses} icon="AlarmClock" tone="warning" definicao="Parcerias encerradas com menos de 183 dias. Pode indicar desalinhamento de escopo na integração." fonte="Cadastro de pessoas" />
        <IndicadorCard titulo="Por iniciativa da prestadora" valor={m.porIniciativa.find((x) => x.rotulo === 'Prestadora')?.valor ?? 0} icon="LogOut" tone="brand" definicao="Encerramentos cujo motivo indica iniciativa da empresa prestadora." fonte="Motivos de encerramento" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        <Card><CardHead title="Iniciativa" /><div className="p-5"><DonutChart titulo="Iniciativa do encerramento" dados={m.porIniciativa} vazio="Sem encerramentos." /></div></Card>
        <Card><CardHead title="Por motivo" /><div className="p-5"><BarList itens={m.porMotivo} vazio="Sem encerramentos." /></div></Card>
        <Card><CardHead title="Por área" /><div className="p-5"><BarList itens={m.porArea} vazio="Sem encerramentos." /></div></Card>
      </div>
      <Card>
        <CardHead title="Parcerias encerradas" />
        {m.lista.length === 0 ? <EmptyState icon="UserMinus" title="Nenhum encerramento no período" /> : (
          <Tabela minWidth={720}>
            <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Área</th><th className={TH}>Início</th><th className={TH}>Encerramento</th><th className={TH}>Duração</th><th className={TH}>Motivo</th></tr></thead>
            <tbody>{m.lista.map((c) => <tr key={c.id}><td className={TD}><Link to={`/rh/pessoas/${c.id}`} className="font-semibold text-ink hover:text-brand">{c.nome}</Link></td><td className={TD}>{s.setorNome(c.setorId)}</td><td className={TD}>{fmtDate(c.dataEntrada)}</td><td className={TD}>{fmtDate(c.encerramento!.data)}</td><td className={TD}>{tempoParceria(c.dataEntrada, c.encerramento!.data)}</td><td className={TD}>{s.motivosEncerramento.find((x) => x.id === c.encerramento!.motivoId)?.nome ?? '—'}</td></tr>)}</tbody>
          </Tabela>
        )}
      </Card>
    </>
  )
}
