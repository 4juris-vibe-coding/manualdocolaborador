/* Ciclo de vida da parceria: reativação × novo período, correção do encerramento,
   histórico de vínculos e o painel-resumo da pessoa (usado na Integração). */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Colaborador, IniciativaEncerramento } from '@/lib/types'
import { Badge, Button, Callout, Field, Icon, Progress, Avatar, EmptyState } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Drawer } from '@/components/v2/Drawer'
import { Dropdown } from '@/components/Dropdown'
import { feedback } from '@/components/toast'
import { fmtDate, STATUS_COLAB } from '@/lib/utils'
import { hojeISO, tempoParceria } from '@/domain/datas'
import { INICIATIVAS, INICIATIVA_LABEL, INICIATIVA_CURTA, MOVIMENTACAO_LABEL, vinculosDe, ultimo } from '@/domain/vinculos'
import { progressoObrigatorio, referenciaDe, processoAberto, prazoItem } from '@/domain/jornada'

/** Seletor estruturado da iniciativa do encerramento (base do turnover involuntário). */
export function SeletorIniciativa({ id, valor, onChange }: { id: string; valor: IniciativaEncerramento | ''; onChange: (v: IniciativaEncerramento | '') => void }) {
  return (
    <Field label="Iniciativa do encerramento" required htmlFor={id} hint="Involuntário = iniciativa da 4JURIS. É o critério do turnover involuntário.">
      <Dropdown id={id} className="input" value={valor} onChange={(e) => onChange(e.target.value as IniciativaEncerramento | '')}>
        <option value="">Selecione…</option>
        {INICIATIVAS.map((i) => <option key={i} value={i}>{INICIATIVA_LABEL[i]}</option>)}
      </Dropdown>
    </Field>
  )
}

export function ReativarModal({ pessoa, onClose }: { pessoa: Colaborador; onClose: () => void }) {
  const s = useStore()
  const fim = pessoa.encerramento?.data ?? ultimo(vinculosDe(pessoa))?.fim ?? ''
  const [modo, setModo] = useState<'reativar' | 'novo_vinculo'>('reativar')
  const [inicio, setInicio] = useState(hojeISO())
  const [just, setJust] = useState('')
  const salvar = () => { if (feedback(s.reativarParceria(pessoa.id, modo, modo === 'novo_vinculo' ? inicio : undefined, just), modo === 'reativar' ? 'Parceria reativada.' : 'Novo período de parceria registrado.')) onClose() }
  const Opcao = ({ v, titulo, texto }: { v: typeof modo; titulo: string; texto: string }) => (
    <label className={`flex gap-3 rounded-xl border p-3.5 cursor-pointer ${modo === v ? 'border-brand bg-brand-50/50' : 'border-line'}`}>
      <input type="radio" name="modo-reativar" className="mt-1 accent-brand" checked={modo === v} onChange={() => setModo(v)} />
      <span><b className="text-[13.5px] text-ink">{titulo}</b><span className="block text-[12.5px] text-muted mt-0.5">{texto}</span></span>
    </label>
  )
  return (
    <Modal open onClose={onClose} title="Voltar a ativar a parceria" subtitle={pessoa.nome}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="RotateCcw" onClick={salvar}>Confirmar</Button></>}>
      <div className="space-y-2.5 mb-4">
        <Opcao v="reativar" titulo="Reativar o mesmo vínculo" texto={`Desfaz o encerramento de ${fmtDate(fim)}: o período continua como se não tivesse sido encerrado (ex.: encerrado por engano ou revertido). O encerramento desfeito fica no histórico.`} />
        <Opcao v="novo_vinculo" titulo="Iniciar um novo período" texto="A pessoa volta depois de um encerramento definitivo. O período anterior é preservado e um novo começa na data informada. O cadastro continua o mesmo." />
      </div>
      {modo === 'novo_vinculo' && <Field label="Início do novo período" required htmlFor="rv-i"><input id="rv-i" type="date" className="input" min={fim} value={inicio} onChange={(e) => setInicio(e.target.value)} /></Field>}
      <Field label="Justificativa (opcional)" htmlFor="rv-j" hint="Fica no histórico de movimentações."><input id="rv-j" className="input" value={just} onChange={(e) => setJust(e.target.value)} /></Field>
      <Callout tone="neutral" icon="Info">O acesso ao portal não é liberado automaticamente: confira em Dados › Acesso ao portal.</Callout>
    </Modal>
  )
}

export function CorrigirEncerramentoModal({ pessoa, onClose }: { pessoa: Colaborador; onClose: () => void }) {
  const s = useStore()
  const e = pessoa.encerramento!
  const [data, setData] = useState(e.data)
  const [motivo, setMotivo] = useState(e.motivoId)
  const [ini, setIni] = useState<IniciativaEncerramento | ''>(e.iniciativa ?? '')
  const [obs, setObs] = useState(e.observacao ?? '')
  const [just, setJust] = useState('')
  const salvar = () => {
    if (!ini) { feedback({ ok: false, erro: 'Classifique a iniciativa do encerramento.' }, ''); return }
    if (feedback(s.corrigirEncerramento(pessoa.id, { data, motivoId: motivo, iniciativa: ini, observacao: obs }, just), 'Encerramento corrigido.')) onClose()
  }
  return (
    <Modal open onClose={onClose} title="Corrigir encerramento" subtitle={pessoa.nome}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" onClick={salvar}>Salvar correção</Button></>}>
      <Callout tone="neutral" icon="History" className="mb-4">Os valores anteriores ficam registrados no histórico, com quem corrigiu e quando.</Callout>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Data efetiva do encerramento" required htmlFor="ce-d"><input id="ce-d" type="date" className="input" max={hojeISO()} value={data} onChange={(x) => setData(x.target.value)} /></Field>
        <Field label="Motivo" required htmlFor="ce-m"><Dropdown id="ce-m" className="input" value={motivo} onChange={(x) => { setMotivo(x.target.value); const m = s.motivosEncerramento.find((y) => y.id === x.target.value); if (m?.iniciativa) setIni(m.iniciativa) }}>{s.motivosEncerramento.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Dropdown></Field>
      </div>
      <SeletorIniciativa id="ce-i" valor={ini} onChange={setIni} />
      <Field label="Observação interna" htmlFor="ce-o" hint="Visível só para o RH. Evite dados sensíveis."><textarea id="ce-o" rows={2} className="input !h-auto py-2.5" value={obs} onChange={(x) => setObs(x.target.value)} /></Field>
      <Field label="Motivo da correção" required htmlFor="ce-j"><input id="ce-j" className="input" value={just} onChange={(x) => setJust(x.target.value)} placeholder="Ex.: data informada errada no registro" /></Field>
    </Modal>
  )
}

/** Períodos de parceria + linha do tempo de movimentações (tudo o que aconteceu com o vínculo). */
export function HistoricoVinculos({ pessoa }: { pessoa: Colaborador }) {
  const s = useStore()
  const hoje = hojeISO()
  const vs = vinculosDe(pessoa)
  const movs = [...(pessoa.movimentacoes ?? [])].sort((a, b) => b.em.localeCompare(a.em))
  const motivo = (id?: string) => (id ? s.motivosEncerramento.find((m) => m.id === id)?.nome : undefined)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="card">
        <header className="px-5 py-4 border-b border-line"><h3 className="text-[14px] font-bold text-ink">Períodos de parceria ({vs.length})</h3><p className="text-[12px] text-muted">Datas efetivas informadas pelo RH.</p></header>
        <ol className="divide-y divide-line">
          {[...vs].reverse().map((v, i) => (
            <li key={v.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <b className="text-[13.5px] text-ink">{vs.length - i}º período{v.origem === 'novo_vinculo' ? ' · retorno' : ''}</b>
                {v.fim ? <Badge tone="neutral">Encerrado</Badge> : <Badge tone="success" dot>Vigente</Badge>}
              </div>
              <div className="text-[12.5px] text-ink-2 mt-1">{fmtDate(v.inicio)} → {v.fim ? fmtDate(v.fim) : 'atual'} · {tempoParceria(v.inicio, v.fim ?? hoje)}</div>
              {v.fim && <div className="text-[12px] text-muted mt-0.5">{motivo(v.motivoId) ?? 'Motivo não informado'} · {v.iniciativa ? INICIATIVA_CURTA[v.iniciativa] : <span className="text-warning-ink">iniciativa não classificada</span>}{v.encerradoPorId ? ` · registrado por ${s.nomeDe(v.encerradoPorId)}` : ''}</div>}
            </li>
          ))}
        </ol>
      </section>
      <section className="card">
        <header className="px-5 py-4 border-b border-line"><h3 className="text-[14px] font-bold text-ink">Movimentações</h3><p className="text-[12px] text-muted">Só acrescenta: nada é apagado ou sobrescrito.</p></header>
        {movs.length === 0 ? <EmptyState icon="History" title="Sem movimentações registradas" desc="Encerramentos, reativações e correções aparecem aqui a partir de agora." /> : (
          <ol className="px-5 py-4 space-y-4">
            {movs.map((m) => (
              <li key={m.id} className="relative pl-6">
                <span className="absolute left-0 top-1 h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
                <div className="text-[13px] font-semibold text-ink">{MOVIMENTACAO_LABEL[m.tipo]} · {fmtDate(m.dataEfetiva)}</div>
                <div className="text-[12px] text-muted">Registrado em {new Date(m.em).toLocaleString('pt-BR')}{m.porId ? ` por ${s.nomeDe(m.porId)}` : ''}</div>
                {(m.motivoId || m.iniciativa) && <div className="text-[12px] text-ink-2">{[motivo(m.motivoId), m.iniciativa && INICIATIVA_CURTA[m.iniciativa]].filter(Boolean).join(' · ')}</div>}
                {m.anterior?.data && <div className="text-[12px] text-ink-2">Antes: {fmtDate(m.anterior.data)}{m.anterior.iniciativa ? ` · ${INICIATIVA_CURTA[m.anterior.iniciativa]}` : ''}</div>}
                {m.justificativa && <div className="text-[12px] text-ink-2 italic">“{m.justificativa}”</div>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

/** Painel lateral da pessoa, aberto na tela de Integração (sem sair da tela). */
export function PainelPessoaRH({ pessoaId, onClose }: { pessoaId: string | null; onClose: () => void }) {
  const s = useStore()
  const p = pessoaId ? s.pessoa(pessoaId) : undefined
  const [aba, setAba] = useState<'resumo' | 'checklists' | 'historico'>('resumo')
  if (!p) return <Drawer open={!!pessoaId} onClose={onClose} titulo="Pessoa"><EmptyState icon="UserX" title="Cadastro não encontrado" /></Drawer>
  const hoje = hojeISO()
  const st = STATUS_COLAB[p.status]
  const vs = vinculosDe(p)
  const procs = s.processos.filter((x) => x.colaboradorId === p.id).sort((a, b) => b.iniciadoEm.localeCompare(a.iniciadoEm))
  const docs = s.documentos.filter((d) => d.colaboradorId === p.id)
  const e = p.encerramento
  const Linha = ({ r, v }: { r: string; v?: React.ReactNode }) => <div className="flex justify-between gap-3 py-2 border-b border-line last:border-0 text-[13px]"><dt className="text-muted">{r}</dt><dd className="text-ink text-right">{v || '—'}</dd></div>
  return (
    <Drawer open onClose={onClose} titulo={p.nome} subtitulo={`${s.cargoNome(p.cargoId)} · ${s.setorNome(p.setorId)}`}
      rodape={<Link to={`/rh/pessoas/${p.id}`} className="block"><Button icon="ExternalLink" className="w-full justify-center">Abrir ficha completa</Button></Link>}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar pessoaId={p.id} nome={p.nome} cor={p.avatarCor} size="lg" />
        <div><Badge tone={st.tone} dot>{st.label}</Badge><div className="text-[12.5px] text-muted mt-1">{p.email}</div></div>
      </div>
      <div className="flex gap-1.5 mb-4" role="tablist">
        {(['resumo', 'checklists', 'historico'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={`chip ${aba === k ? 'chip-active' : ''}`}>{k === 'resumo' ? 'Resumo' : k === 'checklists' ? `Checklists (${procs.length})` : 'Histórico'}</button>)}
      </div>
      {aba === 'resumo' && <dl>
        <Linha r="Início da parceria (atual)" v={fmtDate(p.dataEntrada)} />
        {vs.length > 1 && <Linha r="Primeiro início" v={fmtDate(vs[0].inicio)} />}
        <Linha r="Tempo de parceria" v={tempoParceria(p.dataEntrada, e?.data ?? hoje)} />
        <Linha r="Forma de contratação" v={p.regime} />
        <Linha r="Gestor imediato" v={p.responsavelId ? s.nomeDe(p.responsavelId) : undefined} />
        {e && <>
          <Linha r="Encerramento (data efetiva)" v={<b>{fmtDate(e.data)}</b>} />
          <Linha r="Motivo" v={s.motivosEncerramento.find((m) => m.id === e.motivoId)?.nome} />
          <Linha r="Tipo" v={e.iniciativa ? INICIATIVA_CURTA[e.iniciativa] : 'Não classificado'} />
          <Linha r="Responsável pelo registro" v={e.porId ? s.nomeDe(e.porId) : undefined} />
          {e.observacao && <Linha r="Observação interna" v={e.observacao} />}
        </>}
        <Linha r="Documentos" v={`${docs.length} anexado(s)`} />
        <Linha r="Períodos de parceria" v={vs.length} />
      </dl>}
      {aba === 'checklists' && (procs.length === 0 ? <EmptyState icon="ListChecks" title="Nenhum checklist" /> : (
        <ul className="space-y-3">{procs.map((x) => {
          const pr = progressoObrigatorio(x)
          return (
            <li key={x.id} className="rounded-xl border border-line p-3.5">
              <div className="flex items-center justify-between gap-2"><b className="text-[13px] text-ink">{x.tipo === 'integracao' ? 'Integração' : 'Encerramento'} · {fmtDate(referenciaDe(x, p))}</b>
                {x.canceladoEm ? <Badge tone="neutral">Cancelado</Badge> : x.concluidoEm ? <Badge tone="success" dot>Concluído</Badge> : <Badge tone="brand">{pr.percentual}%</Badge>}</div>
              {processoAberto(x) && <Progress value={pr.percentual} className="mt-2" />}
              <ul className="mt-2 space-y-1">{x.itens.map((i) => {
                const prazo = prazoItem(x, i.prazoDias)
                return <li key={i.id} className="flex items-center gap-2 text-[12.5px]"><Icon name={i.feito ? 'CheckCircle2' : 'Circle'} className={`h-3.5 w-3.5 ${i.feito ? 'text-success' : 'text-muted'}`} /><span className={i.feito ? 'text-muted line-through' : 'text-ink-2'}>{i.titulo}</span>{i.obrigatorio === false && <span className="text-[11px] text-muted">(opcional)</span>}{!i.feito && prazo && prazo < hoje && processoAberto(x) && <Badge tone="warning">atrasado</Badge>}</li>
              })}</ul>
              {x.motivoCancelamento && <p className="text-[11.5px] text-muted mt-2">{x.motivoCancelamento}</p>}
            </li>
          )
        })}</ul>
      ))}
      {aba === 'historico' && <div className="-mx-1"><HistoricoVinculos pessoa={p} /></div>}
    </Drawer>
  )
}
