import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { ChecklistItemModelo, ChecklistModelo, ProcessoJornada, ResponsavelItem, TipoJornada } from '@/lib/types'
import { PageHeader, Card, CardHead, Badge, Button, Avatar, Tabs, EmptyState, Field, Progress, Icon, SearchBox, Select, Toggle } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { fmtDate, uid, STATUS_COLAB } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { progressoObrigatorio, prazoItem, processoAberto, referenciaDe, RESPONSAVEL_LABEL_ADMIN } from '@/domain/jornada'
import { vinculosDe } from '@/domain/vinculos'
import { Dropdown } from '@/components/Dropdown'
import { Calendario, type EventoCal } from '@/components/calendario/Calendario'
import { PainelPessoaRH } from '@/components/rh/CicloVida'
import { useAtualizacaoAutomatica } from '@/data/sync'

type Visao = 'lista' | 'calendario' | 'cronograma'
const COR = { admissao: '#0f9d6b', encerramento: '#64748b', prazo: '#c98a12', atrasado: '#dc2626', concluido: '#0032D2' }
const TIPO_LABEL: Record<TipoJornada, string> = { integracao: 'Integração', encerramento: 'Encerramento' }

export default function Jornadas() {
  const s = useStore()
  const hoje = hojeISO()
  useAtualizacaoAutomatica()
  const [params, setParams] = useSearchParams()
  const visao = (params.get('visao') as Visao) || 'lista'
  const setVisao = (v: Visao) => { const n = new URLSearchParams(params); n.set('visao', v); setParams(n, { replace: true }) }
  const [tab, setTab] = useState('andamento')
  const [tipo, setTipo] = useState<'todos' | TipoJornada>('todos')
  const [q, setQ] = useState('')
  const [setor, setSetor] = useState('todos')
  const [resp, setResp] = useState<'todos' | ResponsavelItem>('todos')
  const [painel, setPainel] = useState<string | null>(null)
  const [iniciar, setIniciar] = useState(false)
  const [modelo, setModelo] = useState<{ aberto: boolean; m?: ChecklistModelo }>({ aberto: false })
  const [remover, setRemover] = useState<ChecklistModelo | null>(null)

  const pessoaOk = (id: string) => {
    const c = s.pessoa(id)
    if (!c) return false
    if (setor !== 'todos' && c.setorId !== setor) return false
    const t = q.trim().toLowerCase()
    return !t || `${c.nome} ${c.email}`.toLowerCase().includes(t)
  }
  const filtrados = s.processos.filter((p) => (tipo === 'todos' || p.tipo === tipo) && pessoaOk(p.colaboradorId))
  const procs = filtrados.filter((p) => (tab === 'andamento' ? processoAberto(p) : tab === 'concluidos' ? !!p.concluidoEm : !!p.canceladoEm))
    .sort((a, b) => referenciaDe(b, s.pessoa(b.colaboradorId)).localeCompare(referenciaDe(a, s.pessoa(a.colaboradorId))))
  const abertos = s.processos.filter(processoAberto)
  const atrasadosTotal = abertos.reduce((n, p) => n + p.itens.filter((i) => !i.feito && (prazoItem(p, i.prazoDias) ?? '9') < hoje).length, 0)

  return (
    <>
      <PageHeader title="Integração & encerramento" subtitle="Checklists, prazos e movimentações das parcerias — em lista, calendário ou cronograma."
        actions={<><Button variant="ghost" icon="Plus" onClick={() => setModelo({ aberto: true })}>Novo checklist</Button><Button icon="Play" onClick={() => setIniciar(true)}>Iniciar processo</Button></>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Resumo icone="UserPlus" rotulo="Integrações em andamento" valor={abertos.filter((p) => p.tipo === 'integracao').length} />
        <Resumo icone="UserMinus" rotulo="Encerramentos em andamento" valor={abertos.filter((p) => p.tipo === 'encerramento').length} />
        <Resumo icone="AlarmClock" rotulo="Itens após o prazo" valor={atrasadosTotal} alerta={atrasadosTotal > 0} />
        <Resumo icone="CalendarCheck" rotulo="Concluídos nos últimos 30 dias" valor={s.processos.filter((p) => p.concluidoEm && p.concluidoEm >= somarDias(hoje, -30)).length} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-xl border border-line p-0.5 bg-surface" role="tablist" aria-label="Visualização">
          {([['lista', 'List', 'Lista'], ['calendario', 'CalendarDays', 'Calendário'], ['cronograma', 'GanttChart', 'Cronograma']] as const).map(([k, ic, r]) => (
            <button key={k} type="button" role="tab" aria-selected={visao === k} onClick={() => setVisao(k)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${visao === k ? 'bg-brand text-white' : 'text-ink-2 hover:bg-brand-50'}`}><Icon name={ic} className="h-4 w-4" />{r}</button>
          ))}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Buscar pessoa" label="Buscar pessoa" />
        <Select label="Área" value={setor} onChange={setSetor}><option value="todos">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select>
        <div className="flex gap-1.5" role="group" aria-label="Tipo">
          {(['todos', 'integracao', 'encerramento'] as const).map((t) => <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)} className={`chip ${tipo === t ? 'chip-active' : ''}`}>{t === 'todos' ? 'Todos' : TIPO_LABEL[t]}</button>)}
        </div>
      </div>

      {visao === 'lista' && <>
        <Tabs tabs={[
          { key: 'andamento', label: `Em andamento (${filtrados.filter(processoAberto).length})` },
          { key: 'concluidos', label: 'Concluídos' },
          { key: 'cancelados', label: 'Cancelados' },
          { key: 'modelos', label: `Checklists (${s.checklists.length})` },
        ]} active={tab} onChange={setTab} />
        {tab !== 'modelos' && (procs.length === 0
          ? <Card><EmptyState icon="ListChecks" title="Nenhum processo" desc={tab === 'andamento' ? 'Inicie a integração de uma nova parceria.' : 'Nada por aqui com os filtros atuais.'} /></Card>
          : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{procs.map((p) => <CartaoProcesso key={p.id} p={p} onAbrir={() => setPainel(p.colaboradorId)} />)}</div>)}
        {tab === 'modelos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {s.checklists.map((m) => (
              <Card key={m.id}>
                <CardHead title={m.nome} sub={`${TIPO_LABEL[m.tipo]} · ${m.itens.length} itens · ${m.itens.filter((i) => i.obrigatorio !== false).length} obrigatórios`}
                  action={<div className="flex gap-1"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar checklist" onClick={() => setModelo({ aberto: true, m })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover checklist" onClick={() => setRemover(m)} /></div>} />
                <ol className="p-4 space-y-1.5">
                  {m.itens.map((i, n) => <li key={i.id} className="flex gap-2 text-[13px]"><span className="text-muted w-5 shrink-0">{n + 1}.</span><span className="flex-1 text-ink-2">{i.titulo}{i.obrigatorio === false && <span className="text-muted"> (opcional)</span>}</span><Badge tone="neutral">{RESPONSAVEL_LABEL_ADMIN[i.responsavel]}{i.prazoDias != null ? ` · ${i.prazoDias}d` : ''}</Badge></li>)}
                </ol>
              </Card>
            ))}
          </div>
        )}
      </>}

      {visao === 'calendario' && <CalendarioRH tipo={tipo} pessoaOk={pessoaOk} onAbrir={setPainel} />}
      {visao === 'cronograma' && <Cronograma processos={filtrados.filter(processoAberto)} resp={resp} setResp={setResp} onAbrir={setPainel} />}

      {painel && <PainelPessoaRH pessoaId={painel} onClose={() => setPainel(null)} />}
      {iniciar && <IniciarModal onClose={() => setIniciar(false)} />}
      {modelo.aberto && <ModeloModal m={modelo.m} onClose={() => setModelo({ aberto: false })} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover checklist?" confirmar="Remover" texto={remover ? `"${remover.nome}" deixará de estar disponível para novos processos.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerChecklistModelo(remover.id), 'Checklist removido.')) setRemover(null) }} />
    </>
  )
}

function Resumo({ icone, rotulo, valor, alerta }: { icone: string; rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <span className={`grid place-items-center h-10 w-10 rounded-xl ${alerta ? 'bg-warning-soft text-warning-ink' : 'bg-brand-50 text-brand'}`}><Icon name={icone} className="h-5 w-5" /></span>
      <div className="min-w-0"><div className="text-[20px] font-extrabold text-ink leading-none">{valor}</div><div className="text-[11.5px] text-muted mt-1">{rotulo}</div></div>
    </Card>
  )
}

function CartaoProcesso({ p, onAbrir }: { p: ProcessoJornada; onAbrir: () => void }) {
  const s = useStore()
  const hoje = hojeISO()
  const c = s.pessoa(p.colaboradorId)
  const pr = progressoObrigatorio(p)
  const ref = referenciaDe(p, c)
  const aberto = processoAberto(p)
  const pend = (r: ResponsavelItem) => p.itens.filter((i) => !i.feito && i.responsavel === r).length
  const atrasados = p.itens.filter((i) => !i.feito && (prazoItem(p, i.prazoDias) ?? '9') < hoje).length
  const st = c ? STATUS_COLAB[c.status] : undefined
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Avatar pessoaId={c?.id} nome={c?.nome ?? '?'} cor={c?.avatarCor} size="md" />
        <div className="flex-1 min-w-0">
          <button type="button" onClick={onAbrir} className="text-[14px] font-semibold text-ink hover:text-brand text-left truncate max-w-full">{c?.nome ?? 'Cadastro removido'}</button>
          <div className="text-[12px] text-muted">
            {p.tipo === 'integracao' ? `Integração · início da parceria ${fmtDate(ref)}` : `Encerramento em ${fmtDate(ref)}`}
            {p.iniciadoEm !== ref && <> · checklist desde {fmtDate(p.iniciadoEm)}</>}
          </div>
        </div>
        <div className="text-right"><span className="text-[18px] font-extrabold text-ink">{pr.percentual}%</span>{st && <div><Badge tone={st.tone}>{st.label}</Badge></div>}</div>
      </div>
      <Progress value={pr.percentual} className="mt-4" />
      <div className="flex flex-wrap gap-2 mt-3 text-[11.5px]">
        <Badge tone="neutral">{pr.feitos}/{pr.total} obrigatórios</Badge>
        {aberto && (['pessoa', 'lideranca', 'rh'] as const).map((r) => pend(r) > 0 && <Badge key={r} tone="neutral">{pend(r)} com {RESPONSAVEL_LABEL_ADMIN[r]}</Badge>)}
        {aberto && atrasados > 0 && <Badge tone="warning">{atrasados} após prazo sugerido</Badge>}
        {p.concluidoEm && <Badge tone="success" dot>Concluído em {fmtDate(p.concluidoEm)}</Badge>}
        {p.canceladoEm && <Badge tone="neutral">Cancelado em {fmtDate(p.canceladoEm)}{p.motivoCancelamento ? ` · ${p.motivoCancelamento}` : ''}</Badge>}
      </div>
      {aberto && (
        <ul className="mt-3 space-y-1">
          {p.itens.filter((i) => i.responsavel === 'rh').map((i) => (
            <li key={i.id}><label className="flex items-center gap-2 text-[12.5px] cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-brand" checked={i.feito} onChange={(e) => feedback(s.marcarItemJornada(p.id, i.id, e.target.checked), e.target.checked ? 'Item concluído.' : 'Item reaberto.')} />
              <span className={i.feito ? 'line-through text-muted' : ''}>{i.titulo}</span>{i.obrigatorio === false && <span className="text-muted">(opcional)</span>}
            </label></li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onAbrir} className="mt-3 text-[12.5px] font-semibold text-brand hover:underline">Ver detalhes da pessoa</button>
    </Card>
  )
}

/** Calendário de movimentações reais: inícios e encerramentos de parceria (datas efetivas) e prazos dos checklists. */
function CalendarioRH({ tipo, pessoaOk, onAbrir }: { tipo: 'todos' | TipoJornada; pessoaOk: (id: string) => boolean; onAbrir: (pessoaId: string) => void }) {
  const s = useStore()
  const hoje = hojeISO()
  const eventos = useMemo(() => {
    const ev: EventoCal[] = []
    for (const c of s.colaboradores) {
      if (!pessoaOk(c.id)) continue
      for (const v of vinculosDe(c)) {
        if (tipo !== 'encerramento') ev.push({ id: `p:${c.id}:i:${v.id}`, titulo: `Início · ${c.nome}`, inicio: v.inicio, diaInteiro: true, cor: COR.admissao, subtitulo: s.setorNome(c.setorId) })
        if (v.fim && tipo !== 'integracao') ev.push({ id: `p:${c.id}:f:${v.id}`, titulo: `Encerramento · ${c.nome}`, inicio: v.fim, diaInteiro: true, cor: COR.encerramento, subtitulo: s.setorNome(c.setorId) })
      }
    }
    for (const p of s.processos) {
      if (!processoAberto(p) || (tipo !== 'todos' && p.tipo !== tipo) || !pessoaOk(p.colaboradorId)) continue
      for (const i of p.itens) {
        const prazo = prazoItem(p, i.prazoDias)
        if (!prazo || i.feito) continue
        ev.push({ id: `p:${p.colaboradorId}:c:${p.id}:${i.id}`, titulo: `${i.titulo} · ${s.nomeDe(p.colaboradorId)}`, inicio: prazo, diaInteiro: true, cor: prazo < hoje ? COR.atrasado : COR.prazo, subtitulo: `${TIPO_LABEL[p.tipo]} · ${RESPONSAVEL_LABEL_ADMIN[i.responsavel]}` })
      }
    }
    return ev
  }, [s.colaboradores, s.processos, tipo, pessoaOk, hoje]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Calendario eventos={eventos} vistas={['mes', 'semana', 'dia', 'lista']} vistaInicial="mes"
      onAbrir={(id) => onAbrir(id.split(':')[1])}
      legenda={[{ rotulo: 'Início de parceria', cor: COR.admissao }, { rotulo: 'Encerramento', cor: COR.encerramento }, { rotulo: 'Prazo de checklist', cor: COR.prazo }, { rotulo: 'Prazo vencido', cor: COR.atrasado }]}
      textoVazio="Nenhuma movimentação ou prazo neste período." />
  )
}

/** Cronograma de pendências: o que vence quando, com quem — marcado direto daqui. */
function Cronograma({ processos, resp, setResp, onAbrir }: { processos: ProcessoJornada[]; resp: 'todos' | ResponsavelItem; setResp: (r: 'todos' | ResponsavelItem) => void; onAbrir: (pessoaId: string) => void }) {
  const s = useStore()
  const hoje = hojeISO()
  const em7 = somarDias(hoje, 7)
  const linhas = processos.flatMap((p) => p.itens.filter((i) => !i.feito && (resp === 'todos' || i.responsavel === resp)).map((i) => ({ p, i, prazo: prazoItem(p, i.prazoDias) })))
  const grupos: { chave: string; titulo: string; tom: string; itens: typeof linhas }[] = [
    { chave: 'atrasado', titulo: 'Após o prazo', tom: 'text-danger', itens: linhas.filter((l) => l.prazo && l.prazo < hoje) },
    { chave: 'hoje', titulo: 'Hoje', tom: 'text-warning-ink', itens: linhas.filter((l) => l.prazo === hoje) },
    { chave: 'semana', titulo: 'Próximos 7 dias', tom: 'text-ink', itens: linhas.filter((l) => l.prazo && l.prazo > hoje && l.prazo <= em7) },
    { chave: 'depois', titulo: 'Mais adiante', tom: 'text-ink', itens: linhas.filter((l) => l.prazo && l.prazo > em7) },
    { chave: 'sem', titulo: 'Sem prazo definido', tom: 'text-muted', itens: linhas.filter((l) => !l.prazo) },
  ]
  const podeMarcar = s.pode('onboarding:gerenciar')
  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="Responsável">
        {(['todos', 'rh', 'lideranca', 'pessoa'] as const).map((r) => <button key={r} type="button" aria-pressed={resp === r} onClick={() => setResp(r)} className={`chip ${resp === r ? 'chip-active' : ''}`}>{r === 'todos' ? 'Todos os responsáveis' : RESPONSAVEL_LABEL_ADMIN[r]}</button>)}
      </div>
      {linhas.length === 0 ? <Card><EmptyState icon="PartyPopper" title="Nenhuma pendência" desc="Todos os itens dos processos em andamento estão em dia." /></Card> : (
        <div className="space-y-5">{grupos.filter((g) => g.itens.length).map((g) => (
          <Card key={g.chave}>
            <CardHead title={<span className={g.tom}>{g.titulo} ({g.itens.length})</span>} />
            <ul className="divide-y divide-line">{g.itens.sort((a, b) => (a.prazo ?? '').localeCompare(b.prazo ?? '')).map(({ p, i, prazo }) => (
              <li key={`${p.id}-${i.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <input type="checkbox" aria-label={`Concluir ${i.titulo}`} className="h-4 w-4 accent-brand" disabled={!podeMarcar} onChange={() => feedback(s.marcarItemJornada(p.id, i.id, true), 'Item concluído.')} />
                <div className="flex-1 min-w-[180px]">
                  <div className="text-[13.5px] text-ink">{i.titulo}{i.obrigatorio === false && <span className="text-muted text-[12px]"> (opcional)</span>}</div>
                  <button type="button" onClick={() => onAbrir(p.colaboradorId)} className="text-[12px] text-muted hover:text-brand">{s.nomeDe(p.colaboradorId)} · {TIPO_LABEL[p.tipo]}</button>
                </div>
                <Badge tone="neutral">{RESPONSAVEL_LABEL_ADMIN[i.responsavel]}</Badge>
                <span className="text-[12.5px] text-ink-2 w-24 text-right">{prazo ? fmtDate(prazo) : '—'}</span>
              </li>
            ))}</ul>
          </Card>
        ))}</div>
      )}
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
            <li key={i.id} className="grid grid-cols-1 sm:grid-cols-[1fr_130px_80px_auto_auto] gap-2 items-center rounded-xl sm:rounded-none border sm:border-0 border-line p-2 sm:p-0">
              <input aria-label={`Título do item ${idx + 1}`} className="input" value={i.titulo} onChange={(e) => upd(i.id, { titulo: e.target.value })} placeholder="Descrição do passo" />
              <Dropdown aria-label="Responsável" className="input" value={i.responsavel} onChange={(e) => upd(i.id, { responsavel: e.target.value as ResponsavelItem })}>{(['pessoa', 'lideranca', 'rh'] as const).map((r) => <option key={r} value={r}>{RESPONSAVEL_LABEL_ADMIN[r]}</option>)}</Dropdown>
              <input aria-label="Prazo em dias" type="number" min={0} className="input" value={i.prazoDias ?? ''} onChange={(e) => upd(i.id, { prazoDias: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="dias" />
              <Toggle checked={i.obrigatorio !== false} onChange={(v) => upd(i.id, { obrigatorio: v })} label="Obrigatório" />
              <div className="flex">
                <Button size="icon-sm" variant="subtle" icon="ArrowUp" aria-label="Mover para cima" disabled={idx === 0} onClick={() => mover(idx, -1)} />
                <Button size="icon-sm" variant="subtle" icon="X" aria-label="Remover item" onClick={() => setItens((x) => x.filter((y) => y.id !== i.id))} />
              </div>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="soft" icon="Plus" className="mt-3" onClick={() => setItens((x) => [...x, { id: uid('ci'), titulo: '', responsavel: 'pessoa' }])}>Adicionar item</Button>
        <p className="text-[11.5px] text-muted mt-2"><Icon name="Info" className="h-3.5 w-3.5 inline mr-1" />Prazo = dias sugeridos a partir do início do processo (opcional). O processo conclui quando todos os itens <b>obrigatórios</b> estão feitos; na integração, a pessoa passa a "ativa" nesse momento.</p>
      </fieldset>
    </Modal>
  )
}
