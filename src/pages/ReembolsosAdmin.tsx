import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, StatCard, Badge, Button, Avatar, Icon, Tabs, EmptyState } from '@/components/ui'
import { toast, feedback } from '@/components/toast'
import { ConfirmModal } from '@/components/Modal'
import { brl, fmtDate, STATUS_SOLIC, REEMBOLSO_ETAPAS, cn } from '@/lib/utils'
import type { StatusSolicitacao } from '@/lib/types'

const STATUS_OPCOES: StatusSolicitacao[] = ['pendente', 'aprovado', 'pagamento', 'pago', 'recusado']

function StatusSelect({ value, onChange, className }: { value: StatusSolicitacao; onChange: (v: StatusSolicitacao) => void; className?: string }) {
  const tone = STATUS_SOLIC[value]?.tone ?? 'neutral'
  const toneCls: Record<string, string> = {
    neutral: 'bg-winter text-ink-2 border-line', brand: 'bg-brand-50 text-brand-700 border-brand-200',
    success: 'bg-success-soft text-success border-success-line', warning: 'bg-warning-soft text-warning border-warning-line',
    danger: 'bg-danger-soft text-danger border-danger-line',
  }
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as StatusSolicitacao)}
        className={cn('appearance-none w-full h-9 pl-3 pr-8 rounded-lg border text-[12.5px] font-semibold cursor-pointer outline-none transition focus:ring-1 focus:ring-brand', toneCls[tone])}
      >
        {STATUS_OPCOES.map((st) => <option key={st} value={st}>{STATUS_SOLIC[st].label}</option>)}
      </select>
      <Icon name="ChevronsUpDown" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-60" />
    </div>
  )
}

export default function ReembolsosAdmin({ onVerColaborador }: { onVerColaborador: () => void }) {
  const s = useStore()
  const user = s.currentUser()
  const setStatus = useStore((x) => x.setReembolsoStatus)

  const [view, setView] = useState('kanban')
  const [colabF, setColabF] = useState('todos')
  const [catF, setCatF] = useState('todas')
  const [statusF, setStatusF] = useState('todos')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [excluir, setExcluir] = useState<string | null>(null)

  const colabDe = (id: string) => s.colaboradores.find((c) => c.id === id)
  const nomeDe = (id: string) => colabDe(id)?.nome ?? '—'
  const categorias = Array.from(new Set(s.reembolsos.map((r) => r.categoria)))

  const mudar = (id: string, st: StatusSolicitacao) => { setStatus(id, st, user.id); toast(`Status atualizado: ${STATUS_SOLIC[st].label}.`) }

  const cont = (st: StatusSolicitacao) => s.reembolsos.filter((r) => r.status === st).length
  const somaAPagar = s.reembolsos.filter((r) => r.status === 'aprovado' || r.status === 'pagamento').reduce((a, r) => a + r.valor, 0)
  const somaPago = s.reembolsos.filter((r) => r.status === 'pago').reduce((a, r) => a + r.valor, 0)

  const lista = s.reembolsos
    .filter((r) => colabF === 'todos' || r.colaboradorId === colabF)
    .filter((r) => catF === 'todas' || r.categoria === catF)
    .filter((r) => statusF === 'todos' || r.status === statusF)
    .sort((a, b) => +new Date(b.criadoEm) - +new Date(a.criadoEm))

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Central de Reembolsos"
        subtitle="Visão do administrador — aprove, recuse e acompanhe o pagamento das despesas."
        actions={<Button variant="ink" icon="Eye" onClick={onVerColaborador}>Ver como colaborador</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon="Clock" tone="warning" value={cont('pendente')} label="Pendentes" />
        <StatCard icon="CheckCircle2" tone="success" value={cont('aprovado')} label="Aprovados" />
        <StatCard icon="Landmark" tone="warning" value={brl(somaAPagar)} label="A pagar" />
        <StatCard icon="BadgeCheck" tone="ink" value={brl(somaPago)} label="Pago" />
        <StatCard icon="XCircle" tone="danger" value={cont('recusado')} label="Recusados" />
      </div>

      <Tabs tabs={[{ key: 'kanban', label: 'Kanban' }, { key: 'lista', label: 'Lista' }]} active={view} onChange={setView} />

      {/* KANBAN */}
      {view === 'kanban' && (
        <div className="animate-fade-in">
          <p className="text-[12.5px] text-muted mb-3 flex items-center gap-1.5"><Icon name="MousePointerClick" className="h-4 w-4 text-brand" /> Arraste os reembolsos entre as colunas ou use o seletor de status em cada card.</p>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4 min-w-[1000px]">
              {REEMBOLSO_ETAPAS.map((col) => {
                const cards = s.reembolsos.filter((r) => r.status === col.key)
                const soma = cards.reduce((a, r) => a + r.valor, 0)
                return (
                  <div
                    key={col.key}
                    onDragOver={(e) => { e.preventDefault(); setOver(col.key) }}
                    onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
                    onDrop={() => { setOver(null); if (drag) { mudar(drag, col.key as StatusSolicitacao); setDrag(null) } }}
                    className={cn('flex-1 min-w-[200px] rounded-2xl border bg-surface-2 transition', over === col.key ? 'border-brand bg-brand-50' : 'border-line')}
                  >
                    <div className="flex items-center gap-2 px-3.5 py-3 border-b border-line">
                      <Icon name={col.icon} className="h-[17px] w-[17px] text-muted" />
                      <span className="text-[12.5px] font-bold text-ink">{col.titulo}</span>
                      <span className="ml-auto text-[11px] font-bold text-muted bg-winter rounded-full px-2 py-0.5">{cards.length}</span>
                    </div>
                    <div className="p-3 space-y-2.5 min-h-[120px]">
                      {cards.length === 0 && <p className="text-[11.5px] text-muted-2 text-center py-4">Vazio</p>}
                      {cards.map((r) => {
                        const c = colabDe(r.colaboradorId)
                        return (
                          <div
                            key={r.id}
                            draggable
                            onDragStart={() => setDrag(r.id)}
                            onDragEnd={() => { setDrag(null); setOver(null) }}
                            className={cn('rounded-xl border border-line bg-surface p-3 shadow-xs cursor-grab active:cursor-grabbing hover:shadow-sm transition', drag === r.id && 'opacity-40')}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar nome={c?.nome ?? '?'} cor={c?.avatarCor} size="sm" className="!h-7 !w-7 !text-[10px]" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-semibold text-ink truncate">{c?.nome}</div>
                                <div className="text-[11px] text-muted">{r.categoria}</div>
                              </div>
                            </div>
                            <div className="text-[13px] font-bold text-ink mt-2">{brl(r.valor)}</div>
                            <div className="text-[11.5px] text-muted truncate">{r.descricao}</div>
                            {r.comprovante && <div className="flex items-center gap-1 text-[11px] text-brand mt-1"><Icon name="Paperclip" className="h-3 w-3" />{r.comprovante}</div>}
                            <StatusSelect className="mt-2.5" value={r.status} onChange={(st) => mudar(r.id, st)} />
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
            <select className="input w-auto min-w-[170px]" value={colabF} onChange={(e) => setColabF(e.target.value)}>
              <option value="todos">Todos os colaboradores</option>
              {s.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select className="input w-auto min-w-[160px]" value={catF} onChange={(e) => setCatF(e.target.value)}>
              <option value="todas">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="input w-auto min-w-[150px]" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
              <option value="todos">Todos os status</option>
              {STATUS_OPCOES.map((st) => <option key={st} value={st}>{STATUS_SOLIC[st].label}</option>)}
            </select>
            <span className="ml-auto text-[12.5px] text-muted">{lista.length} solicitação(ões)</span>
          </div>
          <Card>
            {lista.length === 0 ? (
              <EmptyState icon="ReceiptText" title="Nenhum reembolso encontrado" desc="Ajuste os filtros de colaborador, categoria ou status." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px] min-w-[820px]">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-muted bg-surface-2 border-b border-line">
                      <th className="px-5 py-3">Colaborador</th><th className="px-5 py-3">Despesa</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">Comprovante</th><th className="px-5 py-3 w-[200px]">Status</th><th className="px-5 py-3 w-[60px]"><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((r) => {
                      const c = colabDe(r.colaboradorId)
                      return (
                        <tr key={r.id} className="border-b border-line last:border-0 hover:bg-brand-50/40 transition">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar nome={c?.nome ?? '?'} cor={c?.avatarCor} size="sm" />
                              <div><div className="font-semibold text-ink">{c?.nome}</div><div className="text-[11.5px] text-muted">{s.setorNome(c?.setorId ?? '')}</div></div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="text-ink font-medium">{r.descricao}</div>
                            <div className="text-[11.5px] text-muted">{r.categoria} · {fmtDate(r.data)}</div>
                          </td>
                          <td className="px-5 py-3 font-bold text-ink">{brl(r.valor)}</td>
                          <td className="px-5 py-3">
                            {r.comprovante
                              ? <span className="inline-flex items-center gap-1 text-[12px] text-brand"><Icon name="Paperclip" className="h-3.5 w-3.5" />{r.comprovante}</span>
                              : <span className="text-[12px] text-muted-2">—</span>}
                          </td>
                          <td className="px-5 py-3"><StatusSelect value={r.status} onChange={(st) => mudar(r.id, st)} /></td>
                          <td className="px-5 py-3"><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Excluir reembolso ${r.descricao}`} onClick={() => setExcluir(r.id)} /></td>
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
      <ConfirmModal open={!!excluir} onClose={() => setExcluir(null)} titulo="Excluir reembolso?" confirmar="Excluir" texto="A solicitação será apagada definitivamente (fica na auditoria)."
        onConfirm={() => { if (excluir && feedback(s.excluirReembolso(excluir), 'Reembolso excluído.')) setExcluir(null) }} />
    </div>
  )
}
