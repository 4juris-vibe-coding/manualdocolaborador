import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Button, IndicadorCard, BarList, ColunasMensais, Callout, Select, Icon } from '@/components/ui'
import { toast } from '@/components/toast'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import {
  indicadoresPessoas, distribuicaoPorSetor, faixasTempoParceria, encerramentosPorMotivo, indicadoresOnboarding,
  indicadoresEventos, indicadoresGamificacao, serieMensal, type Filtro,
} from '@/domain/analytics'
import { ACAO_LABEL } from '@/domain/gamificacao'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { MODO_DEMO } from '@/data/config'
import type { AcaoPontuavel } from '@/lib/types'

const PRESETS = [
  { key: '30', label: 'Últimos 30 dias', dias: 30 },
  { key: '90', label: 'Últimos 90 dias', dias: 90 },
  { key: '365', label: 'Últimos 12 meses', dias: 365 },
  { key: 'custom', label: 'Personalizado', dias: 0 },
]
const ICON_IND: Record<string, [string, string]> = { ativos: ['Users', 'brand'], inicios: ['UserPlus', 'success'], encerramentos: ['UserMinus', 'ink'], taxa: ['Percent', 'ink'], contratos: ['FileClock', 'warning'], docs: ['FileWarning', 'danger'] }

export default function Indicadores() {
  const s = useStore()
  const hoje = hojeISO()
  const [preset, setPreset] = useState('90')
  const [ini, setIni] = useState(somarDias(hoje, -90))
  const [fim, setFim] = useState(hoje)
  const [setor, setSetor] = useState('todos')

  const filtro: Filtro = useMemo(() => {
    const p = PRESETS.find((x) => x.key === preset)!
    return preset === 'custom' ? { inicio: ini <= fim ? ini : fim, fim: fim >= ini ? fim : ini, setorId: setor } : { inicio: somarDias(hoje, -p.dias), fim: hoje, setorId: setor }
  }, [preset, ini, fim, setor, hoje])

  const pessoas = indicadoresPessoas(s, filtro, hoje)
  const onb = indicadoresOnboarding(s, filtro)
  const ev = indicadoresEventos(s, filtro)
  const gm = indicadoresGamificacao(s, filtro)
  const dist = distribuicaoPorSetor(s, filtro.fim)
  const faixas = faixasTempoParceria(s, filtro, filtro.fim)
  const motivos = encerramentosPorMotivo(s, filtro)
  const doSetor = (id: string) => setor === 'todos' || s.pessoa(id)?.setorId === setor
  const serieInicios = serieMensal(s.colaboradores.filter((c) => doSetor(c.id)).map((c) => c.dataEntrada), filtro.fim)
  const serieEnc = serieMensal(s.colaboradores.filter((c) => doSetor(c.id)).map((c) => c.encerramento?.data), filtro.fim)

  // Pesquisas no período: taxa de resposta = participações ÷ pessoas convidadas ativas.
  const pesquisas = s.pesquisas.filter((p) => p.status !== 'rascunho' && p.inicio <= filtro.fim && p.fim >= filtro.inicio).map((p) => {
    const convidados = s.colaboradores.filter((c) => c.status !== 'encerrado' && (p.setoresAlvo.length === 0 || p.setoresAlvo.includes(c.setorId)) && (setor === 'todos' || c.setorId === setor))
    const part = s.participacoes.filter((x) => x.pesquisaId === p.id && convidados.some((c) => c.id === x.colaboradorId)).length
    return { p, convidados: convidados.length, part, taxa: convidados.length ? Math.round((part / convidados.length) * 100) : 0 }
  })

  const rotuloFiltro = `${fmtDate(filtro.inicio)} a ${fmtDate(filtro.fim)} · Área: ${setor === 'todos' ? 'todas' : s.setorNome(setor)}`

  const exportar = () => {
    const linhas = [
      ...pessoas.map((i) => ({ grupo: 'Pessoas e contratos', titulo: i.titulo, valor: String(i.valor), definicao: i.definicao, fonte: i.fonte })),
      { grupo: 'Integração', titulo: 'Integrações em andamento', valor: String(onb.andamento), definicao: 'Processos de integração sem data de conclusão.', fonte: 'Jornadas de integração' },
      { grupo: 'Integração', titulo: 'Progresso médio (%)', valor: String(onb.pctMedio), definicao: 'Média do percentual de itens concluídos nos processos em andamento.', fonte: 'Jornadas de integração' },
      { grupo: 'Integração', titulo: 'Concluídas no período', valor: String(onb.concluidosPeriodo), definicao: 'Processos concluídos dentro do período.', fonte: 'Jornadas de integração' },
      { grupo: 'Eventos', titulo: 'Eventos realizados/agendados', valor: String(ev.total), definicao: 'Eventos não cancelados com início no período.', fonte: 'Agenda' },
      { grupo: 'Eventos', titulo: 'Confirmações', valor: String(ev.confirmacoes), definicao: 'Soma de confirmações (participação opcional).', fonte: 'Agenda' },
      { grupo: 'Eventos', titulo: 'Presenças registradas', valor: String(ev.presencas), definicao: 'Presenças registradas pela organização.', fonte: 'Agenda' },
      { grupo: 'Gamificação', titulo: 'Pontos lançados', valor: String(gm.pontos), definicao: 'Soma dos lançamentos no período.', fonte: 'Histórico de pontos' },
      { grupo: 'Gamificação', titulo: 'Reconhecimentos', valor: String(gm.reconhecimentos), definicao: 'Reconhecimentos recebidos no período.', fonte: 'Mural de reconhecimentos' },
      ...pesquisas.map((x) => ({ grupo: 'Pesquisas', titulo: `Taxa de resposta — ${x.p.titulo}`, valor: `${x.taxa}% (${x.part}/${x.convidados})`, definicao: 'Participações ÷ pessoas convidadas ativas.', fonte: 'Registro de participação (sem vínculo com respostas)' })),
    ]
    const csv = gerarCSV(linhas, [
      { titulo: 'Grupo', valor: (r) => r.grupo }, { titulo: 'Indicador', valor: (r) => r.titulo }, { titulo: 'Valor', valor: (r) => r.valor },
      { titulo: 'Definição', valor: (r) => r.definicao }, { titulo: 'Fonte', valor: (r) => r.fonte },
    ], [`Relatório de indicadores — 4JURIS Pessoas`, `Período: ${rotuloFiltro}`, `Gerado em: ${new Date().toLocaleString('pt-BR')}`, ...(MODO_DEMO ? ['ATENÇÃO: dados fictícios de demonstração'] : [])])
    baixarArquivo(csv, `indicadores-${filtro.inicio}-a-${filtro.fim}.csv`)
    toast('Relatório exportado em CSV.')
  }

  return (
    <>
      <PageHeader title="Indicadores de pessoas" subtitle="Cada número tem definição e fonte — toque no ícone ⓘ de qualquer cartão."
        actions={<Button variant="ghost" icon="Download" onClick={exportar}>Exportar CSV</Button>} />

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div><span className="label">Período</span><Select label="Período" value={preset} onChange={setPreset}>{PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</Select></div>
          {preset === 'custom' && <>
            <div><label className="label" htmlFor="f-ini">De</label><input id="f-ini" type="date" className="input w-auto" value={ini} max={fim} onChange={(e) => setIni(e.target.value)} /></div>
            <div><label className="label" htmlFor="f-fim">Até</label><input id="f-fim" type="date" className="input w-auto" value={fim} min={ini} onChange={(e) => setFim(e.target.value)} /></div>
          </>}
          <div><span className="label">Área</span><Select label="Área" value={setor} onChange={setSetor}><option value="todos">Todas as áreas</option>{s.setores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select></div>
          <div className="text-[12px] text-muted ml-auto pb-3">{rotuloFiltro}</div>
        </div>
      </Card>

      {MODO_DEMO && <Callout tone="warning" icon="FlaskConical" className="mb-6">Indicadores calculados sobre <b>dados fictícios de demonstração</b>. Não representam a 4JURIS real.</Callout>}

      <AvisosRH />

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Pessoas e contratos</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {pessoas.map((i) => <IndicadorCard key={i.id} titulo={i.titulo} valor={i.valor} definicao={i.definicao} fonte={i.fonte} detalhe={i.detalhe} icon={ICON_IND[i.id]?.[0]} tone={ICON_IND[i.id]?.[1]} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHead title="Parcerias ativas por área" sub={`Em ${fmtDate(filtro.fim)}`} />
          <div className="p-5"><BarList itens={dist.map((d) => ({ rotulo: d.nome, valor: d.qtd, cor: d.cor }))} /></div>
        </Card>
        <Card>
          <CardHead title="Tempo de parceria" sub="Parcerias ativas por faixa" />
          <div className="p-5"><BarList itens={faixas.map((f) => ({ rotulo: f.rotulo, valor: f.qtd }))} /></div>
        </Card>
        <Card>
          <CardHead title="Encerramentos por motivo" sub="No período" />
          <div className="p-5"><BarList itens={motivos.map((m) => ({ rotulo: m.nome, valor: m.qtd, cor: '#3d4b56' }))} vazio="Nenhum encerramento no período." /></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card><CardHead title="Novas parcerias por mês" sub="Últimos 6 meses até o fim do período" /><div className="p-5"><ColunasMensais dados={serieInicios} rotulo="Novas parcerias por mês" /></div></Card>
        <Card><CardHead title="Encerramentos por mês" sub="Últimos 6 meses até o fim do período" /><div className="p-5"><ColunasMensais dados={serieEnc} rotulo="Encerramentos por mês" /></div></Card>
      </div>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Integração</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <IndicadorCard titulo="Integrações em andamento" valor={onb.andamento} icon="Rocket" definicao="Processos de integração iniciados e ainda não concluídos (independe do período)." fonte="Jornadas de integração" />
        <IndicadorCard titulo="Progresso médio" valor={`${onb.pctMedio}%`} icon="ListChecks" tone="success" definicao="Média do percentual de itens concluídos nos processos em andamento." fonte="Checklists de integração" />
        <IndicadorCard titulo="Concluídas no período" valor={onb.concluidosPeriodo} icon="BadgeCheck" tone="success" definicao="Integrações com todos os itens concluídos dentro do período." fonte="Jornadas de integração" />
        <IndicadorCard titulo="Itens pendentes do RH" valor={onb.pendRH} icon="ClipboardList" tone="warning" definicao="Itens sob responsabilidade do RH ainda não concluídos nas integrações em andamento." fonte="Checklists de integração" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Eventos e cultura</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <IndicadorCard titulo="Eventos no período" valor={ev.total} icon="CalendarHeart" definicao="Eventos não cancelados com início no período (visíveis à área filtrada)." fonte="Agenda" detalhe={`${ev.cancelados} cancelado(s)`} />
            <IndicadorCard titulo="Presenças registradas" valor={ev.presencas} icon="ClipboardCheck" tone="success" definicao="Soma das presenças registradas pela organização. Confirmações são opcionais e não equivalem a presença." fonte="Agenda" detalhe={`${ev.confirmacoes} confirmações`} />
          </div>
          <Card><CardHead title="Eventos por categoria" /><div className="p-5"><BarList itens={ev.porCategoria.map((c) => ({ rotulo: c.nome, valor: c.qtd }))} /></div></Card>
        </div>
        <div>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Gamificação e reconhecimento</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <IndicadorCard titulo="Reconhecimentos" valor={gm.reconhecimentos} icon="Heart" tone="danger" definicao="Reconhecimentos recebidos por pessoas da área filtrada, no período." fonte="Mural de reconhecimentos" />
            <IndicadorCard titulo="Pessoas que pontuaram" valor={gm.pessoasPontuaram} icon="Trophy" definicao="Pessoas com ao menos um lançamento de pontos no período. Mede participação, não desempenho." fonte="Histórico de pontos" detalhe={`${gm.pontos.toLocaleString('pt-BR')} pts · ${gm.conquistas} conquista(s)`} />
          </div>
          <Card><CardHead title="Pontos por tipo de ação" sub="Distribuição no período" /><div className="p-5"><BarList itens={gm.porAcao.map((a) => ({ rotulo: ACAO_LABEL[a.acao as AcaoPontuavel], valor: a.pts }))} /></div></Card>
        </div>
      </div>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Pesquisas de engajamento</h2>
      <Card className="mb-4">
        {pesquisas.length === 0 ? <p className="text-[13px] text-muted p-5">Nenhuma pesquisa aberta ou encerrada no período.</p> : (
          <ul className="divide-y divide-line">
            {pesquisas.map((x) => (
              <li key={x.p.id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]"><div className="text-[13.5px] font-semibold text-ink">{x.p.titulo}</div><div className="text-[12px] text-muted">{fmtDate(x.p.inicio)} → {fmtDate(x.p.fim)} · {x.p.status === 'aberta' ? 'aberta' : 'encerrada'}</div></div>
                <div className="w-48"><div className="flex justify-between text-[12px] mb-1"><span className="text-muted">Taxa de resposta</span><b className="text-ink">{x.taxa}%</b></div><div className="h-2 rounded-full bg-winter overflow-hidden"><div className="h-full bg-brand" style={{ width: `${x.taxa}%` }} /></div><div className="text-[11px] text-muted mt-1">{x.part} de {x.convidados} pessoas</div></div>
                <Link to="/rh/pesquisas" className="text-[12.5px] font-semibold text-brand">Resultados →</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-[11.5px] text-muted">Indicadores descritivos: mostram o que aconteceu, não explicam causas. Não há índices de produtividade, tempo conectado ou rankings individuais.</p>
    </>
  )
}

function AvisosRH() {
  const s = useStore()
  const hoje = hojeISO()
  const lim = somarDias(hoje, 60)
  const ativos = new Set(s.colaboradores.filter((c) => c.status !== 'encerrado').map((c) => c.id))
  const avisos = [
    { n: s.avaliacoesInicio.filter((a) => a.status === 'pendente' && a.expiraEm >= hoje).length, t: 'avaliação(ões) de início de parceria pendentes', icon: 'Sprout', to: '/rh/inicio-parceria', tone: 'brand' },
    { n: s.exigencias.filter((e) => ativos.has(e.colaboradorId) && e.validade && e.validade <= lim).length, t: 'exigência(s) vencida(s) ou vencendo em 60 dias', icon: 'ShieldAlert', to: '/rh/exigencias', tone: 'danger' },
    { n: s.documentos.filter((d) => ativos.has(d.colaboradorId) && d.validade && d.validade <= lim).length, t: 'documento(s) vencido(s) ou vencendo', icon: 'FileWarning', to: '/rh/documentos', tone: 'warning' },
    { n: s.contratos.filter((k) => k.status !== 'encerrado' && k.fim && k.fim >= hoje && k.fim <= lim).length, t: 'contrato(s) com término em 60 dias', icon: 'FileClock', to: '/rh/pessoas', tone: 'warning' },
    { n: s.processos.filter((p) => !p.concluidoEm).reduce((a, p) => a + p.itens.filter((i) => !i.feito && i.responsavel === 'rh').length, 0), t: 'item(ns) de integração/encerramento com o RH', icon: 'ListChecks', to: '/rh/jornadas', tone: 'brand' },
    { n: s.ciclos.filter((c) => c.status === 'ativo').reduce((a, c) => a + s.participantesCiclo.filter((p) => p.cicloId === c.id && !s.respostasAvaliacao.some((r) => r.participanteId === p.id)).length, 0), t: 'resposta(s) pendente(s) em ciclos de avaliação', icon: 'ClipboardCheck', to: '/rh/avaliacoes', tone: 'neutral' },
    { n: s.notas.filter((n) => n.status === 'enviada').length, t: 'nota(s) fiscal(is) aguardando aprovação', icon: 'FileText', to: '/notas', tone: 'brand' },
  ].filter((a) => a.n > 0)
  if (!avisos.length) return null
  const cor: Record<string, string> = { brand: 'bg-brand-50 text-brand', danger: 'bg-danger-soft text-danger', warning: 'bg-warning-soft text-warning', neutral: 'bg-winter text-ink-2' }
  return (
    <Card className="mb-8 no-print">
      <CardHead title="Central de avisos" sub="O que precisa de ação do RH agora" />
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {avisos.map((a) => (
          <li key={a.t}><Link to={a.to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 border-b border-line">
            <span className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${cor[a.tone]}`}><Icon name={a.icon} className="h-5 w-5" /></span>
            <span className="text-[13px] text-ink-2 flex-1"><b className="text-[16px] text-ink mr-1">{a.n}</b>{a.t}</span>
            <Icon name="ChevronRight" className="h-4 w-4 text-muted" />
          </Link></li>
        ))}
      </ul>
    </Card>
  )
}
