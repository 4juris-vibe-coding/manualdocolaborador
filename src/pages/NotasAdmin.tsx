import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, StatCard, Badge, Button, Avatar, Icon, Tabs, EmptyState, Field, Progress } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { toast, feedback } from '@/components/toast'
import { brl, fmtDate, STATUS_SOLIC, NF_ETAPAS, cn } from '@/lib/utils'
import type { NotaFiscal, StatusNota } from '@/lib/types'
import { Dropdown } from '@/components/Dropdown'

const mesLabel = (comp: string) => new Date(comp + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const STATUS_OPCOES: StatusNota[] = ['aguardando', 'enviada', 'aprovada', 'pagamento', 'paga']

/** Select de status estilizado, reutilizado no kanban e na lista. */
function StatusSelect({ value, onChange, className }: { value: StatusNota; onChange: (v: StatusNota) => void; className?: string }) {
  const tone = STATUS_SOLIC[value]?.tone ?? 'neutral'
  const toneCls: Record<string, string> = {
    neutral: 'bg-winter text-ink-2 border-line', brand: 'bg-brand-50 text-brand-700 border-brand-200',
    success: 'bg-success-soft text-success border-success-line', warning: 'bg-warning-soft text-warning border-warning-line',
    danger: 'bg-danger-soft text-danger border-danger-line',
  }
  return (
    <div className={cn('relative', className)}>
      <Dropdown
        value={value}
        onChange={(e) => onChange(e.target.value as StatusNota)}
        className={cn('appearance-none w-full h-9 pl-3 pr-8 rounded-lg border text-[12.5px] font-semibold cursor-pointer outline-none transition focus:ring-1 focus:ring-brand', toneCls[tone])}
      >
        {STATUS_OPCOES.map((st) => <option key={st} value={st}>{STATUS_SOLIC[st].label}</option>)}
      </Dropdown>
      <Icon name="ChevronsUpDown" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-60" />
    </div>
  )
}

export default function NotasAdmin({ onVerColaborador }: { onVerColaborador: () => void }) {
  const s = useStore()
  const user = s.currentUser()
  const setNotaStatus = useStore((x) => x.setNotaStatus)
  const addNota = useStore((x) => x.addNota)
  const gerar = useStore((x) => x.gerarNotasCompetencia)

  const competencias = useMemo(() => Array.from(new Set(s.notas.map((n) => n.competencia))).sort().reverse(), [s.notas])
  const [comp, setComp] = useState(() => new Date().toISOString().slice(0, 7))
  const [view, setView] = useState('kanban')
  const [colabF, setColabF] = useState('todos')
  const [statusF, setStatusF] = useState('todos')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [nova, setNova] = useState(false)
  const [excluir, setExcluir] = useState<string | null>(null)

  const nomeDe = (id: string) => s.colaboradores.find((c) => c.id === id)?.nome ?? '—'
  const colabDe = (id: string) => s.colaboradores.find((c) => c.id === id)

  const doComp = s.notas.filter((n) => n.competencia === comp)
  const mudar = (id: string, st: StatusNota) => { setNotaStatus(id, st, user.id); toast(`Status atualizado: ${STATUS_SOLIC[st].label}.`) }

  // Stats da competência
  const cont = (st: StatusNota) => doComp.filter((n) => n.status === st).length
  const somaAPagar = doComp.filter((n) => n.status === 'aprovada' || n.status === 'pagamento').reduce((a, n) => a + n.valor, 0)
  const somaPago = doComp.filter((n) => n.status === 'paga').reduce((a, n) => a + n.valor, 0)

  // Lista
  const listaFiltrada = doComp
    .filter((n) => colabF === 'todos' || n.colaboradorId === colabF)
    .filter((n) => statusF === 'todos' || n.status === statusF)
    .sort((a, b) => nomeDe(a.colaboradorId).localeCompare(nomeDe(b.colaboradorId)))

  // Entregas
  const ativos = s.colaboradores.filter((c) => c.status === 'ativo' || c.status === 'integracao')
  const notaDoColab = (cid: string) => doComp.find((n) => n.colaboradorId === cid)
  const entregou = (cid: string) => { const n = notaDoColab(cid); return !!n && n.status !== 'aguardando' }
  const entregaram = ativos.filter((c) => entregou(c.id))
  const naoEntregaram = ativos.filter((c) => !entregou(c.id))

  const criarNota = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!d.colaboradorId || !d.competencia || !d.valor) { toast('Preencha colaborador, competência e valor.', 'danger'); return }
    const [ano, mes] = d.competencia.split('-')
    addNota({
      colaboradorId: d.colaboradorId, competencia: d.competencia, valor: parseFloat(d.valor.replace(',', '.')) || 0,
      status: 'aguardando', prazo: `${ano}-${mes}-22`, pagamentoEm: `${ano}-${mes}-25`,
    })
    setNova(false)
    toast('Nota criada para o colaborador.')
  }

  const gerarMes = () => {
    const qtd = gerar(comp)
    toast(qtd > 0 ? `${qtd} nota(s) geradas para ${mesLabel(comp)}.` : 'Todos os colaboradores ativos já possuem nota neste mês.', qtd > 0 ? 'success' : 'info')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Central de Notas Fiscais"
        subtitle="Visão do administrador — gerencie, aprove e acompanhe todas as notas."
        actions={
          <>
            <Button variant="ghost" icon="FilePlus2" onClick={gerarMes}>Gerar mês</Button>
            <Button variant="ghost" icon="Plus" onClick={() => setNova(true)}>Nova nota</Button>
            <Button variant="ink" icon="Eye" onClick={onVerColaborador}>Ver como colaborador</Button>
          </>
        }
      />

      {/* Filtro de competência + stats */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-[12.5px] font-semibold text-muted">Competência</span>
        <Dropdown className="input w-auto min-w-[170px] capitalize" value={comp} onChange={(e) => setComp(e.target.value)}>
          {(competencias.includes(comp) ? competencias : [comp, ...competencias]).map((c) => <option key={c} value={c} className="capitalize">{mesLabel(c)}</option>)}
        </Dropdown>
        <span className="ml-auto text-[12.5px] text-muted">{doComp.length} nota(s) em {mesLabel(comp)}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon="FileClock" tone="danger" value={cont('aguardando')} label="Falta enviar" />
        <StatCard icon="Send" tone="brand" value={cont('enviada')} label="Enviadas" />
        <StatCard icon="FileCheck2" tone="success" value={cont('aprovada')} label="Aprovadas" />
        <StatCard icon="Landmark" tone="warning" value={brl(somaAPagar)} label="A pagar" />
        <StatCard icon="BadgeCheck" tone="ink" value={brl(somaPago)} label="Pago" />
      </div>

      <Tabs tabs={[{ key: 'kanban', label: 'Kanban' }, { key: 'lista', label: 'Lista' }, { key: 'entregas', label: 'Entregas' }]} active={view} onChange={setView} />

      {/* KANBAN */}
      {view === 'kanban' && (
        <div className="animate-fade-in">
          <p className="text-[12.5px] text-muted mb-3 flex items-center gap-1.5"><Icon name="MousePointerClick" className="h-4 w-4 text-brand" /> Arraste as notas entre as colunas ou use o seletor de status em cada card.</p>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-[900px]">
              {NF_ETAPAS.map((col) => {
                const cards = doComp.filter((n) => n.status === col.key)
                const soma = cards.reduce((a, n) => a + n.valor, 0)
                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => { e.preventDefault(); setOver(col.key) }}
                    onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
                    onDrop={() => { setOver(null); if (drag) { mudar(drag, col.key as StatusNota); setDrag(null) } }}
                    className={cn('flex-1 min-w-[200px] rounded-2xl border bg-surface-2 transition', over === col.key ? 'border-brand bg-brand-50' : 'border-line')}
                  >
                    <div className="flex items-center gap-2 px-3.5 py-3 border-b border-line">
                      <Icon name={col.icon} className="h-[17px] w-[17px] text-muted" />
                      <span className="text-[12.5px] font-bold text-ink">{col.titulo}</span>
                      <span className="ml-auto text-[11px] font-bold text-muted bg-winter rounded-full px-2 py-0.5">{cards.length}</span>
                    </div>
                    <div className="p-3 space-y-2.5 min-h-[120px]">
                      {cards.length === 0 && <p className="text-[11.5px] text-muted-2 text-center py-4">Vazio</p>}
                      {cards.map((n) => {
                        const c = colabDe(n.colaboradorId)
                        return (
                          <div
                            key={n.id}
                            draggable
                            onDragStart={() => setDrag(n.id)}
                            onDragEnd={() => { setDrag(null); setOver(null) }}
                            className={cn('rounded-xl border border-line bg-surface p-3 shadow-xs cursor-grab active:cursor-grabbing hover:shadow-sm transition', drag === n.id && 'opacity-40')}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar nome={c?.nome ?? '?'} cor={c?.avatarCor} size="sm" className="!h-7 !w-7 !text-[10px]" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-semibold text-ink truncate">{c?.nome}</div>
                                <div className="text-[11px] text-muted">{brl(n.valor)}</div>
                              </div>
                            </div>
                            <StatusSelect className="mt-2.5" value={n.status as StatusNota} onChange={(st) => mudar(n.id, st)} />
                          </div>
                        )
                      })}
                      {cards.length > 0 && <div className="text-[11px] text-muted-2 text-right pt-1">Subtotal: {brl(soma)}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* LISTA */}
      {view === 'lista' && (
        <div className="animate-fade-in">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Dropdown className="input w-auto min-w-[180px]" value={colabF} onChange={(e) => setColabF(e.target.value)}>
              <option value="todos">Todos os colaboradores</option>
              {s.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Dropdown>
            <Dropdown className="input w-auto min-w-[150px]" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos os status</option>
              {STATUS_OPCOES.map((st) => <option key={st} value={st}>{STATUS_SOLIC[st].label}</option>)}
            </Dropdown>
            <span className="ml-auto text-[12.5px] text-muted">{listaFiltrada.length} nota(s)</span>
          </div>
          <Card>
            {listaFiltrada.length === 0 ? (
              <EmptyState icon="FileText" title="Nenhuma nota encontrada" desc="Ajuste os filtros ou gere as notas do mês." />
            ) : (
              <div className="rolagem-x" tabIndex={0} role="region" aria-label="Tabela (role para os lados para ver todas as colunas)">
                <table className="w-full text-[13.5px] min-w-[760px]">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-muted bg-surface-2 border-b border-line">
                      <th className="px-5 py-3">Colaborador</th><th className="px-5 py-3">CNPJ</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Envio / Pagamento</th><th className="px-5 py-3 w-[220px]">Status</th><th className="px-5 py-3 w-[60px]"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaFiltrada.map((n) => {
                      const c = colabDe(n.colaboradorId)
                      return (
                        <tr key={n.id} className="border-b border-line last:border-0 hover:bg-brand-50/40 transition">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar nome={c?.nome ?? '?'} cor={c?.avatarCor} size="sm" />
                              <div><div className="font-semibold text-ink">{c?.nome}</div><div className="text-[11.5px] text-muted">{c?.regime}</div></div>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-ink-2">{c?.cnpj || '—'}</td>
                          <td className="px-5 py-3 font-bold text-ink">{brl(n.valor)}</td>
                          <td className="px-5 py-3 text-ink-2">
                            <div className="text-[12px]">{n.enviadaEm ? `Enviada ${fmtDate(n.enviadaEm)}` : 'Não enviada'}</div>
                            <div className="text-[11.5px] text-muted">{n.pagaEm ? `Paga ${fmtDate(n.pagaEm)}` : `Previsto ${fmtDate(n.pagamentoEm)}`}</div>
                          </td>
                          <td className="px-5 py-3"><StatusSelect value={n.status as StatusNota} onChange={(st) => mudar(n.id, st)} /></td>
                          <td className="px-5 py-3"><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Excluir nota fiscal" onClick={() => setExcluir(n.id)} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ENTREGAS */}
      {view === 'entregas' && (
        <div className="animate-fade-in">
          <Card className="p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13.5px] font-bold text-ink capitalize">Entregas · {mesLabel(comp)}</span>
              <span className="text-[13px] font-bold text-brand">{entregaram.length}/{ativos.length} entregaram</span>
            </div>
            <Progress value={ativos.length ? (entregaram.length / ativos.length) * 100 : 0} className="h-2.5" />
          </Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHead title="Entregaram ✅" sub={`${entregaram.length} colaborador(es)`} />
              <div className="divide-y divide-line">
                {entregaram.length === 0 && <p className="text-[13px] text-muted p-5">Ninguém entregou ainda.</p>}
                {entregaram.map((c) => {
                  const n = notaDoColab(c.id)!
                  return (
                    <div key={c.id} className="flex items-center gap-3 p-4">
                      <Avatar nome={c.nome} cor={c.avatarCor} size="sm" />
                      <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink truncate">{c.nome}</div><div className="text-[11.5px] text-muted">{s.setorNome(c.setorId)}</div></div>
                      <Badge tone={STATUS_SOLIC[n.status].tone} dot>{STATUS_SOLIC[n.status].label}</Badge>
                    </div>
                  )
                })}
              </div>
            </Card>
            <Card>
              <CardHead title="Não entregaram ⏳" sub={`${naoEntregaram.length} colaborador(es)`} action={naoEntregaram.length > 0 ? <Button size="sm" variant="ghost" icon="Bell" onClick={() => toast('Lembrete enviado aos pendentes.')}>Lembrar</Button> : undefined} />
              <div className="divide-y divide-line">
                {naoEntregaram.length === 0 && <p className="text-[13px] text-success p-5 flex items-center gap-2"><Icon name="PartyPopper" className="h-4 w-4" /> Todos entregaram! 🎉</p>}
                {naoEntregaram.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-4">
                    <Avatar nome={c.nome} cor={c.avatarCor} size="sm" />
                    <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink truncate">{c.nome}</div><div className="text-[11.5px] text-muted">{s.setorNome(c.setorId)}</div></div>
                    <Badge tone="danger" dot>Pendente</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal nova nota */}
      <Modal open={nova} onClose={() => setNova(false)} title="Nova nota fiscal" subtitle="Crie uma nota para um colaborador."
        footer={<><Button variant="ghost" onClick={() => setNova(false)}>Cancelar</Button><Button icon="Check" type="submit" form="novaNotaForm">Criar nota</Button></>}>
        <form id="novaNotaForm" onSubmit={criarNota}>
          <Field label="Colaborador" required>
            <Dropdown name="colaboradorId" className="input" defaultValue="" onChange={(e) => {
              const c = colabDe(e.target.value)
              const valorInput = (e.currentTarget.form?.elements.namedItem('valor') as HTMLInputElement | null)
              const k = s.contratos.find((x) => x.colaboradorId === c?.id && x.status !== 'encerrado')
              if (c && k && valorInput && !valorInput.value) valorInput.value = String(k.valorMensal)
            }}>
              <option value="" disabled>Selecione...</option>
              {s.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Dropdown>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Competência" required><input name="competencia" type="month" className="input" defaultValue={comp} /></Field>
            <Field label="Valor (R$)" required><input name="valor" className="input" inputMode="decimal" placeholder="0,00" /></Field>
          </div>
          <p className="text-[12px] text-muted">O prazo de envio (dia 22) e o pagamento (dia 25) são definidos automaticamente pela competência.</p>
        </form>
      </Modal>
      <ConfirmModal open={!!excluir} onClose={() => setExcluir(null)} titulo="Excluir nota fiscal?" confirmar="Excluir" texto="O registro da nota será apagado definitivamente (fica na auditoria)."
        onConfirm={() => { if (excluir && feedback(s.excluirNota(excluir), 'Nota fiscal excluída.')) setExcluir(null) }} />
    </div>
  )
}
