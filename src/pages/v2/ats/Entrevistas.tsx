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
import { Dropdown } from '@/components/Dropdown'
import { Calendario, type EventoCal } from '@/components/calendario/Calendario'

const COR_STATUS: Record<string, string> = { agendada: '#0032D2', realizada: '#0f9d6b', nao_compareceu: '#db2777', cancelada: '#8b98a2' }

export default function Entrevistas() {
  useTitulo('Entrevistas · 4JURIS Pessoas')
  const [aba, setAba] = useState('agenda')
  const gerenciar = useTem('ats:gerenciar')
  const verAts = useTem('ats:ver')
  const r = useApi<{ itens: any[] }>(`ats/entrevistas${qs({ pendentes: aba === 'pendentes' ? 1 : undefined, status: aba === 'proximas' ? 'agendada' : aba === 'realizadas' ? 'realizada' : undefined })}`)
  const [aberta, setAberta] = useState<any | null>(null)
  const [reg, setReg] = useState<any | null>(null)
  const [reag, setReag] = useState<any | null>(null)
  // "Canceladas e ausências" busca tudo (o filtro de status do servidor aceita um valor só) e separa aqui.
  const lista = (r.dados?.itens ?? []).filter((e) => (aba === 'outras' ? ['cancelada', 'nao_compareceu'].includes(e.status) : aba !== 'proximas' || !e.parecerPendente))

  return (
    <SoComBanco>
      <PageHeader title="Entrevistas" subtitle="Agenda das entrevistas e pareceres que ainda precisam ser registrados." />
      <Tabs active={aba} onChange={setAba} tabs={[{ key: 'agenda', label: 'Agenda' }, { key: 'proximas', label: 'Próximas' }, { key: 'pendentes', label: 'Aguardando resultado' }, { key: 'realizadas', label: 'Realizadas' }, { key: 'outras', label: 'Canceladas e ausências' }]} />
      {aba === 'agenda' ? (
        <Aguardar r={r}>
          {(d) => <Calendario vistaInicial="semana" eventos={d.itens.map((e): EventoCal => ({
            id: e.id, titulo: e.candidatoNome, inicio: e.inicio, fim: e.fim ?? undefined, cor: COR_STATUS[e.status] ?? '#3d4b56',
            subtitulo: `${e.vagaCodigo} · ${e.vagaTitulo} · ${e.modalidade}`, cancelado: e.status === 'cancelada',
          }))} onAbrir={(id) => setAberta(d.itens.find((x) => x.id === id) ?? null)}
            legenda={[{ rotulo: 'Agendada', cor: COR_STATUS.agendada }, { rotulo: 'Realizada', cor: COR_STATUS.realizada }, { rotulo: 'Não compareceu', cor: COR_STATUS.nao_compareceu }, { rotulo: 'Cancelada', cor: COR_STATUS.cancelada }]}
            textoVazio="Nenhuma entrevista neste mês." />}
        </Aguardar>
      ) : (
      <Aguardar r={r} vazio={() => lista.length === 0 ? (
        <Card><EmptyState icon="CalendarClock" title={aba === 'pendentes' ? 'Nenhum parecer pendente' : 'Nenhuma entrevista aqui'} desc="As entrevistas são agendadas no perfil de cada candidato." /></Card>
      ) : null}>
        {() => (
          <div className="space-y-3">
            {lista.map((e) => (
              <Card key={e.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    {verAts ? <Link className="font-bold text-ink hover:text-brand" to={`/recrutamento/candidatos/${e.candidaturaId}`}>{e.candidatoNome}</Link> : <span className="font-bold text-ink">{e.candidatoNome}</span>}
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
      )}
      {aberta && (
        <Modal open onClose={() => setAberta(null)} title={aberta.candidatoNome} subtitle={`${aberta.vagaCodigo} · ${aberta.vagaTitulo}`}
          footer={<>
            {verAts && <Link to={`/recrutamento/candidatos/${aberta.candidaturaId}`}><Button variant="ghost" icon="UserCircle">Ver candidato</Button></Link>}
            {aberta.status === 'agendada' && gerenciar && <Button variant="ghost" onClick={() => { setReag(aberta); setAberta(null) }}>Reagendar</Button>}
            {aberta.status === 'agendada' && (gerenciar || aberta.ehParticipante) && <Button onClick={() => { setReg(aberta); setAberta(null) }}>Registrar resultado</Button>}
          </>}>
          <div className="flex flex-wrap gap-2 mb-3"><StatusBadge mapa={ROTULO_STATUS_ENTREVISTA} valor={aberta.status} />{aberta.parecerPendente && <Badge tone="warning">Aguardando resultado</Badge>}</div>
          <p className="text-[14px] font-semibold text-ink">{dataHoraBR(aberta.inicio)}{aberta.fim ? ` – ${new Date(aberta.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
          <p className="text-[13px] text-ink-2 mt-1">{aberta.modalidade}{aberta.localOuLink ? ` · ${aberta.localOuLink}` : ''}</p>
          <p className="text-[13px] text-muted mt-1">Com {aberta.participantes.map((p: any) => p.nome).join(', ')}</p>
        </Modal>
      )}
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
      <Field label="Situação" htmlFor="er-s"><Dropdown id="er-s" className="input" value={f.status} onChange={(v) => setF({ ...f, status: v.target.value })}><option value="realizada">Realizada</option><option value="nao_compareceu">Candidato não compareceu</option></Dropdown></Field>
      {f.status === 'realizada' && <Field label="Resultado" htmlFor="er-r"><Dropdown id="er-r" className="input" value={f.resultado} onChange={(v) => setF({ ...f, resultado: v.target.value })}><option value="aprovado">Aprovado(a)</option><option value="indeciso">Indeciso</option><option value="reprovado">Reprovado(a)</option></Dropdown></Field>}
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
