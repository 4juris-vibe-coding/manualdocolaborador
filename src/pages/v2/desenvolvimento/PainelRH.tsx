/* RH · Ciclo de desenvolvimento e AVD: painel, ciclos, visão histórica e configuração (prazos, escala, critérios e pesos). */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarList, Button, Callout, Card, CardHead, Field, PageHeader, SearchBox, Select, StatCard, Tabela, TD, TH, Tabs, Toggle, classesBotao } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { LinhaTempo } from '@/components/v2/charts2'
import { StatusCiclo } from '@/components/v2/desenvolvimento/comuns'
import { api, executar, qs, useApi } from '@/data/v2/api'
import { dataBR } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import { STATUS_DSV, type ConfigDesenvolvimento, type Criterio, type Modelo, type Pergunta } from '@/domain/v2/desenvolvimento'
import type { LinhaCiclo } from './Meu'

interface Painel {
  hoje: string; inicioVigencia: string | null
  indicadores: Record<'elegiveis' | 'acompanhamentosPendentes' | 'avdPrevistasMes' | 'avdAndamento' | 'avdConcluidas' | 'atrasados' | 'autoavaliacoesPendentes' | 'liderancaPendentes' | 'feedbackEquipePendentes' | 'semLideranca' | 'pdisAndamento' | 'pdisConcluidos' | 'acoesAtrasadas', number> & { acompanhamentosPorMarco: Record<string, number> }
  porStatus: Record<string, number>
  proximas: { pessoaId: string; nome: string; marco: string; rotulo: string; data: string; tipo: string }[]
  atencao: LinhaCiclo[]
  historico: { criterios: { nome: string; media: number; n: number }[]; competencias: { competencia: string; n: number }[]; evolucao: { semestre: string; media: number; n: number }[] }
  filtros: { setores: { id: string; nome: string }[]; cargos: { id: string; nome: string }[]; lideres: { id: string; nome: string }[] }
}
interface Filtros { setor: string; cargo: string; lider: string; tipo: string; status: string; de: string; ate: string; situacao: string; q: string; marco: string }
const FILTRO_VAZIO: Filtros = { setor: '', cargo: '', lider: '', tipo: '', status: '', de: '', ate: '', situacao: '', q: '', marco: '' }

export default function PainelDesenvolvimento() {
  const [tab, setTab] = useState('painel')
  const [f, setF] = useState<Filtros>(FILTRO_VAZIO)
  const filtroQs = qs({ ...f })
  const painel = useApi<Painel>(`desenvolvimento/painel${qs({ setor: f.setor, cargo: f.cargo, lider: f.lider, tipo: f.tipo, de: f.de, ate: f.ate })}`)
  const sincronizar = () => executar(() => api.post<{ criados: number; avancados: number; lembretes: number }>('desenvolvimento/sincronizar')).then((r) => { if (r) { painel.recarregar(); import('@/components/toast').then((t) => t.toast(`Rotina executada: ${r.criados} ciclo(s) aberto(s), ${r.avancados} avançado(s), ${r.lembretes} lembrete(s).`)) } })
  return (
    <>
      <PageHeader title="Ciclo de desenvolvimento" subtitle="Acompanhamento inicial (30/60/90 dias), AVD semestral, devolutivas e PDIs de toda a 4JURIS."
        actions={<>
          <Button variant="ghost" icon="RefreshCw" onClick={sincronizar}>Rodar rotina agora</Button>
          <a className={classesBotao('ghost')} href={api.url(`desenvolvimento/exportar${filtroQs}`)}>Exportar CSV</a>
        </>} />
      <SoComBanco>
        <Tabs tabs={[{ key: 'painel', label: 'Painel' }, { key: 'ciclos', label: 'Ciclos' }, { key: 'historico', label: 'Visão histórica' }, { key: 'config', label: 'Configuração' }]} active={tab} onChange={setTab} />
        {tab !== 'config' && painel.dados && <BarraFiltros f={f} setF={setF} opcoes={painel.dados.filtros} lista={tab === 'ciclos'} />}
        {tab === 'painel' && <Aguardar r={painel} linhas={4}>{(d) => <VisaoPainel d={d} irCiclos={(x) => { setF({ ...f, ...x }); setTab('ciclos') }} />}</Aguardar>}
        {tab === 'ciclos' && <ListaCiclos filtros={f} />}
        {tab === 'historico' && <Aguardar r={painel} linhas={3}>{(d) => <Historico d={d} />}</Aguardar>}
        {tab === 'config' && <Configuracao />}
      </SoComBanco>
    </>
  )
}

function BarraFiltros({ f, setF, opcoes, lista }: { f: Filtros; setF: (f: Filtros) => void; opcoes: Painel['filtros']; lista: boolean }) {
  const set = (k: keyof Filtros) => (v: string) => setF({ ...f, [k]: v })
  return (
    <div className="flex flex-wrap gap-3 mb-5 items-end">
      {lista && <SearchBox value={f.q} onChange={set('q')} placeholder="Nome da pessoa" label="Colaborador(a)" />}
      <Select label="Área" value={f.setor} onChange={set('setor')}><option value="">Todas as áreas</option>{opcoes.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
      <Select label="Função" value={f.cargo} onChange={set('cargo')}><option value="">Todas as funções</option>{opcoes.cargos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
      <Select label="Liderança" value={f.lider} onChange={set('lider')}><option value="">Todas as lideranças</option>{opcoes.lideres.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
      <Select label="Tipo" value={f.tipo} onChange={set('tipo')}><option value="">Acompanhamentos e AVDs</option><option value="acompanhamento">Acompanhamento inicial</option><option value="avd">AVD formal</option></Select>
      {lista && <Select label="Ciclo" value={f.marco} onChange={set('marco')}><option value="">Todos os marcos</option>{['30d', '60d', '90d', '6m', '12m', '18m', '24m', '30m', '36m'].map((m) => <option key={m} value={m}>{m.endsWith('d') ? `${m.slice(0, -1)} dias` : `${m.slice(0, -1)} meses`}</option>)}</Select>}
      {lista && <Select label="Status" value={f.status} onChange={set('status')}><option value="">Todos os status</option>{Object.entries(STATUS_DSV).filter(([k]) => k !== 'programada').map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</Select>}
      {lista && <Select label="Situação" value={f.situacao} onChange={set('situacao')}><option value="">Todas</option><option value="abertos">Em aberto</option><option value="atrasados">Em atraso</option><option value="encerrados">Encerrados/cancelados</option></Select>}
      <label className="flex items-center gap-2 text-[12.5px] text-muted">Previsto de<input type="date" className="input w-auto" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-[12.5px] text-muted">até<input type="date" className="input w-auto" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></label>
      {JSON.stringify(f) !== JSON.stringify(FILTRO_VAZIO) && <Button variant="subtle" icon="X" onClick={() => setF(FILTRO_VAZIO)}>Limpar</Button>}
    </div>
  )
}

function VisaoPainel({ d, irCiclos }: { d: Painel; irCiclos: (f: Partial<Filtros>) => void }) {
  const i = d.indicadores
  const card = (icon: string, valor: number, rotulo: string, tone: string, alvo?: Partial<Filtros>) => (
    <button type="button" className="text-left h-full" onClick={() => alvo && irCiclos(alvo)} disabled={!alvo}><StatCard compacto icon={icon} tone={tone} value={valor} label={rotulo} /></button>
  )
  return (
    <div className="space-y-6">
      {d.inicioVigencia && <p className="text-[12px] text-muted -mt-2">Módulo em vigor desde {dataBR(d.inicioVigencia)}. Marcos anteriores a essa data não foram gerados retroativamente.</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {card('Users', i.elegiveis, 'Colaboradores elegíveis', 'ink')}
        {card('Sprout', i.acompanhamentosPendentes, `Acompanhamentos em aberto (30: ${i.acompanhamentosPorMarco['30d'] ?? 0} · 60: ${i.acompanhamentosPorMarco['60d'] ?? 0} · 90: ${i.acompanhamentosPorMarco['90d'] ?? 0})`, 'brand', { tipo: 'acompanhamento', situacao: 'abertos' })}
        {card('CalendarClock', i.avdPrevistasMes, 'AVDs previstas para o mês', 'brand')}
        {card('ClipboardCheck', i.avdAndamento, 'AVDs em andamento', 'brand', { tipo: 'avd', situacao: 'abertos' })}
        {card('CheckCircle2', i.avdConcluidas, 'AVDs concluídas (período)', 'success', { tipo: 'avd', status: 'concluida' })}
        {card('AlarmClock', i.atrasados, 'Ciclos em atraso', 'danger', { situacao: 'atrasados' })}
        {card('UserCheck', i.autoavaliacoesPendentes, 'Autoavaliações/percepções pendentes', 'warning', { status: 'aguardando_autoavaliacao' })}
        {card('UserCog', i.liderancaPendentes, 'Avaliações da liderança pendentes', 'warning', { status: 'aguardando_lideranca' })}
        {card('MessagesSquare', i.feedbackEquipePendentes, 'Feedbacks sobre liderança pendentes', 'warning', { status: 'aguardando_equipe' })}
        {card('Target', i.pdisAndamento, 'PDIs em andamento', 'brand')}
        {card('Trophy', i.pdisConcluidos, 'PDIs com todas as ações concluídas', 'success')}
        {card('UserX', i.semLideranca, 'Ciclos sem liderança definida', 'danger', { status: 'sem_lideranca' })}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHead title="Precisa de atenção" sub="Em atraso ou sem liderança definida." />
          {d.atencao.length === 0 ? <p className="p-5 text-[13px] text-muted">Nada em atraso. 🎯</p> : (
            <ul className="divide-y divide-line">
              {d.atencao.map((c) => (
                <li key={c.id}><Link to={`/desenvolvimento/ciclos/${c.id}`} className="px-5 py-2.5 flex items-center gap-3 flex-wrap hover:bg-surface-2">
                  <span className="flex-1 min-w-[160px]"><span className="text-[13px] font-semibold text-ink">{c.colaboradorNome}</span><span className="block text-[12px] text-muted">{c.rotulo} · prazo {dataBR(c.prazo)}{c.avaliadorNome && ` · ${c.avaliadorNome}`}</span></span>
                  <StatusCiclo status={c.status} atrasado={c.atrasado} />
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHead title="Próximas avaliações" sub="Próximos 60 dias, calculados pelo início da parceria." />
          {d.proximas.length === 0 ? <p className="p-5 text-[13px] text-muted">Nenhum marco nos próximos 60 dias.</p> : (
            <ul className="divide-y divide-line max-h-[420px] overflow-y-auto">
              {d.proximas.map((p) => (
                <li key={p.pessoaId + p.marco} className="px-5 py-2.5 flex items-center gap-3">
                  <Link to={`/desenvolvimento/pessoas/${p.pessoaId}`} className="flex-1 min-w-0"><span className="text-[13px] font-semibold text-ink hover:text-brand">{p.nome}</span><span className="block text-[12px] text-muted">{p.rotulo}</span></Link>
                  <span className="text-[12.5px] text-ink-2 tabular-nums">{dataBR(p.data)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card>
        <CardHead title="Ciclos por status" sub="No período e filtros selecionados." />
        <div className="p-5"><BarList itens={Object.entries(d.porStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: STATUS_DSV[k as keyof typeof STATUS_DSV]?.rotulo ?? k, valor: v }))} /></div>
      </Card>
    </div>
  )
}

function ListaCiclos({ filtros }: { filtros: Filtros }) {
  const nav = useNavigate()
  const [pagina, setPagina] = useState(1)
  const chave = JSON.stringify(filtros)
  useEffect(() => setPagina(1), [chave])
  const r = useApi<{ itens: LinhaCiclo[]; total: number; pagina: number; por: number }>(`desenvolvimento/ciclos${qs({ ...filtros, pagina })}`)
  return (
    <Aguardar r={r} linhas={4}>
      {(d) => (
        <Card>
          {d.itens.length === 0 ? <p className="p-5 text-[13px] text-muted">Nenhum ciclo com esses filtros.</p> : (
            <Tabela minWidth={900}>
              <thead><tr><th className={TH}>Colaborador(a)</th><th className={TH}>Ciclo</th><th className={TH}>Liderança</th><th className={TH}>Previsto</th><th className={TH}>Prazo da etapa</th><th className={TH}>Status</th></tr></thead>
              <tbody>
                {d.itens.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-surface-2" onClick={() => nav(`/desenvolvimento/ciclos/${c.id}`)}>
                    <td className={TD}><Link to={`/desenvolvimento/ciclos/${c.id}`} className="font-semibold text-ink hover:text-brand" onClick={(e) => e.stopPropagation()}>{c.colaboradorNome}</Link><div className="text-[12px] text-muted">{[c.cargoNome, c.setorNome].filter(Boolean).join(' · ')}</div></td>
                    <td className={TD}><span className="text-[12.5px]">{c.rotulo}</span>{c.lideranca && <div className="text-[11.5px] text-muted">critérios de liderança</div>}</td>
                    <td className={TD}><span className="text-[12.5px]">{c.avaliadorNome ?? '—'}</span></td>
                    <td className={TD}><span className="text-[12.5px] tabular-nums">{dataBR(c.dataPrevista)}</span></td>
                    <td className={TD}><span className={cn('text-[12.5px] tabular-nums', c.atrasado && 'text-danger font-semibold')}>{dataBR(c.prazo)}</span></td>
                    <td className={TD}><StatusCiclo status={c.status} atrasado={c.atrasado} /></td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
          <div className="px-5 py-3"><Paginacao pagina={d.pagina} por={d.por} total={d.total} onPagina={setPagina} /></div>
        </Card>
      )}
    </Aguardar>
  )
}

function Historico({ d }: { d: Painel }) {
  const h = d.historico
  return (
    <div className="space-y-6">
      <Callout tone="neutral" icon="Info">Indicadores agregados de apoio à gestão do desenvolvimento. Não incluem o feedback confidencial das equipes nem identificam pessoas, e não devem ser usados, sozinhos, para decisões contratuais.</Callout>
      <Card>
        <CardHead title="Evolução semestral" sub="Média das avaliações da liderança (1 a 5) por semestre da data prevista." />
        <div className="p-5"><LinhaTempo titulo="Média por semestre" pontos={h.evolucao.map((e) => ({ rotulo: e.semestre, valor: e.media }))} formato={(v) => String(v).replace('.', ',')} /></div>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHead title="Critérios com menor média" sub="AVDs concluídas · pistas de necessidade de treinamento" />
          <div className="p-5"><BarList itens={h.criterios.slice(0, 10).map((c) => ({ rotulo: `${c.nome} (${c.n})`, valor: c.media, sufixo: '' }))} total={5} vazio="Sem AVDs concluídas no período." /></div>
        </Card>
        <Card>
          <CardHead title="Competências mais trabalhadas nos PDIs" sub="Recorrência de temas de desenvolvimento" />
          <div className="p-5"><BarList itens={h.competencias.map((c) => ({ rotulo: c.competencia, valor: c.n }))} vazio="Sem ações registradas no período." /></div>
        </Card>
      </div>
    </div>
  )
}

/* ---------- configuração ---------- */
type ModeloCfg = Modelo & { rotulo: string; personalizado: boolean }
function Configuracao() {
  const r = useApi<{ config: ConfigDesenvolvimento; modelos: ModeloCfg[]; padrao: ConfigDesenvolvimento }>('desenvolvimento/config')
  return <Aguardar r={r} linhas={4}>{(d) => <div className="space-y-6"><ConfigGeral inicial={d.config} onSalvo={r.recarregar} /><EditorModelos modelos={d.modelos} onSalvo={r.recarregar} /></div>}</Aguardar>
}

function ConfigGeral({ inicial, onSalvo }: { inicial: ConfigDesenvolvimento; onSalvo: () => void }) {
  const [c, setC] = useState(inicial)
  const n = (rotulo: string, valor: number, set: (v: number) => void, id: string, hint?: string) => (
    <Field label={rotulo} htmlFor={id} hint={hint}><input id={id} type="number" min={0} className="input" value={valor} onChange={(e) => set(Number(e.target.value))} /></Field>
  )
  return (
    <Card>
      <CardHead title="Prazos, escala e confidencialidade" sub="Valores fora da faixa permitida voltam ao padrão ao salvar." />
      <div className="p-5 sm:p-6 space-y-6">
        <section>
          <h3 className="text-[13px] font-bold text-ink mb-2">Acompanhamento inicial (30/60/90)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            {n('Abrir com antecedência (dias)', c.acompanhamento.antecedenciaDias, (v) => setC({ ...c, acompanhamento: { ...c.acompanhamento, antecedenciaDias: v } }), 'cf-a1')}
            {n('Prazo para as percepções (dias)', c.acompanhamento.prazoDias, (v) => setC({ ...c, acompanhamento: { ...c.acompanhamento, prazoDias: v } }), 'cf-a2', 'Contados da data do marco')}
            {n('Prazo para o registro (dias)', c.acompanhamento.registroDias, (v) => setC({ ...c, acompanhamento: { ...c.acompanhamento, registroDias: v } }), 'cf-a3')}
          </div>
        </section>
        <section>
          <h3 className="text-[13px] font-bold text-ink mb-2">AVD semestral</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            {n('Abrir com antecedência (dias)', c.avd.antecedenciaDias, (v) => setC({ ...c, avd: { ...c.avd, antecedenciaDias: v } }), 'cf-v1')}
            {n('Prazo dos formulários (dias)', c.avd.prazoColetaDias, (v) => setC({ ...c, avd: { ...c.avd, prazoColetaDias: v } }), 'cf-v2', 'Contados da data prevista')}
            {n('Prazo da consolidação (dias)', c.avd.prazoConsolidacaoDias, (v) => setC({ ...c, avd: { ...c.avd, prazoConsolidacaoDias: v } }), 'cf-v3')}
            {n('Prazo da devolutiva (dias)', c.avd.prazoDevolutivaDias, (v) => setC({ ...c, avd: { ...c.avd, prazoDevolutivaDias: v } }), 'cf-v4')}
            {n('Prazo do PDI (dias)', c.avd.prazoPdiDias, (v) => setC({ ...c, avd: { ...c.avd, prazoPdiDias: v } }), 'cf-v5')}
            {n('Prazo de encerramento (dias)', c.avd.prazoEncerramentoDias, (v) => setC({ ...c, avd: { ...c.avd, prazoEncerramentoDias: v } }), 'cf-v6')}
          </div>
        </section>
        <section>
          <h3 className="text-[13px] font-bold text-ink mb-2">Feedback da equipe sobre a liderança</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            {n('Mínimo de respostas para exibir resultados', c.feedbackLideranca.minRespostas, (v) => setC({ ...c, feedbackLideranca: { ...c.feedbackLideranca, minRespostas: v } }), 'cf-f1', 'Entre 2 e 20. Abaixo disso nada é exibido.')}
            {n('Tempo mínimo na equipe para avaliar (dias)', c.feedbackLideranca.minDiasNaEquipe, (v) => setC({ ...c, feedbackLideranca: { ...c.feedbackLideranca, minDiasNaEquipe: v } }), 'cf-f2')}
            {n('Lembrete antes do prazo (dias)', c.lembreteDiasAntes, (v) => setC({ ...c, lembreteDiasAntes: v }), 'cf-l')}
          </div>
        </section>
        <section>
          <h3 className="text-[13px] font-bold text-ink mb-2">Escala da AVD</h3>
          <div className="space-y-2">
            {c.escala.map((e, i) => (
              <div key={e.valor} className="grid grid-cols-[32px_1fr] sm:grid-cols-[32px_200px_1fr] gap-2 items-center">
                <span className="h-8 w-8 rounded-lg bg-brand-100 text-brand font-bold flex items-center justify-center">{e.valor}</span>
                <input aria-label={`Rótulo do nível ${e.valor}`} className="input" value={e.rotulo} onChange={(x) => setC({ ...c, escala: c.escala.map((y, j) => (j === i ? { ...y, rotulo: x.target.value } : y)) })} />
                <input aria-label={`Descrição do nível ${e.valor}`} className="input col-span-2 sm:col-span-1" value={e.descricao} onChange={(x) => setC({ ...c, escala: c.escala.map((y, j) => (j === i ? { ...y, descricao: x.target.value } : y)) })} />
              </div>
            ))}
          </div>
          <fieldset className="mt-4"><legend className="label">Níveis que exigem justificativa ou evidência</legend>
            <div className="flex gap-2">{[1, 2, 3, 4, 5].map((v) => { const on = c.justificativaObrigatoria.includes(v); return <button key={v} type="button" aria-pressed={on} className={cn('chip', on && 'chip-active')} onClick={() => setC({ ...c, justificativaObrigatoria: on ? c.justificativaObrigatoria.filter((x) => x !== v) : [...c.justificativaObrigatoria, v] })}>{v}</button> })}</div>
          </fieldset>
        </section>
        <section className="space-y-3">
          <Toggle checked={c.colaboradorVeAvaliacaoLideranca} onChange={(v) => setC({ ...c, colaboradorVeAvaliacaoLideranca: v })} label="A pessoa avaliada vê a avaliação da liderança depois da devolutiva" />
          <Toggle checked={c.avisarRhInicio} onChange={(v) => setC({ ...c, avisarRhInicio: v })} label="Avisar o RH a cada ciclo iniciado" />
        </section>
        <Button icon="Check" onClick={() => executar(() => api.put('desenvolvimento/config', c), 'Configuração salva.').then((ok) => { if (ok) onSalvo() })}>Salvar configuração</Button>
      </div>
    </Card>
  )
}

function EditorModelos({ modelos, onSalvo }: { modelos: ModeloCfg[]; onSalvo: () => void }) {
  const [chave, setChave] = useState<string>(modelos[0]?.chave ?? '')
  const atual = modelos.find((m) => m.chave === chave)!
  const [m, setM] = useState<ModeloCfg>(atual)
  useEffect(() => setM(atual), [chave]) // eslint-disable-line react-hooks/exhaustive-deps
  const somaPesos = useMemo(() => m.criterios.reduce((s, k) => s + (Number(k.peso) || 0), 0), [m])
  const novoId = (pref: string, usados: string[]) => { let i = 1; while (usados.includes(`${pref}${i}`)) i++; return `${pref}${i}` }
  const ids = [...m.criterios.map((k) => k.id), ...m.perguntas.map((p) => p.id)]
  const setK = (i: number, k: Partial<Criterio>) => setM({ ...m, criterios: m.criterios.map((x, j) => (j === i ? { ...x, ...k } : x)) })
  const setP = (i: number, p: Partial<Pergunta>) => setM({ ...m, perguntas: m.perguntas.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  return (
    <Card>
      <CardHead title="Formulários, critérios e pesos" sub="Cada gravação cria uma nova versão. Ciclos já abertos continuam com a versão que receberam." />
      <div className="p-5 sm:p-6">
        <Select label="Formulário" value={chave} onChange={setChave}>{modelos.map((x) => <option key={x.chave} value={x.chave}>{x.rotulo} (v{x.versao}{x.personalizado ? '' : ', padrão'})</option>)}</Select>
        <div className="grid grid-cols-1 gap-x-4 mt-4">
          <Field label="Título" htmlFor="md-t" required><input id="md-t" className="input" value={m.titulo} onChange={(e) => setM({ ...m, titulo: e.target.value })} /></Field>
          <Field label="Orientação para quem responde" htmlFor="md-d"><textarea id="md-d" rows={2} className="input" value={m.descricao} onChange={(e) => setM({ ...m, descricao: e.target.value })} /></Field>
        </div>
        <h3 className="text-[13px] font-bold text-ink mt-2 mb-2">Critérios avaliados <span className="text-muted font-normal">· escala {m.escala === 'percepcao' ? 'de percepção' : 'da AVD'} · soma dos pesos {somaPesos}</span></h3>
        <div className="space-y-2">
          {m.criterios.map((k, i) => (
            <div key={k.id} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_90px_40px] gap-2 items-center rounded-xl border border-line p-2">
              <input aria-label="Nome do critério" className="input" value={k.nome} onChange={(e) => setK(i, { nome: e.target.value })} />
              <input aria-label="Dimensão" className="input" placeholder="Dimensão" value={k.dimensao} onChange={(e) => setK(i, { dimensao: e.target.value })} />
              <input aria-label="Peso" type="number" min={0.1} max={10} step={0.5} className="input" value={k.peso} onChange={(e) => setK(i, { peso: Number(e.target.value) })} />
              <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover ${k.nome}`} onClick={() => setM({ ...m, criterios: m.criterios.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
        <Button className="mt-2" size="sm" variant="soft" icon="Plus" onClick={() => setM({ ...m, criterios: [...m.criterios, { id: novoId('c', ids), nome: 'Novo critério', dimensao: m.criterios[m.criterios.length - 1]?.dimensao ?? 'Geral', peso: 1, descricao: '' }] })}>Incluir critério</Button>
        <p className="text-[12px] text-muted mt-1.5">O peso define quanto o critério conta na média de apoio. As dimensões agrupam as etapas do formulário.</p>
        <h3 className="text-[13px] font-bold text-ink mt-5 mb-2">Perguntas abertas</h3>
        <div className="space-y-2">
          {m.perguntas.map((p, i) => (
            <div key={p.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_40px] gap-2 items-center rounded-xl border border-line p-2">
              <input aria-label="Pergunta" className="input" value={p.texto} onChange={(e) => setP(i, { texto: e.target.value })} />
              <label className="inline-flex items-center gap-2 text-[12.5px] px-2"><input type="checkbox" checked={p.obrigatoria} onChange={(e) => setP(i, { obrigatoria: e.target.checked })} />Obrigatória</label>
              <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover pergunta" onClick={() => setM({ ...m, perguntas: m.perguntas.filter((_, j) => j !== i) })} />
            </div>
          ))}
        </div>
        <Button className="mt-2" size="sm" variant="soft" icon="Plus" onClick={() => setM({ ...m, perguntas: [...m.perguntas, { id: novoId('p', ids), texto: 'Nova pergunta', obrigatoria: false }] })}>Incluir pergunta</Button>
        <div className="mt-6 flex gap-2 flex-wrap">
          <Button icon="Check" onClick={() => executar(() => api.put(`desenvolvimento/modelos/${m.chave}`, m), 'Nova versão do formulário salva.').then((ok) => { if (ok) onSalvo() })}>Salvar nova versão</Button>
          <Button variant="ghost" onClick={() => setM(atual)}>Descartar alterações</Button>
        </div>
      </div>
    </Card>
  )
}
