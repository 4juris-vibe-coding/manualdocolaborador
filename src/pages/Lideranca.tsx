import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Objetivo } from '@/lib/types'
import { PageHeader, Card, CardHead, StatCard, Badge, Button, Avatar, Icon, Tabs, EmptyState, Field, Progress, Callout, Select } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { AgendaTimeline } from '@/components/AgendaTimeline'
import { ReconhecerModal } from './Gamificacao'
import { STATUS_PERIODO } from './Disponibilidade'
import { brl, fmtDate, STATUS_COLAB, cn } from '@/lib/utils'
import { hojeISO, somarDias, tempoParceria, diasEntre } from '@/domain/datas'
import { areasLideradas, podeAlinharPeriodo } from '@/domain/visibilidade'
import { sobreposicoesNaArea } from '@/domain/disponibilidade'
import { progresso, prazoItem } from '@/domain/jornada'
import { can } from '@/domain/permissions'
import { Dropdown } from '@/components/Dropdown'
import { AcessosEquipe } from '@/components/AcessosEquipe'

export default function Lideranca() {
  const s = useStore()
  const user = s.currentUser()
  const hoje = hojeISO()
  const visaoGeral = can(user.papel, 'rh:painel')
  const minhas = useMemo(() => (visaoGeral ? s.setores : areasLideradas(user, s.setores)), [visaoGeral, s.setores, user])
  const [areaSel, setAreaSel] = useState<string>('todas')
  const areas = areaSel === 'todas' ? minhas : minhas.filter((a) => a.id === areaSel)
  const ids = new Set(areas.map((a) => a.id))
  const equipe = s.colaboradores.filter((c) => ids.has(c.setorId) && c.status !== 'encerrado' && c.id !== user.id).sort((a, b) => a.nome.localeCompare(b.nome))
  const equipeIds = new Set(equipe.map((c) => c.id))
  const periodos = s.periodos.filter((p) => equipeIds.has(p.colaboradorId) && p.status !== 'cancelado' && p.fim >= hoje).sort((a, b) => a.inicio.localeCompare(b.inicio))
  const paraAlinhar = periodos.filter((p) => p.status === 'planejado')
  const proximos14 = periodos.filter((p) => p.inicio <= somarDias(hoje, 14)).length
  const jornadas = s.processos.filter((p) => equipeIds.has(p.colaboradorId) && !p.concluidoEm)
  const itensLideranca = jornadas.reduce((n, p) => n + p.itens.filter((i) => i.responsavel === 'lideranca' && !i.feito).length, 0)
  const reembPend = s.reembolsos.filter((r) => r.status === 'pendente' && equipeIds.has(r.colaboradorId))
  const iniciativasRev = s.iniciativas.filter((t) => t.status === 'revisao' && t.voluntarioId !== user.id)

  const [tab, setTab] = useState('disponibilidade')
  const [reconhecer, setReconhecer] = useState<string | null>(null)

  if (!minhas.length) {
    return (
      <>
        <PageHeader title="Painel da liderança" />
        <Card><EmptyState icon="UserCog" title="Você ainda não coordena nenhuma área" desc="Peça ao RH para registrar você como liderança de uma área em Estrutura." /></Card>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Painel da liderança" subtitle="Coordenação das áreas sob sua responsabilidade: disponibilidade, objetivos e integração."
        actions={minhas.length > 1 && (
          <Select label="Área" value={areaSel} onChange={setAreaSel}>
            <option value="todas">Todas as minhas áreas ({minhas.length})</option>
            {minhas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        )} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="Users" tone="brand" value={equipe.length} label="Pessoas nas áreas" />
        <StatCard icon="Palmtree" tone="warning" value={proximos14} label="Indisponibilidades em 14 dias" />
        <StatCard icon="Handshake" tone="ink" value={paraAlinhar.length} label="Períodos para alinhar" />
        <StatCard icon="Rocket" tone="success" value={`${jornadas.length}${itensLideranca ? ` · ${itensLideranca}` : ''}`} label={itensLideranca ? 'Integrações · itens seus' : 'Integrações em andamento'} />
      </div>

      <Tabs tabs={[
        { key: 'disponibilidade', label: `Disponibilidade${paraAlinhar.length ? ` (${paraAlinhar.length})` : ''}` },
        { key: 'equipe', label: 'Equipe' },
        ...(can(user.papel, 'acessos:equipe') ? [{ key: 'acessos', label: 'Acessos da equipe' }] : []),
        { key: 'objetivos', label: 'Objetivos' },
        { key: 'integracao', label: `Integração${itensLideranca ? ` (${itensLideranca})` : ''}` },
        { key: 'solicitacoes', label: `Solicitações${reembPend.length + iniciativasRev.length ? ` (${reembPend.length + iniciativasRev.length})` : ''}` },
      ]} active={tab} onChange={setTab} />

      {tab === 'disponibilidade' && (
        <div className="space-y-6">
          <Card>
            <CardHead title="Agenda das áreas" sub="Próximas 6 semanas" />
            <AgendaTimeline pessoas={equipe} periodos={periodos} inicio={hoje} />
          </Card>
          <Card>
            <CardHead title="Períodos registrados" sub="Registre o alinhamento quando a continuidade das entregas estiver combinada. Não é aprovação." />
            {periodos.length === 0 ? <EmptyState icon="CalendarCheck" title="Nenhum período futuro" /> : (
              <ul className="divide-y divide-line">
                {periodos.map((p) => {
                  const c = s.pessoa(p.colaboradorId)!
                  const sob = sobreposicoesNaArea(p.inicio, p.fim, c.id, c.setorId, s.periodos, (id) => s.pessoa(id)?.setorId)
                  const st = STATUS_PERIODO[p.status]
                  return (
                    <li key={p.id} className="p-4 flex gap-3 flex-wrap sm:flex-nowrap">
                      <Avatar nome={c.nome} cor={c.avatarCor} size="sm" />
                      <div className="flex-1 min-w-[220px]">
                        <div className="text-[13.5px] font-semibold text-ink">{c.nome} <span className="text-muted font-normal">· {s.setorNome(c.setorId)}</span></div>
                        <div className="text-[12.5px] text-ink-2">{fmtDate(p.inicio)} → {fmtDate(p.fim)} · {diasEntre(p.inicio, p.fim) + 1} dia(s)</div>
                        {p.mensagemEquipe && <p className="text-[12px] text-muted mt-1">“{p.mensagemEquipe}”</p>}
                        {p.contatoContinuidadeId && <p className="text-[12px] text-muted">Contato: {s.nomeDe(p.contatoContinuidadeId)}{p.planoContinuidade ? ` · ${p.planoContinuidade}` : ''}</p>}
                        {sob.length > 0 && <p className="text-[12px] text-warning font-medium mt-1"><Icon name="AlertTriangle" className="h-3.5 w-3.5 inline mr-1" />Sobrepõe com {sob.map((x) => s.nomeDe(x.colaboradorId).split(' ')[0]).join(', ')}</p>}
                      </div>
                      <div className="flex items-start gap-2">
                        <Badge tone={st.tone} dot>{st.label}</Badge>
                        {p.status === 'planejado' && s.config.disponibilidade.usarAlinhamento && podeAlinharPeriodo(p, user, c.setorId, s.setores) && (
                          <Button size="sm" icon="Handshake" onClick={() => feedback(s.alinharPeriodo(p.id), 'Alinhamento registrado. A pessoa foi avisada.')}>Registrar alinhamento</Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'acessos' && <AcessosEquipe areas={areas} equipe={equipe} />}

      {tab === 'equipe' && (
        <Card>
          <CardHead title="Pessoas nas suas áreas" sub="Informações de coordenação. Dados contratuais, bancários e documentos ficam restritos ao RH." />
          {equipe.length === 0 ? <EmptyState icon="Users" title="Nenhuma pessoa nas áreas selecionadas" /> : (
            <ul className="divide-y divide-line">
              {equipe.map((c) => {
                const st = STATUS_COLAB[c.status]
                const fora = s.periodos.find((p) => p.colaboradorId === c.id && p.status !== 'cancelado' && p.inicio <= hoje && hoje <= p.fim)
                return (
                  <li key={c.id} className="flex items-center gap-3 sm:gap-4 p-4 flex-wrap sm:flex-nowrap">
                    <Avatar nome={c.nome} cor={c.avatarCor} size="md" />
                    <div className="flex-1 min-w-[180px]">
                      <div className="text-[14px] font-semibold text-ink">{c.nome}</div>
                      <div className="text-[12px] text-muted">{s.cargoNome(c.cargoId)} · {s.setorNome(c.setorId)} · parceria há {tempoParceria(c.dataEntrada, hoje)}</div>
                    </div>
                    {fora && <Badge tone="warning">Indisponível até {fmtDate(fora.fim, { day: '2-digit', month: 'short' })}</Badge>}
                    <Badge tone={st.tone} dot>{st.label}</Badge>
                    <Button size="sm" variant="soft" icon="Heart" onClick={() => setReconhecer(c.id)}>Reconhecer</Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'objetivos' && <Objetivos areas={areas} />}

      {tab === 'integracao' && (
        <Card>
          <CardHead title="Integrações em andamento" sub="Itens sob responsabilidade da liderança podem ser marcados aqui" />
          {jornadas.length === 0 ? <EmptyState icon="Rocket" title="Nenhuma integração em andamento" /> : (
            <ul className="divide-y divide-line">
              {jornadas.map((p) => {
                const c = s.pessoa(p.colaboradorId)!
                const pr = progresso(p)
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar nome={c.nome} cor={c.avatarCor} size="sm" />
                      <div className="flex-1 min-w-0"><div className="text-[13.5px] font-semibold text-ink">{c.nome}</div><div className="text-[12px] text-muted">{p.tipo === 'integracao' ? 'Integração' : 'Encerramento'} desde {fmtDate(p.iniciadoEm)}</div></div>
                      <span className="text-[13px] font-bold text-ink">{pr.percentual}%</span>
                    </div>
                    <Progress value={pr.percentual} className="mb-3" />
                    <ul className="grid sm:grid-cols-2 gap-1">
                      {p.itens.filter((i) => i.responsavel === 'lideranca').map((i) => (
                        <li key={i.id}>
                          <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-2 cursor-pointer">
                            <input type="checkbox" className="h-4 w-4 mt-0.5 accent-brand" checked={i.feito} onChange={(e) => feedback(s.marcarItemJornada(p.id, i.id, e.target.checked), e.target.checked ? 'Item concluído.' : 'Item reaberto.')} />
                            <span className="text-[12.5px]"><span className={cn(i.feito && 'line-through text-muted')}>{i.titulo}</span>{!i.feito && prazoItem(p, i.prazoDias) && <span className="block text-[11px] text-muted">Sugestão: até {fmtDate(prazoItem(p, i.prazoDias))}</span>}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'solicitacoes' && (
        <div className="space-y-6">
          <Card>
            <CardHead title="Reembolsos da área" sub="Despesas vinculadas aos serviços, aguardando análise" />
            {reembPend.length === 0 ? <p className="text-[13px] text-muted p-5">Nenhum reembolso pendente.</p> : (
              <ul className="divide-y divide-line">
                {reembPend.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 sm:gap-4 p-4 flex-wrap sm:flex-nowrap">
                    <Avatar nome={s.nomeDe(r.colaboradorId)} cor={s.pessoa(r.colaboradorId)?.avatarCor} size="sm" />
                    <div className="flex-1 min-w-[180px]"><div className="text-[13.5px] font-semibold text-ink">{r.descricao}</div><div className="text-[12px] text-muted">{s.nomeDe(r.colaboradorId)} · {r.categoria} · {fmtDate(r.data)}</div></div>
                    <span className="text-[14px] font-bold text-ink">{brl(r.valor)}</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => feedback(s.setReembolsoStatus(r.id, 'recusado', user.id), 'Reembolso recusado. A pessoa foi avisada.')}>Recusar</Button>
                      <Button size="sm" icon="Check" onClick={() => feedback(s.setReembolsoStatus(r.id, 'aprovado', user.id), 'Reembolso aprovado.')}>Aprovar</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <CardHead title="Iniciativas voluntárias para confirmar" />
            {iniciativasRev.length === 0 ? <p className="text-[13px] text-muted p-5">Nada para confirmar.</p> : (
              <ul className="divide-y divide-line">
                {iniciativasRev.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 p-4 flex-wrap sm:flex-nowrap">
                    <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0"><Icon name="HandHeart" className="h-5 w-5" /></span>
                    <div className="flex-1 min-w-[180px]"><div className="text-[13.5px] font-semibold text-ink">{t.titulo}</div><div className="text-[12px] text-muted">{s.nomeDe(t.voluntarioId)} · {t.entrega}</div></div>
                    <span className="text-[13px] font-extrabold text-brand">+{t.pontos}</span>
                    <Button size="sm" icon="Check" onClick={() => feedback(s.confirmarIniciativa(t.id), 'Contribuição confirmada!')}>Confirmar</Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {reconhecer && <ReconhecerModal onClose={() => setReconhecer(null)} excluir={user.id} paraInicial={reconhecer} />}
    </>
  )
}

function Objetivos({ areas }: { areas: { id: string; nome: string }[] }) {
  const s = useStore()
  const hoje = hojeISO()
  const [periodo, setPeriodo] = useState(hoje.slice(0, 7))
  const [form, setForm] = useState<{ aberto: boolean; o?: Objetivo }>({ aberto: false })
  const [remover, setRemover] = useState<Objetivo | null>(null)
  const ids = new Set(areas.map((a) => a.id))
  const lista = s.objetivos.filter((o) => ids.has(o.setorId) && o.periodo === periodo)

  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const r = s.salvarObjetivo({ titulo: d.titulo.trim(), descricao: d.descricao.trim(), setorId: d.setorId, periodo: d.periodo, meta: Number(d.meta), atual: Number(d.atual), unidadeMedida: d.unidade.trim() || 'unid.', responsavelId: d.responsavelId || undefined }, form.o?.id)
    if (feedback(r, 'Objetivo salvo.')) setForm({ aberto: false })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="text-[12.5px] font-semibold text-ink-2" htmlFor="obj-per">Mês</label>
        <input id="obj-per" type="month" className="input w-auto" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        <Button icon="Plus" className="ml-auto" onClick={() => setForm({ aberto: true })}>Novo objetivo</Button>
      </div>
      <Callout tone="neutral" icon="Target" className="mb-4">Objetivos acompanham resultados dos projetos e da área — não são metas individuais de jornada ou de produtividade de pessoas.</Callout>
      {lista.length === 0 ? <Card><EmptyState icon="Target" title="Nenhum objetivo neste mês" desc="Cadastre objetivos da área para acompanhar o andamento dos projetos." /></Card> : (
        <div className="grid md:grid-cols-2 gap-4">
          {lista.map((o) => {
            const pct = Math.round((o.atual / o.meta) * 100)
            return (
              <Card key={o.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><Badge tone="neutral">{s.setorNome(o.setorId)}</Badge><h3 className="text-[15px] font-bold text-ink mt-2">{o.titulo}</h3><p className="text-[12.5px] text-muted mt-0.5">{o.descricao}</p></div>
                  <div className="flex gap-1">
                    <Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar objetivo" onClick={() => setForm({ aberto: true, o })} />
                    <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover objetivo" onClick={() => setRemover(o)} />
                  </div>
                </div>
                <div className="flex items-baseline justify-between mt-4">
                  <span className="text-[22px] font-extrabold text-ink tabular-nums">{o.atual.toLocaleString('pt-BR')} <span className="text-[13px] text-muted font-semibold">/ {o.meta.toLocaleString('pt-BR')} {o.unidadeMedida}</span></span>
                  <span className={cn('text-[13px] font-bold', pct >= 100 ? 'text-success' : 'text-ink-2')}>{pct}%</span>
                </div>
                <Progress value={pct} className="mt-2" color={pct >= 100 ? '#0f9d6b' : undefined} />
                {o.responsavelId && <div className="text-[11.5px] text-muted mt-2">Ponto focal: {s.nomeDe(o.responsavelId)}</div>}
              </Card>
            )
          })}
        </div>
      )}
      <Modal open={form.aberto} onClose={() => setForm({ aberto: false })} title={form.o ? 'Editar objetivo' : 'Novo objetivo'}
        footer={<><Button variant="ghost" onClick={() => setForm({ aberto: false })}>Cancelar</Button><Button icon="Check" type="submit" form="objForm">Salvar</Button></>}>
        {form.aberto && (
          <form id="objForm" onSubmit={salvar}>
            <Field label="Título" required htmlFor="o-t"><input id="o-t" name="titulo" className="input" defaultValue={form.o?.titulo} required /></Field>
            <Field label="Descrição" htmlFor="o-d"><input id="o-d" name="descricao" className="input" defaultValue={form.o?.descricao} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Área" htmlFor="o-s"><Dropdown id="o-s" name="setorId" className="input" defaultValue={form.o?.setorId ?? areas[0]?.id}>{areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Dropdown></Field>
              <Field label="Mês" htmlFor="o-p"><input id="o-p" name="periodo" type="month" className="input" defaultValue={form.o?.periodo ?? periodo} /></Field>
              <Field label="Meta" required htmlFor="o-m"><input id="o-m" name="meta" type="number" min={0} step="any" className="input" defaultValue={form.o?.meta} /></Field>
              <Field label="Valor atual" htmlFor="o-a"><input id="o-a" name="atual" type="number" min={0} step="any" className="input" defaultValue={form.o?.atual ?? 0} /></Field>
              <Field label="Unidade" htmlFor="o-u"><input id="o-u" name="unidade" className="input" defaultValue={form.o?.unidadeMedida} placeholder="ex.: leads" /></Field>
              <Field label="Ponto focal (opcional)" htmlFor="o-r">
                <Dropdown id="o-r" name="responsavelId" className="input" defaultValue={form.o?.responsavelId ?? ''}>
                  <option value="">—</option>
                  {s.colaboradores.filter((c) => c.status !== 'encerrado' && areas.some((a) => a.id === c.setorId)).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Dropdown>
              </Field>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover objetivo?" confirmar="Remover" texto={remover ? `"${remover.titulo}" será removido.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerObjetivo(remover.id), 'Objetivo removido.')) setRemover(null) }} />
    </>
  )
}
