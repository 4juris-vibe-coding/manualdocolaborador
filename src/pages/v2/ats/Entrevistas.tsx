import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, Badge, Button, EmptyState, Tabs, Field } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { TEXTAREA, useTitulo } from '@/components/v2/ats/comuns'
import { api, executar, qs, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { ROTULO_STATUS_ENTREVISTA } from '@/domain/v2/ats'
import { dataHoraBR } from '@/lib/fmt'

export default function Entrevistas() {
  useTitulo('Entrevistas · 4JURIS Pessoas')
  const [aba, setAba] = useState('proximas')
  const gerenciar = useTem('ats:gerenciar')
  const r = useApi<{ itens: any[] }>(`ats/entrevistas${qs({ pendentes: aba === 'pendentes' ? 1 : undefined, status: aba === 'proximas' ? 'agendada' : aba === 'realizadas' ? 'realizada' : undefined })}`)
  const [reg, setReg] = useState<any | null>(null)
  const [reag, setReag] = useState<any | null>(null)
  const lista = (r.dados?.itens ?? []).filter((e) => aba !== 'proximas' || !e.parecerPendente)

  return (
    <SoComBanco>
      <PageHeader title="Entrevistas" subtitle="Agenda das entrevistas e pareceres que ainda precisam ser registrados." />
      <Tabs active={aba} onChange={setAba} tabs={[{ key: 'proximas', label: 'Próximas' }, { key: 'pendentes', label: 'Aguardando resultado' }, { key: 'realizadas', label: 'Realizadas' }]} />
      <Aguardar r={r} vazio={() => lista.length === 0 ? (
        <Card><EmptyState icon="CalendarClock" title={aba === 'pendentes' ? 'Nenhum parecer pendente' : 'Nenhuma entrevista aqui'} desc="As entrevistas são agendadas no perfil de cada candidato." /></Card>
      ) : null}>
        {() => (
          <div className="space-y-3">
            {lista.map((e) => (
              <Card key={e.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="font-bold text-ink hover:text-brand" to={`/recrutamento/candidatos/${e.candidaturaId}`}>{e.candidatoNome}</Link>
                    <div className="text-[12.5px] text-muted">{e.vagaCodigo} · {e.vagaTitulo}</div>
                    <div className="text-[13.5px] text-ink mt-1.5 font-semibold">{dataHoraBR(e.inicio)} · {e.modalidade}{e.localOuLink ? ` · ${e.localOuLink}` : ''}</div>
                    <div className="text-[12.5px] text-muted">Com {e.participantes.map((p: any) => p.nome).join(', ')}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge mapa={ROTULO_STATUS_ENTREVISTA} valor={e.status} />
                    {e.parecerPendente && <Badge tone="warning">Aguardando resultado</Badge>}
                  </div>
                </div>
                {e.status === 'agendada' && (gerenciar || e.ehParticipante) && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <Button size="sm" variant="soft" onClick={() => setReg(e)}>Registrar resultado</Button>
                    {gerenciar && <Button size="sm" variant="ghost" onClick={() => setReag(e)}>Reagendar</Button>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Aguardar>
      {reg && <Resultado e={reg} onClose={() => setReg(null)} onFeito={() => { setReg(null); r.recarregar() }} />}
      {reag && <Reagendar e={reag} onClose={() => setReag(null)} onFeito={() => { setReag(null); r.recarregar() }} />}
    </SoComBanco>
  )
}

function Resultado({ e, onClose, onFeito }: { e: any; onClose: () => void; onFeito: () => void }) {
  const [f, setF] = useState({ status: 'realizada', resultado: 'aprovado', parecer: '' })
  return (
    <Modal open onClose={onClose} title="Registrar resultado" subtitle={e.candidatoNome}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={async () => { if (await executar(() => api.patch(`ats/entrevistas/${e.id}`, { acao: 'registrar', ...f }), 'Resultado registrado.')) onFeito() }}>Salvar</Button></>}>
      <Field label="Situação" htmlFor="er-s"><select id="er-s" className="input" value={f.status} onChange={(v) => setF({ ...f, status: v.target.value })}><option value="realizada">Realizada</option><option value="nao_compareceu">Candidato não compareceu</option></select></Field>
      {f.status === 'realizada' && <Field label="Resultado" htmlFor="er-r"><select id="er-r" className="input" value={f.resultado} onChange={(v) => setF({ ...f, resultado: v.target.value })}><option value="aprovado">Aprovado(a)</option><option value="indeciso">Indeciso</option><option value="reprovado">Reprovado(a)</option></select></Field>}
      <Field label="Parecer" htmlFor="er-p"><textarea id="er-p" className={TEXTAREA} value={f.parecer} onChange={(v) => setF({ ...f, parecer: v.target.value })} /></Field>
    </Modal>
  )
}

function Reagendar({ e, onClose, onFeito }: { e: any; onClose: () => void; onFeito: () => void }) {
  const [f, setF] = useState({ inicio: '', motivo: '' })
  return (
    <Modal open onClose={onClose} title="Reagendar entrevista" subtitle={e.candidatoNome}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button disabled={!f.inicio || !f.motivo.trim()} onClick={async () => { if (await executar(() => api.patch(`ats/entrevistas/${e.id}`, { acao: 'reagendar', inicio: new Date(f.inicio).toISOString(), motivo: f.motivo }), 'Entrevista reagendada.')) onFeito() }}>Reagendar</Button></>}>
      <Field label="Novo início" required htmlFor="rg-i"><input id="rg-i" type="datetime-local" className="input" value={f.inicio} onChange={(v) => setF({ ...f, inicio: v.target.value })} /></Field>
      <Field label="Motivo" required htmlFor="rg-m" hint="Fica no histórico de reagendamentos."><input id="rg-m" className="input" value={f.motivo} onChange={(v) => setF({ ...f, motivo: v.target.value })} /></Field>
    </Modal>
  )
}
