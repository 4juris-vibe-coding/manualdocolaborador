import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { ChecklistItemModelo, ChecklistModelo, ResponsavelItem, TipoJornada } from '@/lib/types'
import { PageHeader, Card, CardHead, Badge, Button, Avatar, Tabs, EmptyState, Field, Progress, Icon } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { fmtDate, uid } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { progresso, prazoItem, RESPONSAVEL_LABEL_ADMIN } from '@/domain/jornada'
import { Dropdown } from '@/components/Dropdown'

export default function Jornadas() {
  const s = useStore()
  const hoje = hojeISO()
  const [tab, setTab] = useState('andamento')
  const [tipo, setTipo] = useState<'todos' | TipoJornada>('todos')
  const [iniciar, setIniciar] = useState(false)
  const [modelo, setModelo] = useState<{ aberto: boolean; m?: ChecklistModelo }>({ aberto: false })
  const [remover, setRemover] = useState<ChecklistModelo | null>(null)

  const procs = s.processos.filter((p) => (tab === 'andamento' ? !p.concluidoEm : !!p.concluidoEm) && (tipo === 'todos' || p.tipo === tipo))
    .sort((a, b) => b.iniciadoEm.localeCompare(a.iniciadoEm))

  return (
    <>
      <PageHeader title="Integração & encerramento" subtitle="Checklists configuráveis e acompanhamento por pessoa — com quem faz o quê."
        actions={<><Button variant="ghost" icon="Plus" onClick={() => setModelo({ aberto: true })}>Novo checklist</Button><Button icon="Play" onClick={() => setIniciar(true)}>Iniciar processo</Button></>} />
      <Tabs tabs={[
        { key: 'andamento', label: `Em andamento (${s.processos.filter((p) => !p.concluidoEm).length})` },
        { key: 'concluidos', label: 'Concluídos' },
        { key: 'modelos', label: `Checklists (${s.checklists.length})` },
      ]} active={tab} onChange={setTab} />

      {tab !== 'modelos' && (
        <>
          <div className="flex gap-1.5 mb-4" role="group" aria-label="Tipo">
            {(['todos', 'integracao', 'encerramento'] as const).map((t) => <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)} className={`chip ${tipo === t ? 'chip-active' : ''}`}>{t === 'todos' ? 'Todos' : t === 'integracao' ? 'Integração' : 'Encerramento'}</button>)}
          </div>
          {procs.length === 0 ? <Card><EmptyState icon="ListChecks" title="Nenhum processo" desc={tab === 'andamento' ? 'Inicie a integração de uma nova parceria.' : 'Processos concluídos aparecem aqui.'} /></Card> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {procs.map((p) => {
                const c = s.pessoa(p.colaboradorId)
                const pr = progresso(p)
                const pend = (r: ResponsavelItem) => p.itens.filter((i) => !i.feito && i.responsavel === r).length
                const atrasados = p.itens.filter((i) => !i.feito && prazoItem(p, i.prazoDias) && prazoItem(p, i.prazoDias)! < hoje).length
                return (
                  <Card key={p.id} className="p-5">
                    <div className="flex items-center gap-3">
                      <Avatar pessoaId={c?.id} nome={c?.nome ?? '?'} cor={c?.avatarCor} size="md" />
                      <div className="flex-1 min-w-0">
                        <Link to={`/rh/pessoas/${p.colaboradorId}`} className="text-[14px] font-semibold text-ink hover:text-brand">{c?.nome ?? '—'}</Link>
                        <div className="text-[12px] text-muted">{p.tipo === 'integracao' ? 'Integração' : 'Encerramento'} · desde {fmtDate(p.iniciadoEm)}</div>
                      </div>
                      <span className="text-[18px] font-extrabold text-ink">{pr.percentual}%</span>
                    </div>
                    <Progress value={pr.percentual} className="mt-4" />
                    <div className="flex flex-wrap gap-2 mt-3 text-[11.5px]">
                      {(['pessoa', 'lideranca', 'rh'] as const).map((r) => pend(r) > 0 && <Badge key={r} tone="neutral">{pend(r)} com {RESPONSAVEL_LABEL_ADMIN[r]}</Badge>)}
                      {atrasados > 0 && <Badge tone="warning">{atrasados} após prazo sugerido</Badge>}
                      {p.concluidoEm && <Badge tone="success" dot>Concluído em {fmtDate(p.concluidoEm)}</Badge>}
                    </div>
                    {!p.concluidoEm && (
                      <ul className="mt-3 space-y-1">
                        {p.itens.filter((i) => !i.feito && i.responsavel === 'rh').map((i) => (
                          <li key={i.id}><label className="flex items-center gap-2 text-[12.5px] cursor-pointer"><input type="checkbox" className="h-4 w-4 accent-brand" onChange={() => feedback(s.marcarItemJornada(p.id, i.id, true), 'Item concluído.')} />{i.titulo}</label></li>
                        ))}
                      </ul>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'modelos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {s.checklists.map((m) => (
            <Card key={m.id}>
              <CardHead title={m.nome} sub={`${m.tipo === 'integracao' ? 'Integração' : 'Encerramento'} · ${m.itens.length} itens`}
                action={<div className="flex gap-1"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar checklist" onClick={() => setModelo({ aberto: true, m })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover checklist" onClick={() => setRemover(m)} /></div>} />
              <ol className="p-4 space-y-1.5">
                {m.itens.map((i, n) => <li key={i.id} className="flex gap-2 text-[13px]"><span className="text-muted w-5 shrink-0">{n + 1}.</span><span className="flex-1 text-ink-2">{i.titulo}</span><Badge tone="neutral">{RESPONSAVEL_LABEL_ADMIN[i.responsavel]}{i.prazoDias != null ? ` · ${i.prazoDias}d` : ''}</Badge></li>)}
              </ol>
            </Card>
          ))}
        </div>
      )}

      {iniciar && <IniciarModal onClose={() => setIniciar(false)} />}
      {modelo.aberto && <ModeloModal m={modelo.m} onClose={() => setModelo({ aberto: false })} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover checklist?" confirmar="Remover" texto={remover ? `"${remover.nome}" deixará de estar disponível para novos processos.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerChecklistModelo(remover.id), 'Checklist removido.')) setRemover(null) }} />
    </>
  )
}

function IniciarModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [pessoa, setPessoa] = useState('')
  const [modelo, setModelo] = useState(s.checklists[0]?.id ?? '')
  return (
    <Modal open onClose={onClose} title="Iniciar processo" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Play" onClick={() => { if (!pessoa) { feedback({ ok: false, erro: 'Escolha a pessoa.' }, ''); return } if (feedback(s.iniciarJornada(pessoa, modelo), 'Processo iniciado.')) onClose() }}>Iniciar</Button></>}>
      <Field label="Pessoa" required htmlFor="ij-p"><Dropdown id="ij-p" className="input" value={pessoa} onChange={(e) => setPessoa(e.target.value)}><option value="">Selecione…</option>{s.colaboradores.filter((c) => c.status !== 'encerrado').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Dropdown></Field>
      <Field label="Checklist" htmlFor="ij-m"><Dropdown id="ij-m" className="input" value={modelo} onChange={(e) => setModelo(e.target.value)}>{s.checklists.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Dropdown></Field>
    </Modal>
  )
}

function ModeloModal({ m, onClose }: { m?: ChecklistModelo; onClose: () => void }) {
  const s = useStore()
  const [nome, setNome] = useState(m?.nome ?? '')
  const [tipo, setTipo] = useState<TipoJornada>(m?.tipo ?? 'integracao')
  const [itens, setItens] = useState<ChecklistItemModelo[]>(m?.itens ?? [{ id: uid('ci'), titulo: '', responsavel: 'rh', prazoDias: 0 }])
  const upd = (id: string, p: Partial<ChecklistItemModelo>) => setItens((x) => x.map((i) => (i.id === id ? { ...i, ...p } : i)))
  const mover = (idx: number, d: number) => setItens((x) => { const y = [...x]; const [it] = y.splice(idx, 1); y.splice(Math.max(0, Math.min(y.length, idx + d)), 0, it); return y })
  return (
    <Modal open onClose={onClose} wide title={m ? 'Editar checklist' : 'Novo checklist'} subtitle="Alterações valem para novos processos; os em andamento mantêm os itens originais."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" onClick={() => { if (feedback(s.salvarChecklistModelo({ nome: nome.trim(), tipo, itens: itens.map((i) => ({ ...i, titulo: i.titulo.trim() })) }, m?.id), 'Checklist salvo.')) onClose() }}>Salvar</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-x-4">
        <Field label="Nome" required htmlFor="cm-n"><input id="cm-n" className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
        <Field label="Tipo" htmlFor="cm-t"><Dropdown id="cm-t" className="input" value={tipo} onChange={(e) => setTipo(e.target.value as TipoJornada)}><option value="integracao">Integração</option><option value="encerramento">Encerramento</option></Dropdown></Field>
      </div>
      <fieldset>
        <legend className="label">Itens</legend>
        <ul className="space-y-2">
          {itens.map((i, idx) => (
            <li key={i.id} className="grid grid-cols-[1fr_130px_80px_auto] gap-2 items-center">
              <input aria-label={`Título do item ${idx + 1}`} className="input" value={i.titulo} onChange={(e) => upd(i.id, { titulo: e.target.value })} placeholder="Descrição do passo" />
              <Dropdown aria-label="Responsável" className="input" value={i.responsavel} onChange={(e) => upd(i.id, { responsavel: e.target.value as ResponsavelItem })}>{(['pessoa', 'lideranca', 'rh'] as const).map((r) => <option key={r} value={r}>{RESPONSAVEL_LABEL_ADMIN[r]}</option>)}</Dropdown>
              <input aria-label="Prazo em dias" type="number" min={0} className="input" value={i.prazoDias ?? ''} onChange={(e) => upd(i.id, { prazoDias: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="dias" />
              <div className="flex">
                <Button size="icon-sm" variant="subtle" icon="ArrowUp" aria-label="Mover para cima" disabled={idx === 0} onClick={() => mover(idx, -1)} />
                <Button size="icon-sm" variant="subtle" icon="X" aria-label="Remover item" onClick={() => setItens((x) => x.filter((y) => y.id !== i.id))} />
              </div>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="soft" icon="Plus" className="mt-3" onClick={() => setItens((x) => [...x, { id: uid('ci'), titulo: '', responsavel: 'pessoa' }])}>Adicionar item</Button>
        <p className="text-[11.5px] text-muted mt-2"><Icon name="Info" className="h-3.5 w-3.5 inline mr-1" />Prazo = dias sugeridos a partir do início do processo (opcional).</p>
      </fieldset>
    </Modal>
  )
}
