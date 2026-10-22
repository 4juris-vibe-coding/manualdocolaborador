import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { CicloAvaliativo, Regime, RotuloEscala, TipoRelacaoAvaliacao } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, EmptyState, Select, Progress, Toggle, Callout, Avatar, Icon, BarList, Tabela, TH, TD } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { RadialGauge } from '@/components/charts'
import { BotaoImprimir } from '@/components/inputs'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { ROTULOS_ESCALA, TIPO_RELACAO_INFO, rotulos, elegiveis, competenciasDe, resultadoIndividual, responsaveisDe, notaPonderada } from '@/domain/avaliacoes'
import { Dropdown } from '@/components/Dropdown'

const STATUS: Record<CicloAvaliativo['status'], { label: string; tone: string }> = { rascunho: { label: 'Rascunho', tone: 'neutral' }, ativo: { label: 'Em andamento', tone: 'brand' }, encerrado: { label: 'Encerrado', tone: 'success' } }

export default function Avaliacoes() {
  const s = useStore()
  const [wizard, setWizard] = useState<{ aberto: boolean; id?: string }>({ aberto: false })
  const [painel, setPainel] = useState<string | null>(null)
  const [remover, setRemover] = useState<CicloAvaliativo | null>(null)
  const ciclo = s.ciclos.find((c) => c.id === painel)

  if (ciclo) return <PainelCiclo c={ciclo} onVoltar={() => setPainel(null)} />

  return (
    <>
      <PageHeader title="Ciclos de avaliação" subtitle="Conversas estruturadas sobre as entregas: direta (90°), conjunta (180°), 360° ou customizada."
        actions={<Button icon="Plus" onClick={() => setWizard({ aberto: true })}>Solicitar avaliação</Button>} />
      <Callout tone="neutral" icon="Scale" className="mb-5">Os resultados apoiam conversas de alinhamento da prestação de serviços. Nenhuma decisão contratual deve ser tomada automaticamente a partir das notas.</Callout>
      {s.ciclos.length === 0 ? <Card><EmptyState icon="ClipboardCheck" title="Nenhum ciclo criado" action={<Button icon="Plus" onClick={() => setWizard({ aberto: true })}>Solicitar avaliação</Button>} /></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {s.ciclos.map((c) => {
            const parts = s.participantesCiclo.filter((p) => p.cicloId === c.id)
            const resp = s.respostasAvaliacao.filter((r) => r.cicloId === c.id).length
            const pct = parts.length ? Math.round((resp / parts.length) * 100) : 0
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><Badge tone={STATUS[c.status].tone} dot>{STATUS[c.status].label}</Badge><h3 className="text-[15.5px] font-bold text-ink mt-2">{c.nome}</h3><p className="text-[12.5px] text-muted">{fmtDate(c.abertura)} → {fmtDate(c.encerramento)} · {TIPO_RELACAO_INFO[c.tipoRelacao].titulo}{c.autoavaliacao ? ' + autoavaliação' : ''}</p></div>
                  <span className="text-[20px] font-extrabold text-ink tabular-nums">{pct}%</span>
                </div>
                <Progress value={pct} className="mt-4" />
                <div className="text-[12px] text-muted mt-1.5">{resp} de {parts.length} avaliações respondidas</div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {c.status === 'rascunho' ? <Button size="sm" icon="Play" onClick={() => setWizard({ aberto: true, id: c.id })}>Continuar (etapa {c.etapa})</Button> : <Button size="sm" icon="BarChart3" onClick={() => setPainel(c.id)}>Painel e relatórios</Button>}
                  {c.status === 'ativo' && <Button size="sm" variant="ghost" icon="Square" onClick={() => feedback(s.encerrarCiclo(c.id), 'Ciclo encerrado.')}>Encerrar</Button>}
                  {c.status === 'rascunho' && <Button size="sm" variant="subtle" icon="Trash2" onClick={() => setRemover(c)}>Remover</Button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {wizard.aberto && <Wizard id={wizard.id} onClose={() => setWizard({ aberto: false })} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover rascunho?" confirmar="Remover" texto={remover ? `"${remover.nome}" e seus participantes serão removidos.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerCiclo(remover.id), 'Rascunho removido.')) setRemover(null) }} />
    </>
  )
}

const ETAPAS = ['Dados', 'Escala', 'Configurações', 'Participantes']

function Wizard({ id: idInicial, onClose }: { id?: string; onClose: () => void }) {
  const s = useStore()
  const [id, setId] = useState(idInicial)
  const c = s.ciclos.find((x) => x.id === id)
  const [etapa, setEtapa] = useState<number>(c?.etapa ?? 1)
  const [f, setF] = useState<Partial<CicloAvaliativo>>(() => c ?? { nome: '', descricao: '', abertura: hojeISO(), encerramento: somarDias(hojeISO(), 21), niveisEscala: 5, rotuloEscala: 'desempenho', comentarioCompetenciaMostrar: true, comentarioCompetenciaObrigatorio: false, comentarioGeralObrigatorio: false, tipoRelacao: 'direta_90', autoavaliacao: false, regimes: [] })
  const set = (p: Partial<CicloAvaliativo>) => setF((x) => ({ ...x, ...p }))
  const [novoPar, setNovoPar] = useState({ avaliador: '', avaliado: '' })

  const avancar = () => {
    const prox = Math.min(4, etapa + 1)
    const r = s.salvarCiclo({ ...f, etapa: prox as CicloAvaliativo['etapa'] }, id)
    if (!r.ok) { feedback(r, ''); return }
    if (!id && r.id) setId(r.id)
    if (etapa === 3) feedback(s.gerarParticipantesCiclo(r.id ?? id!), 'Participantes gerados.')
    setEtapa(prox)
  }
  const parts = s.participantesCiclo.filter((p) => p.cicloId === id)
  const ativos = s.colaboradores.filter((p) => p.status !== 'encerrado')
  const opcoesEstrutura = f.nivelEstrutura === 'unidade' ? s.unidades : f.nivelEstrutura === 'area' ? s.setores : f.nivelEstrutura === 'funcao' ? s.cargos : []
  const porAvaliado = useMemo(() => {
    const m = new Map<string, typeof parts>()
    parts.forEach((p) => m.set(p.avaliadoId, [...(m.get(p.avaliadoId) ?? []), p]))
    return [...m.entries()].sort((a, b) => s.nomeDe(a[0]).localeCompare(s.nomeDe(b[0])))
  }, [parts, s])

  return (
    <Modal open onClose={onClose} wide title={c ? `Avaliação: ${c.nome}` : 'Solicitar avaliação'} subtitle="As alterações são salvas a cada etapa."
      footer={<>
        {etapa > 1 && <Button variant="ghost" icon="ChevronLeft" onClick={() => setEtapa(etapa - 1)}>Voltar</Button>}
        {etapa < 4 ? <Button icon="ChevronRight" onClick={avancar}>{etapa === 3 ? 'Salvar e gerar participantes' : 'Salvar e continuar'}</Button>
          : <Button icon="Send" onClick={() => { if (id && feedback(s.finalizarCiclo(id), 'Ciclo iniciado!')) onClose() }}>Finalizar e iniciar ciclo</Button>}
      </>}>
      <ol className="flex items-center gap-2 mb-6" aria-label="Etapas">
        {ETAPAS.map((e, i) => (
          <li key={e} className="flex items-center gap-2 flex-1 min-w-0">
            <span className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0', i + 1 < etapa ? 'bg-success text-white' : i + 1 === etapa ? 'bg-brand text-white' : 'bg-winter text-muted')} aria-current={i + 1 === etapa ? 'step' : undefined}>{i + 1 < etapa ? <Icon name="Check" className="h-4 w-4" /> : i + 1}</span>
            <span className={cn('text-[12.5px] font-semibold truncate hidden sm:inline', i + 1 === etapa ? 'text-ink' : 'text-muted')}>{e}</span>
            {i < 3 && <span className="flex-1 h-px bg-line hidden sm:block" />}
          </li>
        ))}
      </ol>

      {etapa === 1 && (
        <>
          <Field label="Nome da avaliação" required htmlFor="cv-n"><input id="cv-n" className="input" value={f.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Alinhamento do semestre" /></Field>
          <Field label="Descrição" htmlFor="cv-d"><textarea id="cv-d" rows={2} className="input !h-auto py-2.5" value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Abertura" required htmlFor="cv-a"><input id="cv-a" type="date" className="input" value={f.abertura} onChange={(e) => set({ abertura: e.target.value })} /></Field>
            <Field label="Encerramento" required htmlFor="cv-e"><input id="cv-e" type="date" className="input" value={f.encerramento} min={f.abertura} onChange={(e) => set({ encerramento: e.target.value })} /></Field>
          </div>
        </>
      )}
      {etapa === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Field label="Níveis da escala"><div className="flex gap-2">{([5, 4] as const).map((n) => <button key={n} type="button" aria-pressed={f.niveisEscala === n} onClick={() => set({ niveisEscala: n })} className={cn('chip', f.niveisEscala === n && 'chip-active')}>{n} níveis</button>)}</div></Field>
            <Field label="Rótulos sugeridos" htmlFor="cv-r"><Dropdown id="cv-r" className="input" value={f.rotuloEscala} onChange={(e) => set({ rotuloEscala: e.target.value as RotuloEscala })}>{(Object.keys(ROTULOS_ESCALA) as RotuloEscala[]).map((k) => <option key={k} value={k}>{ROTULOS_ESCALA[k].titulo}</option>)}</Dropdown></Field>
            <div className="space-y-3">
              <Toggle checked={!!f.comentarioCompetenciaMostrar} onChange={(v) => set({ comentarioCompetenciaMostrar: v, comentarioCompetenciaObrigatorio: v ? f.comentarioCompetenciaObrigatorio : false })} label="Permitir comentário por competência" />
              <Toggle checked={!!f.comentarioCompetenciaObrigatorio} disabled={!f.comentarioCompetenciaMostrar} onChange={(v) => set({ comentarioCompetenciaObrigatorio: v })} label="Comentário por competência obrigatório" />
              <Toggle checked={!!f.comentarioGeralObrigatorio} onChange={(v) => set({ comentarioGeralObrigatorio: v })} label="Comentário geral obrigatório" />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="text-[11px] font-bold uppercase text-muted mb-3">Pré-visualização</div>
            <p className="text-[13px] font-semibold text-ink mb-2">Qualidade das entregas</p>
            <ol className="space-y-1.5">{rotulos({ rotuloEscala: f.rotuloEscala ?? 'desempenho', niveisEscala: f.niveisEscala ?? 5 }).map((r, i) => <li key={r} className="flex items-center gap-2 text-[12.5px]"><span className="flex">{Array.from({ length: i + 1 }, (_, k) => <Icon key={k} name="Star" className="h-3.5 w-3.5 text-warning" />)}</span>{r}</li>)}</ol>
          </div>
        </div>
      )}
      {etapa === 3 && (
        <>
          <fieldset className="mb-4"><legend className="label">Tipo de relação</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(TIPO_RELACAO_INFO) as TipoRelacaoAvaliacao[]).map((k) => (
                <button key={k} type="button" aria-pressed={f.tipoRelacao === k} onClick={() => set({ tipoRelacao: k })} className={cn('text-left rounded-xl border p-3 transition', f.tipoRelacao === k ? 'border-brand bg-brand-50' : 'border-line hover:border-line-strong')}>
                  <div className="text-[13.5px] font-bold text-ink">{TIPO_RELACAO_INFO[k].titulo}</div><div className="text-[12px] text-muted">{TIPO_RELACAO_INFO[k].desc}</div>
                </button>
              ))}
            </div>
          </fieldset>
          <Toggle checked={!!f.autoavaliacao} onChange={(v) => set({ autoavaliacao: v })} label="Incluir autoavaliação" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 mt-4">
            <Field label="Parcerias iniciadas até" htmlFor="cv-ia" hint="Opcional"><input id="cv-ia" type="date" className="input" value={f.iniciadosAte ?? ''} onChange={(e) => set({ iniciadosAte: e.target.value || undefined })} /></Field>
            <Field label="Recorte da estrutura" htmlFor="cv-ne"><Dropdown id="cv-ne" className="input" value={f.nivelEstrutura ?? ''} onChange={(e) => set({ nivelEstrutura: (e.target.value || undefined) as CicloAvaliativo['nivelEstrutura'], opcaoEstruturaId: undefined })}><option value="">Toda a comunidade</option><option value="unidade">Unidade</option><option value="area">Área</option><option value="funcao">Função</option></Dropdown></Field>
            {f.nivelEstrutura && <Field label="Qual" htmlFor="cv-oe"><Dropdown id="cv-oe" className="input" value={f.opcaoEstruturaId ?? ''} onChange={(e) => set({ opcaoEstruturaId: e.target.value || undefined })}><option value="">Selecione…</option>{opcoesEstrutura.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</Dropdown></Field>}
          </div>
          <fieldset><legend className="label">Formas de contratação (vazio = todas)</legend>
            <div className="flex gap-2">{(['PJ', 'MEI', 'autonomo'] as Regime[]).map((r) => { const on = f.regimes?.includes(r); return <button key={r} type="button" aria-pressed={on} onClick={() => set({ regimes: on ? f.regimes!.filter((x) => x !== r) : [...(f.regimes ?? []), r] })} className={cn('chip', on && 'chip-active')}>{r === 'autonomo' ? 'Autônomo' : r}</button> })}</div>
          </fieldset>
          <p className="text-[12.5px] text-muted mt-4"><Icon name="Users" className="h-4 w-4 inline mr-1" />{elegiveis({ ...(f as CicloAvaliativo), regimes: f.regimes ?? [] }, s.colaboradores).length} pessoa(s) elegível(is) com estes filtros.</p>
        </>
      )}
      {etapa === 4 && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-[13px] text-ink-2 flex-1"><b>{parts.length}</b> par(es) avaliador → avaliado</span>
            <Button size="sm" variant="ghost" icon="RefreshCw" onClick={() => id && feedback(s.gerarParticipantesCiclo(id), 'Participantes gerados novamente.')}>Gerar automaticamente</Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-xl bg-surface-2 border border-line">
            <div className="flex-1 min-w-[160px]"><span className="label">Avaliador</span><Dropdown aria-label="Avaliador" className="input" value={novoPar.avaliador} onChange={(e) => setNovoPar({ ...novoPar, avaliador: e.target.value })}><option value="">Selecione…</option>{ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Dropdown></div>
            <div className="flex-1 min-w-[160px]"><span className="label">Avaliado</span><Dropdown aria-label="Avaliado" className="input" value={novoPar.avaliado} onChange={(e) => setNovoPar({ ...novoPar, avaliado: e.target.value })}><option value="">Selecione…</option>{ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Dropdown></div>
            <Button icon="Plus" onClick={() => { if (id && feedback(s.adicionarParticipante(id, novoPar.avaliador, novoPar.avaliado), 'Par adicionado.')) setNovoPar({ avaliador: '', avaliado: '' }) }}>Adicionar</Button>
          </div>
          {porAvaliado.length === 0 ? <EmptyState icon="Users" title="Nenhum participante" desc="Gere automaticamente ou adicione pares manualmente." /> : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {porAvaliado.map(([avaliado, ps]) => (
                <li key={avaliado} className="p-3">
                  <div className="text-[13px] font-semibold text-ink mb-1.5">{s.nomeDe(avaliado)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ps.map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-1 text-[12px] bg-surface-2 border border-line rounded-full pl-2.5 pr-1 py-0.5">
                        {p.avaliadorId === p.avaliadoId ? 'Autoavaliação' : `por ${s.nomeDe(p.avaliadorId)}`}
                        <button type="button" aria-label="Remover par" onClick={() => feedback(s.removerParticipante(p.id), 'Par removido.')} className="h-5 w-5 rounded-full hover:bg-winter flex items-center justify-center"><Icon name="X" className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}

function PainelCiclo({ c, onVoltar }: { c: CicloAvaliativo; onVoltar: () => void }) {
  const s = useStore()
  const [tab, setTab] = useState('participacao')
  const [avaliado, setAvaliado] = useState('')
  const parts = s.participantesCiclo.filter((p) => p.cicloId === c.id)
  const resps = s.respostasAvaliacao.filter((r) => r.cicloId === c.id)
  const respondido = (pid: string) => resps.some((r) => r.participanteId === pid)
  const avaliadores = [...new Set(parts.map((p) => p.avaliadorId))]
  const avaliados = [...new Set(parts.map((p) => p.avaliadoId))]
  const compsGerais = s.competencias.filter((x) => x.tipo === 'desempenho' && x.ativo)

  const notaDe = (pessoa: string) => {
    const p = s.pessoa(pessoa)!
    return resultadoIndividual(pessoa, c, parts, resps, competenciasDe(p, s.competencias, 'desempenho'), responsaveisDe(p, s.colaboradores, s.setores))
  }
  // 9 box: eixo desempenho × comportamento, a partir das categorias dos grupos de competências.
  const nove = useMemo(() => avaliados.map((id) => {
    const p = s.pessoa(id)!
    const comps = competenciasDe(p, s.competencias, 'desempenho')
    const rs = resps.filter((r) => parts.some((x) => x.id === r.participanteId && x.avaliadoId === id && x.avaliadorId !== id))
    const eixo = (cat: string) => {
      const cs = comps.filter((x) => s.gruposCompetencia.find((g) => g.id === x.grupoId)?.categoria9box === cat)
      const ns = rs.map((r) => notaPonderada(r.notas, cs, c.niveisEscala)).filter((n): n is number => n != null)
      return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null
    }
    return { id, d: eixo('desempenho'), b: eixo('comportamento') }
  }).filter((x) => x.d != null && x.b != null), [avaliados, resps, parts, s, c.niveisEscala])
  const faixa = (n: number) => (n < 40 ? 0 : n < 70 ? 1 : 2)

  return (
    <>
      <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink mb-3 no-print"><Icon name="ArrowLeft" className="h-4 w-4" />Ciclos</button>
      <PageHeader title={c.nome} subtitle={`${fmtDate(c.abertura)} → ${fmtDate(c.encerramento)} · ${TIPO_RELACAO_INFO[c.tipoRelacao].titulo}`} eyebrow={<Badge tone={STATUS[c.status].tone} dot>{STATUS[c.status].label}</Badge>}
        actions={<><BotaoImprimir />{c.status === 'ativo' && <Button variant="ghost" icon="Square" onClick={() => feedback(s.encerrarCiclo(c.id), 'Ciclo encerrado.')}>Encerrar ciclo</Button>}</>} />
      <Tabs tabs={[{ key: 'participacao', label: 'Participação' }, { key: 'geral', label: 'Relatório geral' }, { key: 'individual', label: 'Relatórios individuais' }]} active={tab} onChange={setTab} />

      {tab === 'participacao' && (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <Card className="p-5 flex flex-col items-center justify-center self-start">
            <RadialGauge valor={parts.length ? Math.round((resps.length / parts.length) * 100) : 0} rotulo={`${resps.length} de ${parts.length} respondidas`} tamanho={150} />
            <div className="text-[12px] text-muted mt-3 text-center">{avaliadores.filter((a) => parts.some((p) => p.avaliadorId === a && !respondido(p.id))).length} avaliador(es) com pendência</div>
          </Card>
          <Card>
            <CardHead title="Por avaliador" />
            <ul className="divide-y divide-line">
              {avaliadores.sort((a, b) => s.nomeDe(a).localeCompare(s.nomeDe(b))).map((a) => {
                const meus = parts.filter((p) => p.avaliadorId === a)
                const ok = meus.filter((p) => respondido(p.id)).length
                return (
                  <li key={a} className="flex items-center gap-3 p-3.5">
                    <Avatar nome={s.nomeDe(a)} cor={s.pessoa(a)?.avatarCor} size="sm" />
                    <span className="flex-1 text-[13px] font-semibold text-ink">{s.nomeDe(a)}</span>
                    <div className="w-32"><Progress value={(ok / meus.length) * 100} color={ok === meus.length ? '#0f9d6b' : undefined} /></div>
                    <span className="text-[12px] text-muted w-14 text-right tabular-nums">{ok}/{meus.length}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'geral' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHead title="Média por competência" sub={`Escala de 1 a ${c.niveisEscala}, sem autoavaliação`} /><div className="p-5">
              <BarList total={c.niveisEscala} itens={compsGerais.map((comp) => {
                const v = resps.filter((r) => { const p = parts.find((x) => x.id === r.participanteId); return p && p.avaliadorId !== p.avaliadoId }).map((r) => r.notas[comp.id]).filter((n) => n != null)
                return { rotulo: comp.nome, valor: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : 0 }
              })} />
            </div></Card>
            <Card><CardHead title="Nota média por área" sub="0–100, ponderada pelos pesos" /><div className="p-5">
              <BarList total={100} itens={s.setores.map((a) => {
                const ns = avaliados.filter((id) => s.pessoa(id)?.setorId === a.id).map((id) => notaDe(id).nota).filter((n): n is number => n != null)
                return { rotulo: a.nome, valor: ns.length ? Math.round(ns.reduce((x, y) => x + y, 0) / ns.length) : 0, cor: a.cor }
              }).filter((x) => x.valor > 0)} />
            </div></Card>
          </div>
          <Card>
            <CardHead title="9 box" sub="Desempenho × comportamento (grupos de competências com categoria 9 box). Visível só ao RH." />
            {nove.length === 0 ? <p className="p-5 text-[13px] text-muted">Sem respostas suficientes nos dois eixos.</p> : (
              <div className="p-5 overflow-x-auto">
                <div className="grid grid-cols-[auto_repeat(3,minmax(140px,1fr))] gap-2 min-w-[520px]">
                  <div />{['Comportamento baixo', 'Comportamento médio', 'Comportamento alto'].map((t) => <div key={t} className="text-[11px] font-bold uppercase text-muted text-center">{t}</div>)}
                  {[2, 1, 0].map((d) => (
                    <div key={d} className="contents">
                      <div className="text-[11px] font-bold uppercase text-muted [writing-mode:vertical-rl] rotate-180 text-center">{['Desemp. baixo', 'Desemp. médio', 'Desemp. alto'][d]}</div>
                      {[0, 1, 2].map((b) => {
                        const q = nove.filter((x) => faixa(x.d!) === d && faixa(x.b!) === b)
                        return (
                          <div key={b} className={cn('rounded-xl border p-2.5 min-h-[86px]', d + b >= 3 ? 'bg-success-soft border-success-line' : d + b <= 1 ? 'bg-warning-soft border-warning-line' : 'bg-surface-2 border-line')}>
                            <div className="text-[18px] font-extrabold text-ink">{q.length}</div>
                            <div className="text-[11.5px] text-ink-2 leading-snug">{q.map((x) => s.nomeDe(x.id).split(' ')[0]).join(', ')}</div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'individual' && (
        <>
          <div className="mb-4 max-w-sm no-print"><Select label="Pessoa avaliada" value={avaliado} onChange={setAvaliado}><option value="">Selecione a pessoa avaliada…</option>{avaliados.map((id) => <option key={id} value={id}>{s.nomeDe(id)}</option>)}</Select></div>
          {!avaliado ? <Card><EmptyState icon="UserSearch" title="Escolha uma pessoa" /></Card> : <ResultadoIndividualCard c={c} avaliadoId={avaliado} />}
        </>
      )}
    </>
  )
}

export function ResultadoIndividualCard({ c, avaliadoId }: { c: CicloAvaliativo; avaliadoId: string }) {
  const s = useStore()
  const p = s.pessoa(avaliadoId)!
  const r = resultadoIndividual(avaliadoId, c, s.participantesCiclo, s.respostasAvaliacao, competenciasDe(p, s.competencias, 'desempenho'), responsaveisDe(p, s.colaboradores, s.setores))
  const REL = { responsavel: 'Responsável', autoavaliacao: 'Autoavaliação', pares_e_outros: 'Pares e outros' }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <Card className="p-5 self-start">
        <div className="flex items-center gap-3 mb-4"><Avatar nome={p.nome} cor={p.avatarCor} size="md" /><div><Link to={`/rh/pessoas/${p.id}`} className="font-semibold text-ink hover:text-brand">{p.nome}</Link><div className="text-[12px] text-muted">{s.cargoNome(p.cargoId)}</div></div></div>
        <RadialGauge valor={r.nota} rotulo="Nota geral (0–100)" tamanho={140} />
        <div className="text-[12px] text-muted text-center mt-2">{r.respondidas} de {r.total} avaliações respondidas</div>
        <ul className="mt-4 space-y-1.5">{r.porRelacao.filter((x) => x.n).map((x) => <li key={x.relacao} className="flex justify-between text-[12.5px]"><span className="text-ink-2">{REL[x.relacao]} ({x.n})</span><b className="tabular-nums">{x.nota ?? '—'}</b></li>)}</ul>
      </Card>
      <div className="space-y-6 min-w-0">
        <Card><CardHead title="Por competência" sub={`Média de 1 a ${c.niveisEscala}`} />
          <div className="p-5"><BarList total={c.niveisEscala} itens={r.porCompetencia.map((x) => ({ rotulo: `${x.comp.nome} (peso ${x.comp.peso})`, valor: x.media ?? 0 }))} vazio="Sem respostas ainda." /></div>
        </Card>
        <Card><CardHead title="Comentários" sub="Sem identificação do autor" />
          {r.comentarios.length === 0 ? <p className="p-5 text-[13px] text-muted">Sem comentários.</p> : <ul className="p-4 space-y-2">{r.comentarios.map((t, i) => <li key={i} className="text-[13px] text-ink-2 bg-surface-2 rounded-xl px-3.5 py-2.5">“{t}”</li>)}</ul>}
        </Card>
      </div>
    </div>
  )
}

