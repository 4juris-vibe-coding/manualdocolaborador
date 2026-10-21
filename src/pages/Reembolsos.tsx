import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, StatCard, Badge, Button, Field, Icon, EmptyState } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { brl, fmtDate, STATUS_SOLIC, cn, podeVerReembolsosView } from '@/lib/utils'
import ReembolsosAdmin from './ReembolsosAdmin'
import { can } from '@/domain/permissions'
import { hojeISO } from '@/domain/datas'

const CATEGORIAS = ['Software & Ferramentas', 'Viagem & Deslocamento', 'Alimentação', 'Material de escritório', 'Cursos & Educação', 'Outros']

/** Página role-aware: admin/RH gerenciam todos os reembolsos; podem ver como colaborador. */
export default function Reembolsos() {
  const papel = useStore((s) => s.currentUser().papel)
  const setPreview = useStore((s) => s.setPreview)
  if (can(papel, 'financeiro:gerenciar')) return <ReembolsosAdmin onVerColaborador={() => setPreview(true)} />
  return <ReembolsosColaborador />
}

function ReembolsosColaborador() {
  const user = useStore((s) => s.currentUser())
  const setores = useStore((s) => s.setores)
  const preview = useStore((s) => s.previewColaborador)
  const reembolsos = useStore((s) => s.reembolsos.filter((r) => r.colaboradorId === user.id))
  const add = useStore((s) => s.addReembolso)
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<string>('')
  const [filtro, setFiltro] = useState('todos')

  if (!podeVerReembolsosView(user, setores, preview)) {
    return (
      <>
        <PageHeader title="Central de Reembolsos" subtitle="Solicite, anexe comprovantes e acompanhe suas despesas." />
        <Card>
          <EmptyState
            icon="Lock"
            title="Acesso restrito às lideranças"
            desc="No seu setor, apenas lideranças podem visualizar e solicitar reembolsos. Fale com a liderança do seu time ou com o RH em caso de dúvida."
          />
        </Card>
      </>
    )
  }

  const total = reembolsos.reduce((a, r) => a + r.valor, 0)
  const pendentes = reembolsos.filter((r) => r.status === 'pendente')
  const aprovados = reembolsos.filter((r) => r.status === 'aprovado' || r.status === 'pagamento' || r.status === 'pago')

  const lista = filtro === 'todos' ? reembolsos : reembolsos.filter((r) => r.status === filtro)

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (!d.categoria || !d.descricao || !d.valor) { toast('Preencha categoria, descrição e valor.', 'danger'); return }
    add({ colaboradorId: user.id, categoria: d.categoria, descricao: d.descricao, valor: parseFloat(d.valor.replace(',', '.')), data: d.data || hojeISO(), comprovante: file || undefined })
    setOpen(false); setFile('')
    toast('Reembolso solicitado! Acompanhe o status abaixo.')
  }

  return (
    <>
      <PageHeader title="Central de Reembolsos" subtitle="Solicite, anexe comprovantes e acompanhe suas despesas."
        actions={<Button icon="Plus" onClick={() => setOpen(true)}>Solicitar reembolso</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="ReceiptText" tone="brand" value={reembolsos.length} label="Solicitações no total" />
        <StatCard icon="Clock" tone="warning" value={pendentes.length} label="Aguardando aprovação" />
        <StatCard icon="CheckCircle2" tone="success" value={aprovados.length} label="Aprovados / pagos" />
        <StatCard icon="Wallet" tone="ink" value={brl(total)} label="Valor total solicitado" />
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {['todos', 'pendente', 'aprovado', 'pagamento', 'pago', 'recusado'].map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={cn('chip capitalize', filtro === f && 'chip-active')}>
            {f === 'todos' ? 'Todos' : STATUS_SOLIC[f].label}
          </button>
        ))}
      </div>

      <Card>
        {lista.length === 0 ? (
          <EmptyState icon="ReceiptText" title="Nenhum reembolso aqui" desc="Solicite seu primeiro reembolso e acompanhe o status em tempo real." action={<Button icon="Plus" onClick={() => setOpen(true)}>Solicitar reembolso</Button>} />
        ) : (
          <div className="divide-y divide-line">
            {lista.map((r) => {
              const st = STATUS_SOLIC[r.status]
              return (
                <div key={r.id} className="flex items-center gap-4 p-4 hover:bg-surface-2 transition">
                  <span className="h-11 w-11 rounded-xl bg-winter text-ink flex items-center justify-center shrink-0"><Icon name="Receipt" className="h-5 w-5" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-ink">{r.descricao}</div>
                    <div className="text-[12.5px] text-muted flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>{r.categoria}</span><span>·</span><span>{fmtDate(r.data)}</span>
                      {r.comprovante && <><span>·</span><span className="inline-flex items-center gap-1 text-brand"><Icon name="Paperclip" className="h-3.5 w-3.5" />{r.comprovante}</span></>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-bold text-ink">{brl(r.valor)}</div>
                    <Badge tone={st.tone} dot>{st.label}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Solicitar reembolso" subtitle="Preencha os dados e anexe o comprovante."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button icon="Send" type="submit" form="reembForm">Enviar solicitação</Button></>}>
        <form id="reembForm" onSubmit={submit}>
          <Field label="Categoria" required>
            <select name="categoria" className="input" defaultValue="">
              <option value="" disabled>Selecione...</option>
              {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Descrição" required><input name="descricao" className="input" placeholder="Ex.: Assinatura de ferramenta" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)" required><input name="valor" className="input" placeholder="0,00" inputMode="decimal" /></Field>
            <Field label="Data da despesa"><input name="data" type="date" className="input" defaultValue={hojeISO()} max={hojeISO()} /></Field>
          </div>
          <Field label="Comprovante / Nota fiscal">
            <label className={cn('flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-6 cursor-pointer transition', file ? 'border-brand bg-brand-50' : 'border-line-strong hover:border-brand hover:bg-brand-50/50')}>
              <Icon name={file ? 'FileCheck2' : 'UploadCloud'} className="h-7 w-7 text-brand" />
              <span className="text-[13px] font-medium text-ink-2">{file || 'Clique para anexar (PDF, JPG, PNG)'}</span>
              <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0]?.name ?? '')} />
            </label>
          </Field>
        </form>
      </Modal>
    </>
  )
}
