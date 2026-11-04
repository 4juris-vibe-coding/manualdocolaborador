/* People Analytics · Movimentação e turnover.
   Tudo é calculado a partir das DATAS EFETIVAS dos vínculos (domain/vinculos.ts),
   nunca do status atual. Fórmulas e critério ficam visíveis na própria tela. */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Badge, Button, Callout, Icon, Select, Tabela, TH, TD, EmptyState, BarList, Tabs } from '@/components/ui'
import { ColunasMensaisGrupo, LinhasMensais, rotuloMes } from '@/components/rh/GraficosMensais'
import { fmtDate, REGIME_LABEL } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { CRITERIO_LABEL, INICIATIVA_CURTA, movimentacaoDoPeriodo, permanenciaMedia, retencao, vinculosDe, ultimo, organizacaoEm, type CriterioMedia, type FiltroPessoas, type ItemMes, type MesMovimentacao } from '@/domain/vinculos'
import { useAtualizacaoAutomatica } from '@/data/sync'
import { BotaoImprimir } from '@/components/inputs'
import { RetencaoInicial } from '@/components/rh/RetencaoInicial'
import { ResumoRecrutamento } from '@/components/rh/ResumoRecrutamento'
import { MODO_API } from '@/data/config'

const V1 = 'var(--viz-1)', V2 = 'var(--viz-2)'
const pct = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const sinal = (v: number) => (v > 0 ? `+${v}` : `${v}`)

export default function PeopleAnalytics() {
  const s = useStore()
  const hoje = hojeISO()
  useAtualizacaoAutomatica()
  const anoAtual = Number(hoje.slice(0, 4))
  const primeiroAno = Math.min(anoAtual, ...s.colaboradores.flatMap((c) => vinculosDe(c).map((v) => Number(v.inicio.slice(0, 4)))).filter((n) => n > 1990))
  const [ano, setAno] = useState(String(anoAtual))
  const [mesSel, setMesSel] = useState<string | null>(hoje.slice(0, 7))
  const [f, setF] = useState<FiltroPessoas>({ setorId: 'todos', cargoId: 'todos', regime: 'todos', unidadeId: 'todos' })
  const [criterio, setCriterio] = useState<CriterioMedia>('inicio_fim')

  const de = `${ano}-01-01`, ate = Number(ano) === anoAtual ? hoje : `${ano}-12-31`
  // Área e função NA DATA (histórico com data efetiva), não só o cadastro atual.
  const fh = useMemo(() => ({ ...f, historico: s.historicoFuncao }), [f, s.historicoFuncao])
  const r = useMemo(() => movimentacaoDoPeriodo(s.colaboradores, de, ate, hoje, fh, criterio), [s.colaboradores, de, ate, hoje, fh, criterio])
  const meses = r.meses.map((m) => m.mes)
  const sel = r.meses.find((m) => m.mes === mesSel) ?? ultimo(r.meses)
  const idx = sel ? r.meses.indexOf(sel) : -1
  // Mês anterior pode estar no ano anterior: calcula com o mesmo critério e filtros.
  const anterior = useMemo(() => {
    if (!sel) return undefined
    if (idx > 0) return r.meses[idx - 1]
    const [y, mm] = sel.mes.split('-').map(Number)
    const mesAnt = mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`
    return movimentacaoDoPeriodo(s.colaboradores, `${mesAnt}-01`, `${mesAnt}-28`, hoje, fh, criterio).meses[0]
  }, [sel, idx, r.meses, s.colaboradores, hoje, fh, criterio])

  const ativosHoje = s.colaboradores.filter((c) => c.status !== 'encerrado').length
  const encerradosHoje = s.colaboradores.filter((c) => c.status === 'encerrado').length
  const perm = permanenciaMedia(s.colaboradores, de, ate, fh)
  const ret = retencao(s.colaboradores, `${Number(ano) - 1}-01-01`, ate, hoje, 90, fh)
  const motivos = useMemo(() => {
    const cont = new Map<string, number>()
    for (const m of r.meses) for (const d of m.pessoas.desligadas) { const n = s.motivosEncerramento.find((x) => x.id === d.motivoId)?.nome ?? 'Não informado'; cont.set(n, (cont.get(n) ?? 0) + 1) }
    return [...cont].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor)
  }, [r.meses, s.motivosEncerramento])
  const porArea = useMemo(() => {
    const u = ultimo(r.meses)
    const fim = u?.pessoas.finais ?? []
    const cont = new Map<string, number>()
    for (const i of fim) { const p = s.pessoa(i.pessoaId); const n = s.setorNome(p ? organizacaoEm(p, s.historicoFuncao, u!.fim).setorId : ''); cont.set(n, (cont.get(n) ?? 0) + 1) }
    return [...cont].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor)
  }, [r.meses]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportar = () => {
    const csv = gerarCSV(r.meses, [
      { titulo: 'Mês', valor: (m) => m.mes }, { titulo: 'Headcount inicial', valor: (m) => m.headcountInicial }, { titulo: 'Headcount final', valor: (m) => m.headcountFinal },
      { titulo: 'Headcount médio', valor: (m) => m.headcountMedio }, { titulo: 'Admissões', valor: (m) => m.admissoes }, { titulo: 'Desligamentos', valor: (m) => m.desligamentos },
      { titulo: 'Desligamentos involuntários', valor: (m) => m.involuntarios }, { titulo: 'Sem classificação', valor: (m) => m.naoClassificados }, { titulo: 'Saldo', valor: (m) => m.saldo },
      { titulo: 'Turnover geral (%)', valor: (m) => m.turnover ?? '' }, { titulo: 'Turnover involuntário (%)', valor: (m) => m.turnoverInvoluntario ?? '' },
    ], [`Movimentação de pessoas — 4JURIS — ${ano}`, `Critério do headcount médio: ${CRITERIO_LABEL[criterio]}`, 'Turnover geral = ((admissões + desligamentos) ÷ 2) ÷ headcount médio × 100', `Gerado em ${new Date().toLocaleString('pt-BR')}`])
    baixarArquivo(csv, `movimentacao-${ano}.csv`)
  }

  const anos = Array.from({ length: anoAtual - primeiroAno + 1 }, (_, i) => String(anoAtual - i))
  return (
    <>
      <PageHeader title="Movimentação & turnover" subtitle="Headcount, admissões, desligamentos e turnover mês a mês, pelas datas efetivas dos vínculos."
        actions={<><Button variant="ghost" icon="Download" onClick={exportar}>Exportar CSV</Button><BotaoImprimir /></>} />

      <Card className="p-4 mb-5 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Ano" value={ano} onChange={(v) => { setAno(v); setMesSel(Number(v) === anoAtual ? hoje.slice(0, 7) : `${v}-12`) }}>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</Select>
          <Select label="Mês em destaque" value={sel?.mes ?? ''} onChange={setMesSel}>{meses.map((m) => <option key={m} value={m}>{rotuloMes(m, true)}</option>)}</Select>
          <Select label="Área" value={f.setorId ?? 'todos'} onChange={(v) => setF({ ...f, setorId: v })}><option value="todos">Todas as áreas</option>{s.setores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
          <Select label="Função" value={f.cargoId ?? 'todos'} onChange={(v) => setF({ ...f, cargoId: v })}><option value="todos">Todas as funções</option>{s.cargos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
          <Select label="Forma de contratação" value={f.regime ?? 'todos'} onChange={(v) => setF({ ...f, regime: v })}><option value="todos">Todas as formas</option>{Object.entries(REGIME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          {s.unidades.length > 0 && <Select label="Unidade" value={f.unidadeId ?? 'todos'} onChange={(v) => setF({ ...f, unidadeId: v })}><option value="todos">Todas as unidades</option>{s.unidades.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>}
          <Select label="Headcount médio" value={criterio} onChange={(v) => setCriterio(v as CriterioMedia)}>{(Object.keys(CRITERIO_LABEL) as CriterioMedia[]).map((k) => <option key={k} value={k}>{CRITERIO_LABEL[k]}</option>)}</Select>
        </div>
      </Card>

      {sel && <>
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">{rotuloMes(sel.mes, true)}{sel.emCurso ? ' · mês em curso (até hoje)' : ''} <span className="normal-case font-normal">— comparação com {anterior ? rotuloMes(anterior.mes, true) : 'o mês anterior'}</span></h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <Kpi titulo="Headcount (fim do mês)" valor={num(sel.headcountFinal)} delta={anterior && sel.headcountFinal - anterior.headcountFinal} detalhe={`início: ${sel.headcountInicial} · médio: ${num(sel.headcountMedio)}`} onClick={() => setMesSel(sel.mes)} />
          <Kpi titulo="Admissões" valor={num(sel.admissoes)} delta={anterior && sel.admissoes - anterior.admissoes} onClick={() => setMesSel(sel.mes)} />
          <Kpi titulo="Desligamentos" valor={num(sel.desligamentos)} delta={anterior && sel.desligamentos - anterior.desligamentos} bomQuandoCai detalhe={sel.naoClassificados ? `${sel.naoClassificados} sem classificação` : undefined} onClick={() => setMesSel(sel.mes)} />
          <Kpi titulo="Saldo de movimentação" valor={sinal(sel.saldo)} delta={anterior && sel.saldo - anterior.saldo} detalhe="admissões − desligamentos" onClick={() => setMesSel(sel.mes)} />
          <Kpi titulo="Turnover geral" valor={pct(sel.turnover)} delta={anterior && sel.turnover != null && anterior.turnover != null ? Math.round((sel.turnover - anterior.turnover) * 10) / 10 : undefined} sufixo=" p.p." bomQuandoCai detalhe="((adm. + desl.) ÷ 2) ÷ HC médio" />
          <Kpi titulo="Turnover involuntário" valor={pct(sel.turnoverInvoluntario)} delta={anterior && sel.turnoverInvoluntario != null && anterior.turnoverInvoluntario != null ? Math.round((sel.turnoverInvoluntario - anterior.turnoverInvoluntario) * 10) / 10 : undefined} sufixo=" p.p." bomQuandoCai detalhe={`${sel.involuntarios} por iniciativa da 4JURIS`} />
          <Kpi titulo="Pessoas ativas hoje" valor={num(ativosHoje)} detalhe="parcerias não encerradas" link="/rh/pessoas" />
          <Kpi titulo="Pessoas desligadas" valor={num(encerradosHoje)} detalhe="cadastros com parceria encerrada" link="/rh/pessoas" />
        </div>
      </>}

      {r.naoClassificados > 0 && <Callout tone="warning" icon="AlertTriangle" className="mb-5"><b>{r.naoClassificados} desligamento(s) em {ano} sem iniciativa classificada.</b> Eles contam no turnover geral, mas não no involuntário. Classifique na ficha da pessoa (Corrigir encerramento).</Callout>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        <Card><CardHead title="Evolução do headcount" sub="Pessoas no quadro ao fim de cada mês. Clique num mês para ver quem estava." />
          <div className="p-4">{meses.length ? <LinhasMensais titulo="Headcount ao fim do mês" meses={meses} selecionado={sel?.mes} onSelecionar={setMesSel} series={[{ nome: 'Headcount', cor: V1, valores: r.meses.map((m) => m.headcountFinal) }]} /> : <EmptyState icon="LineChart" title="Sem dados" />}</div></Card>
        <Card><CardHead title="Admissões e desligamentos" sub="Pela data efetiva de início e de encerramento." />
          <div className="p-4"><ColunasMensaisGrupo titulo="Admissões e desligamentos por mês" meses={meses} selecionado={sel?.mes} onSelecionar={setMesSel} series={[{ nome: 'Admissões', cor: V1, valores: r.meses.map((m) => m.admissoes) }, { nome: 'Desligamentos', cor: V2, valores: r.meses.map((m) => m.desligamentos) }]} /></div></Card>
        <Card><CardHead title="Turnover geral e involuntário" sub="Percentual sobre o headcount médio do mês (mesma escala)." />
          <div className="p-4"><LinhasMensais titulo="Turnover mensal" meses={meses} selecionado={sel?.mes} onSelecionar={setMesSel} formato={(v) => `${num(v)}%`} series={[{ nome: 'Turnover geral', cor: V1, valores: r.meses.map((m) => m.turnover) }, { nome: 'Involuntário', cor: V2, valores: r.meses.map((m) => m.turnoverInvoluntario) }]} /></div></Card>
        <Card><CardHead title="Saldo de movimentação" sub="Admissões − desligamentos. Abaixo de zero, o quadro diminuiu." />
          <div className="p-4"><ColunasMensaisGrupo titulo="Saldo mensal" meses={meses} selecionado={sel?.mes} onSelecionar={setMesSel} formato={(v) => sinal(Math.round(v))} series={[{ nome: 'Saldo', cor: V1, valores: r.meses.map((m) => m.saldo) }]} /></div></Card>
      </div>

      {sel && <DetalheMes m={sel} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 my-5">
        <Card className="p-5"><div className="text-[12px] text-muted">Consolidado de {ano}</div>
          <dl className="mt-2 space-y-1.5 text-[13px]">
            <Linha r="Admissões" v={r.admissoes} /><Linha r="Desligamentos" v={r.desligamentos} /><Linha r="Saldo" v={sinal(r.saldo)} />
            <Linha r="Headcount médio" v={num(r.headcountMedio)} /><Linha r="Turnover geral" v={pct(r.turnover)} /><Linha r="Turnover involuntário" v={pct(r.turnoverInvoluntario)} />
            <Linha r="Permanência média (desligados)" v={perm == null ? '—' : `${Math.round(perm / 30.4)} meses`} />
            <Linha r="Retenção em 90 dias" v={ret.taxa == null ? '—' : `${pct(ret.taxa)} (${ret.retidos}/${ret.base})`} />
          </dl></Card>
        <Card><CardHead title="Motivos de desligamento" sub={`${ano}`} /><div className="p-5"><BarList itens={motivos} vazio="Nenhum desligamento no período." /></div></Card>
        <Card><CardHead title="Quadro por área" sub="Fim do período" /><div className="p-5"><BarList itens={porArea} vazio="Sem pessoas no quadro." /></div></Card>
      </div>

      <RetencaoInicial de={de} ate={ate} />
      {MODO_API && <ResumoRecrutamento de={de} ate={ate} />}

      <Card className="mb-5">
        <CardHead title="Mês a mês" sub="Clique numa linha para detalhar o mês." />
        <Tabela minWidth={900}>
          <thead><tr>{['Mês', 'HC inicial', 'Admissões', 'Desligamentos', 'Involuntários', 'Saldo', 'HC final', 'HC médio', 'Turnover', 'Involuntário'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{r.meses.map((m) => (
            <tr key={m.mes} onClick={() => setMesSel(m.mes)} className={`cursor-pointer hover:bg-brand-50/40 ${sel?.mes === m.mes ? 'bg-brand-50/60' : ''}`}>
              <td className={TD}><b>{rotuloMes(m.mes, true)}</b>{m.emCurso && <Badge tone="neutral" className="ml-1">em curso</Badge>}</td>
              <td className={TD}>{m.headcountInicial}</td><td className={TD}>{m.admissoes}</td><td className={TD}>{m.desligamentos}</td><td className={TD}>{m.involuntarios}</td>
              <td className={TD}>{sinal(m.saldo)}</td><td className={TD}>{m.headcountFinal}</td><td className={TD}>{num(m.headcountMedio)}</td><td className={TD}>{pct(m.turnover)}</td><td className={TD}>{pct(m.turnoverInvoluntario)}</td>
            </tr>
          ))}</tbody>
        </Tabela>
      </Card>

      <Card className="p-5">
        <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><Icon name="Sigma" className="h-4 w-4" />Metodologia</h3>
        <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2 list-disc pl-5">
          <li><b>Headcount em uma data</b>: pessoas com período de parceria iniciado até a data e não encerrado (no dia do encerramento a pessoa já não conta). Por isso, <i>final = inicial + admissões − desligamentos</i>.</li>
          <li><b>Headcount médio</b>: {criterio === 'inicio_fim' ? '(headcount inicial + headcount final) ÷ 2.' : 'média do quadro ao fim de cada dia do mês (mais precisa quando há muita movimentação no meio do mês).'} O mesmo critério vale para todos os meses e para o consolidado, que usa a média dos headcounts médios mensais.</li>
          <li><b>Turnover geral</b> = ((admissões + desligamentos) ÷ 2) ÷ headcount médio × 100.</li>
          <li><b>Turnover involuntário</b> = desligamentos por iniciativa da 4JURIS ÷ headcount médio × 100. A iniciativa é <b>escolhida pelo RH</b> em cada encerramento (nunca deduzida do texto do motivo). Sem classificação, o desligamento não entra no involuntário.</li>
          <li><b>Saldo</b> = admissões − desligamentos. Admissão é o início de um período de parceria (inclui o retorno de quem já trabalhou conosco); reativar um vínculo encerrado por engano desfaz o desligamento.</li>
          <li>Os cálculos usam as <b>datas efetivas</b> dos vínculos, não o status atual nem a data da última alteração. Os filtros de <b>área e função</b> usam o que a pessoa era <b>na data</b>, pelo histórico de movimentações com data efetiva (mudanças anteriores a este registro aparecem na data em que foram registradas). Forma de contratação e unidade usam o cadastro atual.</li>
        </ul>
      </Card>
    </>
  )
}

function Linha({ r, v }: { r: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted">{r}</dt><dd className="font-semibold text-ink">{v}</dd></div>
}

function Kpi({ titulo, valor, delta, detalhe, sufixo = '', bomQuandoCai, onClick, link }: { titulo: string; valor: string; delta?: number; detalhe?: string; sufixo?: string; bomQuandoCai?: boolean; onClick?: () => void; link?: string }) {
  const tom = delta == null || delta === 0 ? 'text-muted' : (delta > 0) !== !!bomQuandoCai ? 'text-success' : 'text-danger'
  const corpo = (
    <>
      <div className="text-[11.5px] text-muted">{titulo}</div>
      <div className="text-[22px] font-extrabold text-ink mt-0.5 leading-tight">{valor}</div>
      {delta != null && <div className={`text-[11.5px] font-semibold ${tom} flex items-center gap-1`}><Icon name={delta > 0 ? 'TrendingUp' : delta < 0 ? 'TrendingDown' : 'Minus'} className="h-3.5 w-3.5" />{delta > 0 ? '+' : ''}{num(delta)}{sufixo} vs mês anterior</div>}
      {detalhe && <div className="text-[11px] text-muted mt-0.5">{detalhe}</div>}
    </>
  )
  const cls = 'card p-4 text-left hover:border-brand-200 transition'
  if (link) return <Link to={link} className={cls}>{corpo}</Link>
  return <button type="button" onClick={onClick} className={cls}>{corpo}</button>
}

/** Quem compõe os números do mês: estava no início, entrou, saiu, permaneceu. */
function DetalheMes({ m }: { m: MesMovimentacao }) {
  const s = useStore()
  const [aba, setAba] = useState<'iniciais' | 'admitidas' | 'desligadas' | 'finais'>('admitidas')
  const lista: ItemMes[] = m.pessoas[aba]
  const rot = { iniciais: `No início (${m.headcountInicial})`, admitidas: `Admitidas (${m.admissoes})`, desligadas: `Desligadas (${m.desligamentos})`, finais: `No fim (${m.headcountFinal})` }
  return (
    <Card>
      <CardHead title={`Pessoas em ${rotuloMes(m.mes, true)}`} sub={`De ${fmtDate(m.inicio)} a ${fmtDate(m.fim)} · headcount inicial ${m.headcountInicial} → final ${m.headcountFinal}`} />
      <div className="px-4 pt-3"><Tabs tabs={(Object.keys(rot) as (keyof typeof rot)[]).map((k) => ({ key: k, label: rot[k] }))} active={aba} onChange={(k) => setAba(k as typeof aba)} /></div>
      {lista.length === 0 ? <EmptyState icon="Users" title="Ninguém nesta lista" /> : (
        <Tabela minWidth={680}>
          <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Área · Função</th><th className={TH}>Início do período</th><th className={TH}>Encerramento</th>{aba === 'desligadas' && <><th className={TH}>Motivo</th><th className={TH}>Tipo</th></>}</tr></thead>
          <tbody>{[...lista].sort((a, b) => s.nomeDe(a.pessoaId).localeCompare(s.nomeDe(b.pessoaId))).map((i) => {
            const c = s.pessoa(i.pessoaId)
            return (
              <tr key={i.vinculoId}>
                <td className={TD}><Link to={`/rh/pessoas/${i.pessoaId}`} className="font-semibold text-ink hover:text-brand">{c?.nome ?? '—'}</Link></td>
                <td className={TD}>{s.setorNome(c?.setorId ?? '')} · <span className="text-muted">{s.cargoNome(c?.cargoId ?? '')}</span></td>
                <td className={TD}>{fmtDate(i.inicio)}</td><td className={TD}>{i.fim ? fmtDate(i.fim) : '—'}</td>
                {aba === 'desligadas' && <><td className={TD}>{s.motivosEncerramento.find((x) => x.id === i.motivoId)?.nome ?? '—'}</td><td className={TD}>{i.iniciativa ? INICIATIVA_CURTA[i.iniciativa] : <Badge tone="warning">não classificado</Badge>}</td></>}
              </tr>
            )
          })}</tbody>
        </Tabela>
      )}
    </Card>
  )
}
