import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, StatCard, Badge, Button, Icon, Field } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { brl, fmtDate, STATUS_SOLIC, cn } from '@/lib/utils'
import NotasAdmin from './NotasAdmin'
import { can } from '@/domain/permissions'
import { hojeISO } from '@/domain/datas'
import { MODO_API } from '@/data/config'
import { MinhasNotas } from '@/pages/v2/financeiro/Outros'


/** Página role-aware: admin/RH veem a visão de gestão. O botão "Ver como colaborador"
    ativa o modo de visualização global (papel efetivo vira 'colaborador'). */
export default function Notas() {
  // Com banco: envio com arquivo real, conferência e pagamento pelo servidor. A gestão fica em Gestão de prestadores.
  if (MODO_API) return <MinhasNotas />
  return <NotasDemo />
}

function NotasDemo() {
  const papel = useStore((s) => s.currentUser().papel)
  const setPreview = useStore((s) => s.setPreview)
  const isAdmin = can(papel, 'financeiro:gerenciar')

  if (isAdmin) return <div key="admin"><NotasAdmin onVerColaborador={() => setPreview(true)} /></div>
  return <div key="colab" className="animate-fade-in"><NotasColaborador /></div>
}

const PASSOS = [
  'Acesse o portal do Emissor Nacional e faça login.',
  'Clique em "Nova NFS-e".',
  'Informe o tomador: {TOMADOR}.',
  'Preencha a descrição do serviço e o valor conforme contrato.',
  'Selecione a atividade econômica compatível (ex.: 73.19-0-03 — Marketing direto).',
  'Revise, emita e baixe o PDF.',
  'Anexe e envie a nota aqui pelo sistema até o dia {DIA}.',
]

function NotasColaborador() {
  const user = useStore((s) => s.currentUser())
  const notas = useStore((s) => s.notas.filter((n) => n.colaboradorId === user.id))
  const enviar = useStore((s) => s.enviarNota)
  const mesAtual = hojeISO().slice(0, 7)
  const atual = notas.find((n) => n.competencia === mesAtual)
  const historico = notas.filter((n) => n.competencia !== mesAtual)
  const contrato = useStore((x) => x.contratos.find((k) => k.colaboradorId === user.id && k.status !== 'encerrado'))
  const geral = useStore((x) => x.config.geral)
  const diaEnvio = useStore((x) => x.config.financeiro.diaEnvioNF)
  const passo = (t: string) => t.replace('{TOMADOR}', `${geral.razaoSocialTomador} · CNPJ ${geral.cnpjTomador}`).replace('{DIA}', String(diaEnvio))
  const [envio, setEnvio] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState('')

  const confirmarEnvio = () => {
    if (!envio) return
    if (!arquivo) { toast('Anexe o PDF da nota fiscal.', 'danger'); return }
    enviar(envio); setEnvio(null); setArquivo('')
    toast('Nota fiscal enviada! 🎉 Aguarde a aprovação.')
  }

  return (
    <>
      <PageHeader title="Central de Notas Fiscais" subtitle="Emita, envie e acompanhe suas NF-e para a 4JURIS."
        actions={<a href="https://www.nfse.gov.br/EmissorNacional" target="_blank" rel="noopener"><Button variant="ghost" icon="ExternalLink">Emissor Nacional</Button></a>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="CalendarClock" tone="warning" value="Dia 22" label="Vencimento p/ envio da NF" />
        <StatCard icon="Wallet" tone="success" value="Dia 25" label="Data de pagamento" />
        <StatCard icon="FileCheck2" tone="brand" value={notas.filter((n) => n.status !== 'aguardando').length} label="Notas enviadas" />
        <StatCard icon="Coins" tone="ink" value={brl(contrato?.valorMensal ?? 0)} label="Valor mensal do contrato" />
      </div>

      {/* NF do mês */}
      {atual && (
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <span className="h-12 w-12 rounded-xl bg-brand-50 text-brand flex items-center justify-center"><Icon name="FileText" className="h-6 w-6" /></span>
              <div>
                <div className="text-[15px] font-bold text-ink">Nota fiscal · <span className="capitalize">{new Date(mesAtual + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span></div>
                <div className="text-[13px] text-muted">{brl(atual.valor)} · envie até {fmtDate(atual.prazo)} · pagamento {fmtDate(atual.pagamentoEm)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={STATUS_SOLIC[atual.status].tone} dot>{STATUS_SOLIC[atual.status].label}</Badge>
              {atual.status === 'aguardando'
                ? <Button icon="Upload" onClick={() => { setEnvio(atual.id); setArquivo('') }}>Enviar NF</Button>
                : <Button variant="ghost" icon="Eye" onClick={() => toast('Visualização será conectada ao backend.')}>Ver nota</Button>}
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Coluna esquerda: tutorial + dados de pagamento */}
        <div className="space-y-6">
          {/* Dados de pagamento / PIX */}
          <Card>
            <CardHead title="Dados de pagamento" sub="Sua chave PIX está associada ao CNPJ" />
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <Info label="Razão social" valor={user.razaoSocial || '—'} icon="Building2" />
              <Info label="CNPJ" valor={user.cnpj || '—'} icon="Hash" />
              <Info label="Tipo de chave PIX" valor={user.pixTipo ?? 'CNPJ'} icon="KeyRound" />
              <Info label="Chave PIX" valor={user.pixChave || user.cnpj || '—'} icon="QrCode" destaque />
            </div>
            <div className="px-5 pb-5">
              <div className="bg-success-soft border border-success-line rounded-xl p-3.5 flex gap-3">
                <Icon name="ShieldCheck" className="h-5 w-5 text-success shrink-0" />
                <p className="text-[12.5px] text-success-ink leading-relaxed">O pagamento é feito via PIX para a chave associada ao seu <b>CNPJ</b>. Para alterar, atualize seus dados no perfil ou fale com o RH.</p>
              </div>
            </div>
          </Card>

          {/* Tutorial */}
          <Card>
            <CardHead title="Como emitir sua NF-e" sub="Passo a passo" />
            <div className="p-6">
              <ol className="space-y-4">
                {PASSOS.map((p, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="h-7 w-7 rounded-lg bg-brand text-white text-[12.5px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-[13.5px] text-ink-2 leading-relaxed pt-0.5">{passo(p)}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 bg-brand-50 border border-brand-100 rounded-xl p-4 flex gap-3">
                <Icon name="Info" className="h-5 w-5 text-brand shrink-0" />
                <p className="text-[13px] text-brand-700 leading-relaxed">Em caso de dúvida sobre a atividade econômica, consulte o Financeiro em <b>{geral.emailFinanceiro}</b> antes de emitir.</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Histórico */}
        <Card className="self-start">
          <CardHead title="Histórico de notas" sub="Status: enviada → aprovada → paga" />
          <div className="divide-y divide-line">
            {historico.map((n) => (
              <div key={n.id} className="flex items-center gap-3 p-4">
                <span className="h-9 w-9 rounded-lg bg-winter text-ink flex items-center justify-center shrink-0"><Icon name="FileText" className="h-[17px] w-[17px]" /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-ink capitalize">{new Date(n.competencia + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</div>
                  <div className="text-[12px] text-muted">{brl(n.valor)} · {n.pagaEm ? `paga ${fmtDate(n.pagaEm)}` : `enviada ${fmtDate(n.enviadaEm)}`}</div>
                </div>
                <Badge tone={STATUS_SOLIC[n.status].tone} dot>{STATUS_SOLIC[n.status].label}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Modal enviar NF */}
      <Modal open={!!envio} onClose={() => { setEnvio(null); setArquivo('') }} title="Enviar nota fiscal" subtitle={`Anexe o PDF da NF-e de ${new Date(mesAtual + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.`}
        footer={<><Button variant="ghost" onClick={() => { setEnvio(null); setArquivo('') }}>Cancelar</Button><Button icon="Send" onClick={confirmarEnvio}>Enviar</Button></>}>
        <Field label="Arquivo da NF-e (PDF)" required>
          <label className={cn('flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-7 cursor-pointer transition', arquivo ? 'border-brand bg-brand-50' : 'border-line-strong hover:border-brand hover:bg-brand-50/50')}>
            <Icon name={arquivo ? 'FileCheck2' : 'UploadCloud'} className="h-8 w-8 text-brand" />
            <span className="text-[13px] font-medium text-ink-2">{arquivo || 'Clique para anexar o PDF'}</span>
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0]?.name ?? '')} />
          </label>
        </Field>
      </Modal>
    </>
  )
}

function Info({ label, valor, icon, destaque }: { label: string; valor: string; icon: string; destaque?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-3.5', destaque ? 'border-brand-200 bg-brand-50' : 'border-line')}>
      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-muted uppercase tracking-wide"><Icon name={icon} className="h-3.5 w-3.5" />{label}</div>
      <div className={cn('text-[14px] font-bold mt-1 break-all', destaque ? 'text-brand-700' : 'text-ink')}>{valor}</div>
    </div>
  )
}
