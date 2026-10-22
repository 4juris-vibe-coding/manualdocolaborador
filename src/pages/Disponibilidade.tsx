import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { PeriodoIndisponibilidade } from '@/lib/types'
import { PageHeader, Card, CardHead, StatCard, Badge, Button, Icon, EmptyState, Callout, Avatar } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { AgendaTimeline } from '@/components/AgendaTimeline'
import { CalendarioPeriodos } from '@/components/calendario/CalendarioPeriodos'
import { PeriodoForm } from '@/components/PeriodoForm'
import { cn, fmtDate } from '@/lib/utils'
import { diasEntre, hojeISO } from '@/domain/datas'
import { situacaoPeriodo, indisponivelEm } from '@/domain/disponibilidade'

export const STATUS_PERIODO: Record<string, { label: string; tone: string }> = {
  planejado: { label: 'Planejado', tone: 'brand' },
  alinhado: { label: 'Continuidade alinhada', tone: 'success' },
  cancelado: { label: 'Cancelado', tone: 'neutral' },
}
const SITUACAO: Record<string, string> = { futuro: 'Próximo', em_andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' }

export default function Disponibilidade() {
  const s = useStore()
  const me = s.currentUser()
  const hoje = hojeISO()
  const politica = s.config.disponibilidade
  const [form, setForm] = useState<{ aberto: boolean; editar?: PeriodoIndisponibilidade | null }>({ aberto: false })
  const [cancelar, setCancelar] = useState<PeriodoIndisponibilidade | null>(null)
  const [mostrarHistorico, setMostrarHistorico] = useState(false)
  const [formato, setFormato] = useState<'linha' | 'calendario'>('linha')

  const meus = s.periodos.filter((p) => p.colaboradorId === me.id).sort((a, b) => b.inicio.localeCompare(a.inicio))
  const ativosMeus = meus.filter((p) => p.status !== 'cancelado' && p.fim >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio))
  const historico = meus.filter((p) => p.status === 'cancelado' || p.fim < hoje)
  const proximo = ativosMeus[0]
  const area = s.colaboradores.filter((c) => c.setorId === me.setorId && c.status !== 'encerrado')
  const periodosArea = s.periodos.filter((p) => area.some((c) => c.id === p.colaboradorId))
  const foraHoje = area.filter((c) => c.id !== me.id && indisponivelEm(s.periodos, c.id, hoje)).length

  const lista = mostrarHistorico ? historico : ativosMeus

  return (
    <>
      <PageHeader title="Disponibilidade e descanso combinado"
        subtitle="Registre períodos em que você não estará disponível para os projetos e acompanhe a agenda da sua área."
        actions={<Button icon="Plus" onClick={() => setForm({ aberto: true, editar: null })}>Registrar período</Button>} />

      <Callout tone="brand" icon="Handshake" className="mb-6">
        <p>{politica.orientacao}</p>
        <p className="mt-1.5 text-[12.5px] opacity-90">
          Aqui não há saldo de dias, desconto ou aprovação hierárquica: o registro organiza a continuidade das entregas.
          {politica.antecedenciaSugeridaDias > 0 && ` Antecedência sugerida: ${politica.antecedenciaSugeridaDias} dias.`}
          {politica.usarAlinhamento && ' A liderança da área pode registrar quando a continuidade estiver combinada.'}
        </p>
      </Callout>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="CalendarClock" tone="brand" value={proximo ? fmtDate(proximo.inicio, { day: '2-digit', month: 'short' }) : '—'} label={proximo ? `Seu próximo período (${diasEntre(proximo.inicio, proximo.fim) + 1} dia(s))` : 'Nenhum período futuro'} />
        <StatCard icon="CalendarCheck" tone="success" value={ativosMeus.filter((p) => p.status === 'alinhado').length} label="Com continuidade alinhada" />
        <StatCard icon="Clock" tone="warning" value={ativosMeus.filter((p) => p.status === 'planejado').length} label="Planejados (aguardando alinhamento)" />
        <StatCard icon="Users" tone="ink" value={foraHoje} label="Da sua área indisponíveis hoje" />
      </div>

      <Card className="mb-6">
        <CardHead title="Meus períodos" sub={mostrarHistorico ? 'Concluídos e cancelados' : 'Em andamento e próximos'}
          action={<Button size="sm" variant="subtle" icon={mostrarHistorico ? 'CalendarClock' : 'History'} onClick={() => setMostrarHistorico((v) => !v)}>{mostrarHistorico ? 'Ver próximos' : `Histórico (${historico.length})`}</Button>} />
        {lista.length === 0 ? (
          <EmptyState icon="CalendarX2" title={mostrarHistorico ? 'Sem histórico' : 'Nenhum período planejado'}
            desc={mostrarHistorico ? 'Períodos concluídos e cancelados aparecem aqui.' : 'Quando você planejar uma pausa, registre aqui para a área se organizar.'}
            action={!mostrarHistorico ? <Button icon="Plus" onClick={() => setForm({ aberto: true, editar: null })}>Registrar período</Button> : undefined} />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((p) => {
              const st = STATUS_PERIODO[p.status]
              const sit = situacaoPeriodo(p, hoje)
              const editavel = p.status !== 'cancelado' && p.fim >= hoje
              return (
                <li key={p.id} className="p-4 flex gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
                  <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0"><Icon name="Palmtree" className="h-5 w-5" /></span>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-ink">{fmtDate(p.inicio)} → {fmtDate(p.fim)}</span>
                      <span className="text-[12px] text-muted">{diasEntre(p.inicio, p.fim) + 1} dia(s)</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge tone={st.tone} dot>{st.label}</Badge>
                      {p.status !== 'cancelado' && <Badge tone={sit === 'em_andamento' ? 'warning' : 'neutral'}>{SITUACAO[sit]}</Badge>}
                    </div>
                    {p.mensagemEquipe && <p className="text-[12.5px] text-ink-2 mt-2"><Icon name="MessageSquare" className="h-3.5 w-3.5 inline mr-1 text-muted" />{p.mensagemEquipe}</p>}
                    {p.contatoContinuidadeId && <p className="text-[12px] text-muted mt-1">Contato durante o período: <b className="text-ink-2">{s.nomeDe(p.contatoContinuidadeId)}</b></p>}
                    {p.planoContinuidade && <p className="text-[12px] text-muted mt-0.5">Plano: {p.planoContinuidade}</p>}
                    {p.observacaoPrivada && <p className="text-[12px] text-muted mt-0.5"><Icon name="Lock" className="h-3 w-3 inline mr-1" />Observação privada: {p.observacaoPrivada}</p>}
                    {p.status === 'alinhado' && p.alinhadoPorId && <p className="text-[11.5px] text-success mt-1">Alinhado por {s.nomeDe(p.alinhadoPorId)} em {fmtDate(p.alinhadoEm)}</p>}
                  </div>
                  {editavel && (
                    <div className="flex gap-2 items-start">
                      <Button size="sm" variant="ghost" icon="Pencil" onClick={() => setForm({ aberto: true, editar: p })}>Editar</Button>
                      <Button size="sm" variant="subtle" icon="X" onClick={() => setCancelar(p)}>Cancelar</Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead title={`Agenda da área · ${s.setorNome(me.setorId)}`} sub={formato === 'linha' ? 'Próximas 6 semanas. Mostra apenas datas e status — observações privadas não aparecem.' : 'Mês a mês. Mostra apenas datas e status — observações privadas não aparecem.'}
          action={<div className="inline-flex rounded-xl bg-surface-2 border border-line p-0.5" role="group" aria-label="Formato da agenda">
            {([['linha', 'Linha do tempo', 'CalendarRange'], ['calendario', 'Calendário', 'CalendarDays']] as const).map(([k, rot, ic]) => (
              <button key={k} type="button" aria-pressed={formato === k} onClick={() => setFormato(k)}
                className={cn('h-8 px-2.5 rounded-[10px] text-[12.5px] font-semibold flex items-center gap-1.5 transition outline-none focus-visible:ring-2 focus-visible:ring-brand', formato === k ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink')}>
                <Icon name={ic} className="h-4 w-4" /><span className="hidden sm:inline">{rot}</span>
              </button>
            ))}
          </div>} />
        {formato === 'linha'
          ? <AgendaTimeline pessoas={area} periodos={periodosArea} inicio={hoje} vazio="Ninguém da sua área registrou indisponibilidade nas próximas semanas." />
          : <CalendarioPeriodos pessoas={area} periodos={periodosArea} textoVazio="Ninguém da sua área indisponível neste mês." />}
        {area.filter((c) => c.id !== me.id).some((c) => periodosArea.some((p) => p.colaboradorId === c.id && p.status !== 'cancelado' && p.fim >= hoje && p.mensagemEquipe)) && (
          <div className="border-t border-line p-4 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Mensagens para a equipe</div>
            {periodosArea.filter((p) => p.colaboradorId !== me.id && p.status !== 'cancelado' && p.fim >= hoje && p.mensagemEquipe).map((p) => {
              const c = s.pessoa(p.colaboradorId)!
              return (
                <div key={p.id} className="flex items-start gap-2.5">
                  <Avatar nome={c.nome} cor={c.avatarCor} size="sm" className="!h-7 !w-7 !text-[10px]" />
                  <p className="text-[12.5px] text-ink-2"><b>{c.nome.split(' ')[0]}</b> ({fmtDate(p.inicio, { day: '2-digit', month: 'short' })} → {fmtDate(p.fim, { day: '2-digit', month: 'short' })}): {p.mensagemEquipe}</p>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {form.aberto && <PeriodoForm open onClose={() => setForm({ aberto: false })} editar={form.editar} />}
      <ConfirmModal open={!!cancelar} onClose={() => setCancelar(null)} titulo="Cancelar período?" confirmar="Cancelar período"
        texto={cancelar ? `O período de ${fmtDate(cancelar.inicio)} a ${fmtDate(cancelar.fim)} será marcado como cancelado e deixará de aparecer na agenda da área.` : ''}
        onConfirm={() => { if (cancelar && feedback(s.cancelarPeriodo(cancelar.id), 'Período cancelado.')) setCancelar(null) }} />
    </>
  )
}
