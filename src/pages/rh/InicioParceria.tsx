import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { AvaliacaoInicio, ConfigAvaliacaoInicio, Regime } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, EmptyState, Select, Toggle, Callout, Tabela, TH, TD, IndicadorCard, ColunasMensais, SearchBox } from '@/components/ui'
import { DonutChart, RadialGauge } from '@/components/charts'
import { BotaoImprimir } from '@/components/inputs'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'
import { hojeISO, somarDias, diasEntre } from '@/domain/datas'
import { MARCOS_OPCOES } from '@/domain/avaliacoes'
import { serie12Meses } from '@/domain/metricas'
import { ResponderInicioModal } from '../Avaliacoes'

const CONT = { seguir: { label: 'Seguir como combinado', cor: '#0f9d6b' }, ajustar: { label: 'Ajustar combinados', cor: '#c98a12' }, revisar: { label: 'Conversa com o RH', cor: '#d8433b' } }

export default function InicioParceria() {
  const s = useStore()
  const hoje = hojeISO()
  const [tab, setTab] = useState('andamento')
  const [meses, setMeses] = useState('6')
  const [marco, setMarco] = useState('')
  const [q, setQ] = useState('')
  const [responder, setResponder] = useState<AvaliacaoInicio | null>(null)

  // Equivale ao cron diário do sistema de RH: gera as pendentes e expira as vencidas ao abrir.
  useEffect(() => { s.sincronizarAvaliacoesInicio() }, [])

  const desde = somarDias(hoje, -Number(meses) * 30)
  const base = useMemo(() => s.avaliacoesInicio
    .filter((a) => a.dataReferencia >= desde)
    .filter((a) => !marco || String(a.marcoDias) === marco)
    .filter((a) => !q.trim() || `${s.nomeDe(a.avaliadoId)} ${s.nomeDe(a.avaliadorId)}`.toLowerCase().includes(q.trim().toLowerCase())), [s, desde, marco, q])
  const andamento = base.filter((a) => a.status === 'pendente' && a.expiraEm >= hoje)
  const pendencias = base.filter((a) => a.status === 'expirada' || (a.status === 'pendente' && a.expiraEm < hoje))
  const respondidas = base.filter((a) => a.status === 'respondida')
  const media = respondidas.length ? Math.round(respondidas.reduce((x, a) => x + (a.nota ?? 0), 0) / respondidas.length) : null

  const Linhas = ({ lista }: { lista: AvaliacaoInicio[] }) => lista.length === 0 ? <EmptyState icon="Sprout" title="Nada por aqui" /> : (
    <Tabela minWidth={820}>
      <thead><tr><th className={TH}>Avaliado(a)</th><th className={TH}>Avaliador(a)</th><th className={TH}>Área · Função</th><th className={TH}>Marco</th><th className={TH}>Prazo</th><th className={TH}>Situação</th><th className={`${TH} no-print`}></th></tr></thead>
      <tbody>
        {lista.sort((a, b) => a.expiraEm.localeCompare(b.expiraEm)).map((a) => (
          <tr key={a.id}>
            <td className={TD}><Link to={`/rh/pessoas/${a.avaliadoId}`} className="font-semibold text-ink hover:text-brand">{s.nomeDe(a.avaliadoId)}</Link></td>
            <td className={TD}>{a.avaliadorId ? s.nomeDe(a.avaliadorId) : <span className="text-danger text-[12px]">Sem responsável</span>}</td>
            <td className={TD}><span className="text-[12.5px]">{s.setorNome(a.setorId)} · {s.cargoNome(a.cargoId)}</span></td>
            <td className={TD}><Badge tone="brand">{a.marcoDias} dias</Badge></td>
            <td className={TD}>{fmtDate(a.expiraEm)}{a.status === 'pendente' && a.expiraEm >= hoje && <div className="text-[11px] text-muted">{diasEntre(hoje, a.expiraEm)} dia(s)</div>}</td>
            <td className={TD}>{a.status === 'respondida' ? <Badge tone="success" dot>Respondida · {a.nota ?? '—'}</Badge> : a.status === 'expirada' || a.expiraEm < hoje ? <Badge tone="danger" dot>Expirada</Badge> : <Badge tone="warning" dot>Pendente</Badge>}</td>
            <td className={`${TD} no-print`}>{a.status === 'pendente' && a.expiraEm >= hoje && <Button size="sm" variant="soft" onClick={() => setResponder(a)}>Responder</Button>}</td>
          </tr>
        ))}
      </tbody>
    </Tabela>
  )

  return (
    <>
      <PageHeader title="Avaliação de início de parceria" subtitle="Acompanhamento estruturado nos primeiros 30, 60 e 90 dias — para alinhar escopo e integração."
        actions={<><BotaoImprimir /><Button variant="ghost" icon="RefreshCw" onClick={() => feedback(s.sincronizarAvaliacoesInicio(), 'Sincronizado.')}>Gerar agora</Button></>} />
      {!s.config.avaliacaoInicio.habilitado && <Callout tone="warning" icon="PowerOff" className="mb-5">A geração automática está desabilitada. Ative em <b>Configurar</b>.</Callout>}
      <div className="flex flex-wrap gap-3 mb-4 no-print">
        <SearchBox value={q} onChange={setQ} placeholder="Avaliado(a) ou avaliador(a)" label="Buscar" />
        <Select label="Intervalo" value={meses} onChange={setMeses}>{['3', '6', '12'].map((m) => <option key={m} value={m}>Últimos {m} meses</option>)}</Select>
        <Select label="Marco" value={marco} onChange={setMarco}><option value="">Todos os marcos</option>{[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} dias</option>)}</Select>
      </div>
      <Tabs tabs={[{ key: 'andamento', label: `Em andamento (${andamento.length})` }, { key: 'pendencias', label: `Pendências (${pendencias.length})` }, { key: 'respondidas', label: `Respondidas (${respondidas.length})` }, { key: 'relatorio', label: 'Relatório de participação' }, { key: 'config', label: 'Configurar' }]} active={tab} onChange={setTab} />

      {tab === 'andamento' && <Card><Linhas lista={andamento} /></Card>}
      {tab === 'pendencias' && <Card><Linhas lista={pendencias} /></Card>}
      {tab === 'respondidas' && <Card><Linhas lista={respondidas} /></Card>}
      {tab === 'relatorio' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <IndicadorCard titulo="Respondidas" valor={`${base.length ? Math.round((respondidas.length / base.length) * 100) : 0}%`} detalhe={`${respondidas.length} de ${base.length}`} icon="CheckCircle2" tone="success" definicao="Avaliações respondidas ÷ geradas no intervalo." fonte="Avaliações de início de parceria" />
            <IndicadorCard titulo="Pendentes" valor={andamento.length} icon="Clock" tone="warning" definicao="Pendentes dentro do prazo." fonte="Avaliações de início de parceria" />
            <IndicadorCard titulo="Expiradas" valor={pendencias.length} icon="AlarmClockOff" tone="danger" definicao="Prazo de resposta vencido sem resposta." fonte="Avaliações de início de parceria" />
            <IndicadorCard titulo="Avaliadores com pendência" valor={new Set([...andamento, ...pendencias].map((a) => a.avaliadorId)).size} icon="UserCog" tone="ink" definicao="Pessoas responsáveis com ao menos uma avaliação pendente ou expirada." fonte="Avaliações de início de parceria" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card><CardHead title="Respondidas por mês" /><div className="p-5"><ColunasMensais dados={serie12Meses(respondidas.map((a) => a.respondidaEm), hoje).slice(-6)} rotulo="Avaliações respondidas por mês" /></div></Card>
            <Card className="flex flex-col"><CardHead title="Nota média" sub="0–100" /><div className="p-5 flex-1 flex items-center justify-center"><RadialGauge valor={media} rotulo={`${respondidas.length} resposta(s)`} tamanho={150} /></div></Card>
            <Card><CardHead title="Encaminhamento" sub="Sinalizado por quem avaliou" /><div className="p-5"><DonutChart titulo="Encaminhamento" dados={(Object.keys(CONT) as (keyof typeof CONT)[]).map((k) => ({ rotulo: CONT[k].label, valor: respondidas.filter((a) => a.continuidade === k).length, cor: CONT[k].cor }))} /></div></Card>
          </div>
        </>
      )}
      {tab === 'config' && <ConfigInicio />}
      {responder && <ResponderInicioModal a={responder} onClose={() => setResponder(null)} />}
    </>
  )
}

function ConfigInicio() {
  const s = useStore()
  const [c, setC] = useState<ConfigAvaliacaoInicio>(s.config.avaliacaoInicio)
  return (
    <Card className="p-5 sm:p-6 max-w-3xl">
      <Toggle checked={c.habilitado} onChange={(v) => setC({ ...c, habilitado: v })} label="Gerar avaliações automaticamente" />
      <fieldset className="mt-5"><legend className="label">Marcos de avaliação</legend>
        <div className="flex flex-wrap gap-2">{MARCOS_OPCOES.map((m) => { const on = m.marcos.join() === c.marcos.join(); return <button key={m.label} type="button" aria-pressed={on} onClick={() => setC({ ...c, marcos: m.marcos })} className={cn('chip', on && 'chip-active')}>{m.label}</button> })}</div>
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-4">
        <Field label="Gerar com antecedência de (dias)" htmlFor="ci-a"><input id="ci-a" type="number" min={0} className="input" value={c.antecedenciaDias} onChange={(e) => setC({ ...c, antecedenciaDias: Number(e.target.value) })} /></Field>
        <Field label="Prazo para responder após o marco (dias)" htmlFor="ci-p"><input id="ci-p" type="number" min={1} className="input" value={c.prazoRespostaDias} onChange={(e) => setC({ ...c, prazoRespostaDias: Number(e.target.value) })} /></Field>
      </div>
      <fieldset className="mb-4"><legend className="label">Formas de contratação (vazio = todas)</legend>
        <div className="flex gap-2">{(['PJ', 'MEI', 'autonomo'] as Regime[]).map((r) => { const on = c.regimes.includes(r); return <button key={r} type="button" aria-pressed={on} onClick={() => setC({ ...c, regimes: on ? c.regimes.filter((x) => x !== r) : [...c.regimes, r] })} className={cn('chip', on && 'chip-active')}>{r === 'autonomo' ? 'Autônomo' : r}</button> })}</div>
      </fieldset>
      <fieldset className="mb-5"><legend className="label">Funções (vazio = todas)</legend>
        <div className="flex flex-wrap gap-1.5">{s.cargos.map((g) => { const on = c.cargoIds.includes(g.id); return <button key={g.id} type="button" aria-pressed={on} onClick={() => setC({ ...c, cargoIds: on ? c.cargoIds.filter((x) => x !== g.id) : [...c.cargoIds, g.id] })} className={cn('chip', on && 'chip-active')}>{g.nome}</button> })}</div>
      </fieldset>
      <Button icon="Check" onClick={() => feedback(s.salvarConfigAvaliacaoInicio(c), 'Configuração salva.')}>Salvar configuração</Button>
      <Callout tone="neutral" icon="Info" className="mt-5">Adaptação do “período de experiência” (conceito CLT) para a prestação de serviços: serve para alinhar escopo e integração nos primeiros meses, sem efeito automático sobre o contrato. As competências avaliadas são as do tipo “Início de parceria”.</Callout>
    </Card>
  )
}
