import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { PoliticaDisponibilidade } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Toggle, Select, Badge, Callout, Tabela, TH, TD, Icon } from '@/components/ui'
import { feedback, toast } from '@/components/toast'
import { AgendaTimeline } from '@/components/AgendaTimeline'
import { CalendarioPeriodos } from '@/components/calendario/CalendarioPeriodos'
import { cn } from '@/lib/utils'
import { STATUS_PERIODO } from '../Disponibilidade'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias, diasEntre } from '@/domain/datas'
import { sobreposicoesNaArea } from '@/domain/disponibilidade'
import { gerarCSV, baixarArquivo } from '@/domain/csv'

export default function AgendaDisponibilidade() {
  const s = useStore()
  const hoje = hojeISO()
  const [setor, setSetor] = useState('todos')
  const [inicio, setInicio] = useState(hoje)
  const [pol, setPol] = useState<PoliticaDisponibilidade>(s.config.disponibilidade)
  const [formato, setFormato] = useState<'linha' | 'calendario'>('linha')
  const pessoas = s.colaboradores.filter((c) => c.status !== 'encerrado' && (setor === 'todos' || c.setorId === setor)).sort((a, b) => a.setorId.localeCompare(b.setorId) || a.nome.localeCompare(b.nome))
  const ids = new Set(pessoas.map((c) => c.id))
  const fimJanela = somarDias(inicio, 41)
  const periodos = s.periodos.filter((p) => ids.has(p.colaboradorId))
  const lista = periodos.filter((p) => p.status !== 'cancelado' && p.fim >= inicio && p.inicio <= somarDias(inicio, 120)).sort((a, b) => a.inicio.localeCompare(b.inicio))

  const exportar = () => {
    baixarArquivo(gerarCSV(lista, [
      { titulo: 'Pessoa', valor: (p) => s.nomeDe(p.colaboradorId) }, { titulo: 'Área', valor: (p) => s.setorNome(s.pessoa(p.colaboradorId)?.setorId) },
      { titulo: 'Início', valor: (p) => p.inicio }, { titulo: 'Fim', valor: (p) => p.fim }, { titulo: 'Dias corridos', valor: (p) => diasEntre(p.inicio, p.fim) + 1 },
      { titulo: 'Situação', valor: (p) => STATUS_PERIODO[p.status].label }, { titulo: 'Contato de continuidade', valor: (p) => (p.contatoContinuidadeId ? s.nomeDe(p.contatoContinuidadeId) : '') },
    ], [`Agenda de disponibilidade — ${fmtDate(inicio)} em diante (120 dias)`, `Área: ${setor === 'todos' ? 'todas' : s.setorNome(setor)}`, 'Observações privadas não são exportadas.']), `disponibilidade-${inicio}.csv`)
    toast('Agenda exportada.')
  }

  return (
    <>
      <PageHeader title="Agenda de disponibilidade" subtitle="Visão geral para coordenação de entregas e configuração da política da empresa."
        actions={<Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button>} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3 p-4 border-b border-line">
          <div><span className="label">Área</span><Select label="Área" value={setor} onChange={setSetor}><option value="todos">Todas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></div>
          <div><label className="label" htmlFor="ag-ini">A partir de</label><input id="ag-ini" type="date" className="input w-auto" value={inicio} onChange={(e) => setInicio(e.target.value || hoje)} /></div>
          <div className="flex gap-1 pb-0.5">
            <Button size="sm" variant="ghost" icon="ChevronLeft" onClick={() => setInicio(somarDias(inicio, -42))}>6 sem.</Button>
            <Button size="sm" variant="ghost" onClick={() => setInicio(hoje)}>Hoje</Button>
            <Button size="sm" variant="ghost" onClick={() => setInicio(somarDias(inicio, 42))}>6 sem. →</Button>
          </div>
          <span className="text-[12px] text-muted ml-auto pb-3">{formato === 'linha' && <>{fmtDate(inicio)} → {fmtDate(fimJanela)}</>}</span>
          <div className="pb-0.5"><div className="inline-flex rounded-xl bg-surface-2 border border-line p-0.5" role="group" aria-label="Formato da agenda">
            {([['linha', 'Linha do tempo', 'CalendarRange'], ['calendario', 'Calendário', 'CalendarDays']] as const).map(([k, rot, ic]) => (
              <button key={k} type="button" aria-pressed={formato === k} onClick={() => setFormato(k)}
                className={cn('h-8 px-2.5 rounded-[10px] text-[12.5px] font-semibold flex items-center gap-1.5 transition outline-none focus-visible:ring-2 focus-visible:ring-brand', formato === k ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink')}>
                <Icon name={ic} className="h-4 w-4" /><span className="hidden sm:inline">{rot}</span>
              </button>
            ))}
          </div></div>
        </div>
        {formato === 'linha' ? <AgendaTimeline pessoas={pessoas} periodos={periodos} inicio={inicio} /> : <CalendarioPeriodos pessoas={pessoas} periodos={periodos} />}
      </Card>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 [&>*]:min-w-0">
        <Card>
          <CardHead title="Próximos períodos" sub="120 dias a partir da data escolhida" />
          {lista.length === 0 ? <p className="text-[13px] text-muted p-5">Nenhum período no intervalo.</p> : (
            <Tabela minWidth={620}>
              <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Período</th><th className={TH}>Situação</th><th className={TH}>Sobreposição</th></tr></thead>
              <tbody>
                {lista.map((p) => {
                  const c = s.pessoa(p.colaboradorId)!
                  const sob = sobreposicoesNaArea(p.inicio, p.fim, c.id, c.setorId, s.periodos, (id) => s.pessoa(id)?.setorId)
                  return (
                    <tr key={p.id}>
                      <td className={TD}><div className="font-semibold text-ink">{c.nome}</div><div className="text-[11.5px] text-muted">{s.setorNome(c.setorId)}</div></td>
                      <td className={TD}>{fmtDate(p.inicio, { day: '2-digit', month: 'short' })} → {fmtDate(p.fim, { day: '2-digit', month: 'short' })} <span className="text-muted">({diasEntre(p.inicio, p.fim) + 1} d)</span></td>
                      <td className={TD}><Badge tone={STATUS_PERIODO[p.status].tone} dot>{STATUS_PERIODO[p.status].label}</Badge></td>
                      <td className={TD}>{sob.length ? <Badge tone="warning">{sob.length} na área</Badge> : <span className="text-muted">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </Tabela>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h3 className="text-[15px] font-bold text-ink">Política de disponibilidade</h3>
          <p className="text-[12.5px] text-muted mt-1 mb-5">Define orientações de planejamento e comunicação. Não há saldo de dias, desconto ou aprovação.</p>
          <Field label="Antecedência sugerida (dias)" hint="Exibida como sugestão; nunca bloqueia o registro." htmlFor="pol-a">
            <input id="pol-a" type="number" min={0} max={180} className="input" value={pol.antecedenciaSugeridaDias} onChange={(e) => setPol({ ...pol, antecedenciaSugeridaDias: Number(e.target.value) })} />
          </Field>
          <div className="space-y-3 mb-4">
            <Toggle checked={pol.usarAlinhamento} onChange={(v) => setPol({ ...pol, usarAlinhamento: v })} label="Lideranças registram o alinhamento de continuidade" />
            <Toggle checked={pol.avisarSobreposicao} onChange={(v) => setPol({ ...pol, avisarSobreposicao: v })} label="Avisar quando houver sobreposição na área" />
          </div>
          <Field label="Orientação exibida a todos" htmlFor="pol-o">
            <textarea id="pol-o" rows={5} className="input !h-auto py-2.5" value={pol.orientacao} onChange={(e) => setPol({ ...pol, orientacao: e.target.value })} />
          </Field>
          <Button icon="Check" onClick={() => feedback(s.salvarPoliticaDisponibilidade(pol), 'Política atualizada.')}>Salvar política</Button>
          <Callout tone="warning" icon="Scale" className="mt-5">Revise a orientação com o jurídico: ela deve refletir o que está previsto nos contratos, sem impor jornada ou controle de horários.</Callout>
        </Card>
      </div>
    </>
  )
}
