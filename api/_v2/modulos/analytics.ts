/* ============================================================
   API v2 · People Analytics (spec §13)
   Rotas: analytics/resumo · analytics/detalhe · analytics/exportar
   - Três blocos (recrutamento, pesquisas, estrutura) com os MESMOS filtros
     (período, área, unidade, recrutador, gestor). Quando um filtro não faz
     sentido para um bloco, o bloco diz que o ignorou e por quê.
   - Definições dos indicadores de recrutamento = painel de vagas
     (src/domain/v2/indicadoresRecrutamento.ts); pesquisas = pesquisaCalculo.ts
     (mínimo de grupo e supressão complementar); estrutura = estrutura.ts.
   - Nunca expõe resposta individual, salário ou remuneração.
   ============================================================ */
import {
  auditar, hojeISO, inteiro, invalido, ok, pessoas, setores, cargos, unidades, proibido, paginacao,
  type Ctx, type Rota, type Usuario,
} from '../nucleo.js'
import { STATUS_ATIVOS, ROTULO_ETAPA, type TipoEtapa } from '../../../src/domain/v2/vagas.js'
import {
  funilPorTipo, media, tempoAtePrimeiraCandidaturaDias, tempoPorEtapa, tempoPreenchimentoDias, taxaConversao, vagaNoPrazo, DEFINICOES,
  type ContratacaoIndicador, type VagaIndicador,
} from '../../../src/domain/v2/indicadoresRecrutamento.js'
import { assinaturaPergunta, type PerguntaPesquisa } from '../../../src/domain/v2/pesquisaTipos.js'
import { avaliarFiltro, calcularResultados, suprimirGrupos, type RespostaBruta, type VersaoEstrutura } from '../../../src/domain/v2/pesquisaCalculo.js'
import { filtrarPessoas, ehAtiva, ROTULO_PENDENCIA, type PessoaOrg as PessoaHier, type VagaOrg } from '../../../src/domain/v2/organograma.js'
import { indicadoresEstrutura, type SnapshotEstrutura } from '../../../src/domain/v2/estrutura.js'
import {
  CacheCurto, conversaoProposta, indicador, INDISPONIVEIS_PADRAO, mesesDoPeriodo, paraCsv, pctDe, periodoAnterior, periodoDosFiltros,
  rotuloPeriodo, taxaConclusaoProcessos, type Bloco, type Indicador, type Periodo,
} from '../../../src/domain/v2/analytics.js'

/* ---------- cache de 60 s por (pessoa, filtros) ---------- */
const cache = new CacheCurto<unknown>(60_000)
export const limparCacheAnalytics = () => cache.limpar()

/* ---------- filtros ---------- */
interface Filtros { periodo: Periodo; setor?: string; unidade?: string; recrutador?: string; gestor?: string }
const ID_OK = /^[\w:.-]{1,80}$/
function lerFiltros(q: Record<string, string>, hoje: string): Filtros {
  const id = (k: string) => {
    const v = q[k]
    if (!v) return undefined
    if (!ID_OK.test(v)) throw invalido(`Filtro "${k}" inválido.`)
    return v
  }
  return { periodo: periodoDosFiltros(q.de, q.ate, hoje), setor: id('setor'), unidade: id('unidade'), recrutador: id('recrutador'), gestor: id('gestor') }
}
const chaveCache = (u: Usuario, f: Filtros, extra = '') => `${u.colaboradorId}|${f.periodo.de}|${f.periodo.ate}|${f.setor ?? ''}|${f.unidade ?? ''}|${f.recrutador ?? ''}|${f.gestor ?? ''}|${extra}`
const ts = (d: unknown) => (d instanceof Date ? d.toISOString() : d ? String(d) : null)

interface Tabela { chave: string; titulo: string; colunas: { chave: string; rotulo: string }[]; linhas: Record<string, string | number | null>[] }
const tabela = (chave: string, titulo: string, colunas: [string, string][], linhas: Record<string, string | number | null>[]): Tabela =>
  ({ chave, titulo, colunas: colunas.map(([c, r]) => ({ chave: c, rotulo: r })), linhas })

const ROTULO_ORIGEM: Record<string, string> = {
  portal: 'Portal de carreiras', indicacao: 'Indicação', linkedin: 'LinkedIn', manual: 'Cadastro manual', importacao: 'Importação em lote', banco_talentos: 'Banco de talentos', outro: 'Outro',
}
const ROTULO_STATUS_VAGA: Record<string, string> = {
  rascunho: 'Rascunho', em_aprovacao: 'Em aprovação', ajustes: 'Ajustes solicitados', aprovada: 'Aprovada', publicada: 'Publicada', pausada: 'Pausada', encerrada: 'Encerrada', cancelada: 'Cancelada',
}

/* ============================================================
   RECRUTAMENTO
   Coorte = vagas abertas (data de abertura) dentro do período e dos filtros.
   ============================================================ */
interface DadosRec { vagas: any[]; cands: any[]; etapas: any[]; movs: any[]; propostas: any[] }

async function carregarRec(c: Ctx, f: Filtros, p: Periodo): Promise<DadosRec> {
  const w = ['not v.arquivada', 'v.data_abertura between $1::date and $2::date']
  const params: unknown[] = [p.de, p.ate]
  const add = (sql: string, v: unknown) => { params.push(v); w.push(sql.split('$#').join(`$${params.length}`)) }
  if (f.setor) add('v.setor_id = $#', f.setor)
  if (f.unidade) add('v.unidade_id = $#', f.unidade)
  if (f.recrutador) add('v.recrutador_id = $#', f.recrutador)
  if (f.gestor) add('(v.gestor_solicitante_id = $# or v.gestor_responsavel_id = $# or v.gestor_imediato_id = $#)', f.gestor)
  const vagas = (await c.db.query(
    `select v.id, v.codigo, v.titulo, v.status, v.prioridade, v.qtd_posicoes, v.posicoes_preenchidas, v.publicada_em, v.primeira_candidatura_em,
       to_char(v.prazo_preenchimento,'YYYY-MM-DD') as prazo, v.encerrada_em, v.motivo_encerramento, v.setor_id, v.unidade_id, v.recrutador_id,
       v.gestor_solicitante_id, v.gestor_responsavel_id, to_char(v.data_abertura,'YYYY-MM-DD') as abertura
     from rec_vagas v where ${w.join(' and ')}`, params)).rows
  const ids = vagas.map((v) => v.id as string)
  if (!ids.length) return { vagas, cands: [], etapas: [], movs: [], propostas: [] }
  const cands = (await c.db.query('select id, vaga_id, status, origem, etapa_id, criado_em, coalesce(encerrada_em, atualizado_em) as fim from rec_candidaturas where vaga_id = any($1::uuid[])', [ids])).rows
  const etapas = (await c.db.query('select id, nome, tipo from rec_vaga_etapas where vaga_id = any($1::uuid[])', [ids])).rows
  const movs = cands.length ? (await c.db.query('select candidatura_id, em, para_etapa_id from rec_candidatura_movs where candidatura_id = any($1::uuid[])', [cands.map((x) => x.id)])).rows : []
  const propostas = (await c.db.query(
    "select c.vaga_id, p.status from rec_propostas p join rec_candidaturas c on c.id = p.candidatura_id where c.vaga_id = any($1::uuid[]) and p.status in ('aceita','recusada')", [ids])).rows
  return { vagas, cands, etapas, movs, propostas }
}

function vagaIndic(v: any): VagaIndicador {
  return { id: v.id, status: v.status, qtdPosicoes: v.qtd_posicoes, posicoesPreenchidas: v.posicoes_preenchidas, publicadaEm: ts(v.publicada_em), primeiraCandidaturaEm: ts(v.primeira_candidatura_em), prazoPreenchimento: v.prazo ?? null, encerradaEm: ts(v.encerrada_em) }
}

function escalaresRec(d: DadosRec, hoje: string) {
  const contr: ContratacaoIndicador[] = d.cands.filter((x) => x.status === 'contratado').map((x) => ({ vagaId: x.vaga_id, em: ts(x.fim)! }))
  const tpFecha = d.vagas.map((v) => tempoPreenchimentoDias(vagaIndic(v), contr)).filter((x): x is number => x !== null)
  const tpPrim = d.vagas.map((v) => tempoAtePrimeiraCandidaturaDias(vagaIndic(v))).filter((x): x is number => x !== null)
  const prazo = d.vagas.map((v) => vagaNoPrazo(vagaIndic(v), contr, hoje)).filter((x): x is boolean => x !== null)
  const aceitas = d.propostas.filter((x) => x.status === 'aceita').length
  const recusadas = d.propostas.filter((x) => x.status === 'recusada').length
  return {
    contr, vagasNoPeriodo: d.vagas.length, abertas: d.vagas.filter((v) => STATUS_ATIVOS.includes(v.status)).length,
    tpFecha, tpPrim, prazo, aceitas, recusadas,
    candidaturas: d.cands.length, contratacoes: contr.length,
  }
}

async function blocoRecrutamento(c: Ctx, f: Filtros, hoje: string) {
  const p = f.periodo, ant = periodoAnterior(p)
  const [d, da] = await Promise.all([carregarRec(c, f, p), carregarRec(c, f, ant)])
  const e = escalaresRec(d, hoje), ea = escalaresRec(da, hoje)
  const org = { setor: new Map((await setores(c.db)).map((s) => [s.id, s.nome])), pessoa: new Map((await pessoas(c.db)).map((x) => [x.id, x.nomeSocial || x.nome])) }
  const per = rotuloPeriodo(p)
  const base = (x: ReturnType<typeof escalaresRec>) => x.vagasNoPeriodo > 0
  const fonte = 'Vagas e candidaturas do módulo de recrutamento'
  const defCoorte = 'Considera as vagas abertas (data de abertura) dentro do período e dos filtros.'

  const taxaPrazo = (x: ReturnType<typeof escalaresRec>) => pctDe(x.prazo.filter(Boolean).length, x.prazo.length)
  const fin = (dd: DadosRec) => taxaConclusaoProcessos(dd.vagas.map((v) => ({ status: v.status, qtdPosicoes: v.qtd_posicoes, posicoesPreenchidas: v.posicoes_preenchidas })))
  const indicadores: Indicador[] = [
    indicador({ chave: 'vagas_abertas', rotulo: 'Vagas em andamento', valor: base(e) ? e.abertas : null, anterior: base(ea) ? ea.abertas : null, unidade: 'n', base: e.vagasNoPeriodo, detalhe: 'rec_vagas_abertas',
      definicao: `Vagas em aprovação, aprovadas, publicadas ou pausadas. ${defCoorte}`, fonte, periodo: per }),
    indicador({ chave: 'vagas_periodo', rotulo: 'Vagas abertas no período', valor: base(e) ? e.vagasNoPeriodo : null, anterior: base(ea) ? ea.vagasNoPeriodo : null, unidade: 'n', base: e.vagasNoPeriodo, detalhe: 'rec_vagas',
      definicao: `Todas as vagas não arquivadas com data de abertura no período. ${defCoorte}`, fonte, periodo: per }),
    indicador({ chave: 'candidaturas', rotulo: 'Candidaturas recebidas', valor: base(e) ? e.candidaturas : null, anterior: base(ea) ? ea.candidaturas : null, unidade: 'n', base: e.candidaturas, detalhe: 'rec_candidaturas',
      definicao: `Candidaturas das vagas da coorte. ${defCoorte}`, fonte, periodo: per }),
    indicador({ chave: 'contratacoes', rotulo: 'Contratações concluídas', valor: base(e) ? e.contratacoes : null, anterior: base(ea) ? ea.contratacoes : null, unidade: 'n', base: e.contratacoes, detalhe: 'rec_contratacoes',
      definicao: 'Candidaturas com status "contratado" nas vagas da coorte.', fonte, periodo: per }),
    indicador({ chave: 'tempo_preenchimento', rotulo: 'Tempo de preenchimento', valor: media(e.tpFecha), anterior: media(ea.tpFecha), unidade: 'dias', base: e.tpFecha.length, detalhe: 'rec_tempo_preenchimento',
      definicao: DEFINICOES.tempoPreenchimento, fonte, periodo: per, dependencia: e.tpFecha.length ? undefined : 'Nenhuma vaga da coorte preencheu todas as posições ainda.' }),
    indicador({ chave: 'tempo_primeira_candidatura', rotulo: 'Tempo até a primeira candidatura', valor: media(e.tpPrim), anterior: media(ea.tpPrim), unidade: 'dias', base: e.tpPrim.length, detalhe: 'rec_vagas',
      definicao: DEFINICOES.tempoPrimeiraCandidatura, fonte, periodo: per }),
    indicador({ chave: 'taxa_conversao', rotulo: 'Conversão de candidatos', valor: taxaConversao(e.candidaturas, e.contratacoes), anterior: taxaConversao(ea.candidaturas, ea.contratacoes), unidade: '%', base: e.candidaturas, detalhe: 'rec_candidaturas',
      definicao: DEFINICOES.taxaConversao, fonte, periodo: per }),
    indicador({ chave: 'no_prazo', rotulo: 'Vagas dentro do prazo', valor: taxaPrazo(e), anterior: taxaPrazo(ea), unidade: '%', base: e.prazo.length, detalhe: 'rec_prazo',
      definicao: DEFINICOES.noPrazo, fonte, periodo: per, dependencia: e.prazo.length ? undefined : 'Nenhuma vaga da coorte tem prazo de preenchimento definido.' }),
    indicador({ chave: 'conclusao', rotulo: 'Conclusão de processos', valor: fin(d), anterior: fin(da), unidade: '%', base: d.vagas.filter((v) => ['encerrada', 'cancelada'].includes(v.status)).length, detalhe: 'rec_encerradas',
      definicao: 'Vagas encerradas com todas as posições preenchidas ÷ vagas encerradas ou canceladas.', fonte, periodo: per }),
    indicador({ chave: 'conversao_proposta', rotulo: 'Conversão de propostas', valor: conversaoProposta(e.aceitas, e.recusadas), anterior: conversaoProposta(ea.aceitas, ea.recusadas), unidade: '%', base: e.aceitas + e.recusadas, detalhe: 'rec_propostas',
      definicao: 'Propostas aceitas ÷ (aceitas + recusadas). Propostas em aberto não entram.', fonte, periodo: per }),
  ]

  // Funil e tempo por etapa (mesma lógica do painel de vagas)
  const etapaPorId = new Map(d.etapas.map((x) => [x.id as string, x as { nome: string; tipo: string }]))
  const rotuloEtapa = (id: string) => { const x = etapaPorId.get(id); return x ? (x.tipo === 'generica' ? x.nome : ROTULO_ETAPA[x.tipo as TipoEtapa] ?? x.nome) : null }
  const juntas = new Map<string, { soma: number; n: number }>()
  for (const t of tempoPorEtapa(d.movs.map((m) => ({ candidaturaId: m.candidatura_id, em: ts(m.em)!, paraEtapaId: m.para_etapa_id })), rotuloEtapa)) {
    const a = juntas.get(t.etapa) ?? { soma: 0, n: 0 }; a.soma += t.dias * t.n; a.n += t.n; juntas.set(t.etapa, a)
  }
  const tempoEtapas = [...juntas.entries()].map(([etapa, a]) => ({ etapa, dias: Math.round((a.soma / a.n) * 10) / 10, n: a.n }))
  const alcance = new Map<string, Set<string>>(d.cands.map((x) => [x.id as string, new Set(['nova'])]))
  for (const m of d.movs) { const x = m.para_etapa_id ? etapaPorId.get(m.para_etapa_id) : null; if (x) alcance.get(m.candidatura_id)?.add(x.tipo) }
  for (const x of d.cands) { const et = x.etapa_id ? etapaPorId.get(x.etapa_id) : null; if (et) alcance.get(x.id)?.add(et.tipo); if (x.status === 'contratado') alcance.get(x.id)?.add('contratado') }
  const funil = funilPorTipo([...alcance.values()].map((s) => ({ tiposAlcancados: [...s] })))

  // Distribuições
  const porVagaCand = new Map<string, number>(); for (const x of d.cands) porVagaCand.set(x.vaga_id, (porVagaCand.get(x.vaga_id) ?? 0) + 1)
  const porVagaContr = new Map<string, number>(); for (const x of e.contr) porVagaContr.set(x.vagaId, (porVagaContr.get(x.vagaId) ?? 0) + 1)
  const grupo = (chave: (v: any) => string | null, nome: (id: string) => string) => {
    const m = new Map<string, { vagas: number; abertas: number; candidaturas: number; contratacoes: number; tempos: number[] }>()
    for (const v of d.vagas) {
      const k = chave(v) ?? '—'
      const a = m.get(k) ?? { vagas: 0, abertas: 0, candidaturas: 0, contratacoes: 0, tempos: [] }
      a.vagas++; if (STATUS_ATIVOS.includes(v.status)) a.abertas++
      a.candidaturas += porVagaCand.get(v.id) ?? 0; a.contratacoes += porVagaContr.get(v.id) ?? 0
      const t = tempoPreenchimentoDias(vagaIndic(v), e.contr); if (t !== null) a.tempos.push(t)
      m.set(k, a)
    }
    return [...m.entries()].map(([k, a]) => ({ id: k === '—' ? null : k, nome: k === '—' ? 'Não definido' : nome(k), vagas: a.vagas, abertas: a.abertas, candidaturas: a.candidaturas, contratacoes: a.contratacoes, tempoMedioPreenchimento: media(a.tempos) })).sort((a, b) => b.vagas - a.vagas)
  }
  const porSetor = grupo((v) => v.setor_id, (id) => org.setor.get(id) ?? 'Cadastro removido')
  const porRecrutador = grupo((v) => v.recrutador_id, (id) => org.pessoa.get(id) ?? 'Cadastro removido')
  const canais = Object.entries(d.cands.reduce<Record<string, number>>((m, x) => { m[x.origem] = (m[x.origem] ?? 0) + 1; return m }, {}))
    .map(([origem, qtd]) => ({ origem, rotulo: ROTULO_ORIGEM[origem] ?? origem, qtd })).sort((a, b) => b.qtd - a.qtd)
  const porVaga = d.vagas.map((v) => ({ vagaId: v.id as string, codigo: v.codigo as string, titulo: v.titulo as string, candidaturas: porVagaCand.get(v.id) ?? 0 })).filter((x) => x.candidaturas > 0).sort((a, b) => b.candidaturas - a.candidaturas).slice(0, 10)

  const motivoCat = (v: any) => {
    const m = String(v.motivo_encerramento ?? '').trim()
    if (v.status === 'encerrada' && v.posicoes_preenchidas >= v.qtd_posicoes) return 'Vaga preenchida'
    if (!m) return 'Motivo não informado'
    if (/^rejeitada/i.test(m)) return 'Solicitação rejeitada na aprovação'
    if (/^preenchida/i.test(m)) return 'Vaga preenchida'
    return 'Outro motivo informado'
  }
  const motivos = Object.entries(d.vagas.filter((v) => ['encerrada', 'cancelada'].includes(v.status)).reduce<Record<string, number>>((m, v) => { const k = motivoCat(v); m[k] = (m[k] ?? 0) + 1; return m }, {}))
    .map(([motivo, qtd]) => ({ motivo, qtd })).sort((a, b) => b.qtd - a.qtd)

  const meses = mesesDoPeriodo(p)
  const abertasMes = new Map<string, number>(), contrMes = new Map<string, number>()
  for (const v of d.vagas) { const k = String(v.abertura).slice(0, 7); abertasMes.set(k, (abertasMes.get(k) ?? 0) + 1) }
  for (const x of e.contr) { const k = x.em.slice(0, 7); contrMes.set(k, (contrMes.get(k) ?? 0) + 1) }
  const evolucao = meses.map((mes) => ({ mes, vagasAbertas: abertasMes.get(mes) ?? 0, contratacoes: contrMes.get(mes) ?? 0 }))

  const tabelas: Tabela[] = [
    tabela('funil', 'Funil de recrutamento', [['etapa', 'Etapa'], ['candidaturas', 'Candidaturas que chegaram'], ['conversao', 'Conversão da etapa anterior (%)']],
      funil.map((x) => ({ etapa: x.rotulo, candidaturas: x.alcancaram, conversao: x.conversaoDaAnterior }))),
    tabela('tempo_etapas', 'Tempo médio por etapa', [['etapa', 'Etapa'], ['dias', 'Dias (média)'], ['n', 'Passagens']], tempoEtapas.map((x) => ({ etapa: x.etapa, dias: x.dias, n: x.n }))),
    tabela('canais', 'Candidaturas por canal', [['rotulo', 'Canal'], ['qtd', 'Candidaturas']], canais.map((x) => ({ rotulo: x.rotulo, qtd: x.qtd }))),
    tabela('por_setor', 'Por departamento', [['nome', 'Departamento'], ['vagas', 'Vagas'], ['abertas', 'Em andamento'], ['candidaturas', 'Candidaturas'], ['contratacoes', 'Contratações'], ['tempoMedioPreenchimento', 'Tempo médio de preenchimento (dias)']], porSetor.map((x) => ({ ...x }))),
    tabela('por_recrutador', 'Por recrutador', [['nome', 'Recrutador'], ['vagas', 'Vagas'], ['abertas', 'Em andamento'], ['candidaturas', 'Candidaturas'], ['contratacoes', 'Contratações'], ['tempoMedioPreenchimento', 'Tempo médio de preenchimento (dias)']], porRecrutador.map((x) => ({ ...x }))),
    tabela('motivos', 'Motivos de encerramento', [['motivo', 'Motivo'], ['qtd', 'Vagas']], motivos.map((x) => ({ ...x }))),
    tabela('por_vaga', 'Candidaturas por vaga (10 maiores)', [['codigo', 'Código'], ['titulo', 'Vaga'], ['candidaturas', 'Candidaturas']], porVaga.map((x) => ({ codigo: x.codigo, titulo: x.titulo, candidaturas: x.candidaturas }))),
    tabela('evolucao', 'Evolução mensal', [['mes', 'Mês'], ['vagasAbertas', 'Vagas abertas'], ['contratacoes', 'Contratações']], evolucao.map((x) => ({ ...x }))),
  ]
  return {
    disponivel: true as const,
    periodo: per, periodoAnterior: rotuloPeriodo(ant), semDados: d.vagas.length === 0,
    filtrosAplicados: ['período (data de abertura da vaga)', ...(f.setor ? ['área'] : []), ...(f.unidade ? ['unidade'] : []), ...(f.recrutador ? ['recrutador'] : []), ...(f.gestor ? ['gestor'] : [])],
    filtrosIgnorados: [] as string[],
    indicadores, funil, tempoPorEtapa: tempoEtapas, canais, porVaga, porSetor, porRecrutador, motivos, evolucao,
    candidatosSemDados: d.cands.length === 0,
    tabelas,
  }
}

/* ============================================================
   PESQUISAS
   Coorte = pesquisas iniciadas no período. Resultados SEMPRE agregados,
   com mínimo de grupo e supressão complementar.
   ============================================================ */
interface PesqLinha {
  id: string; titulo: string; categoria: string; modelo: string | null; modo: string; status: string; inicio: string | null; fim: string | null
  convidados: number; respostas: number | null; taxa: number | null; comLink: boolean; suprimido: boolean; motivo?: string
  enps: { valor: number; n: number } | null; dimensoes: { dimensao: string; media: number; n: number; assinatura: string }[]; enpsPergunta?: string; enpsAssinatura?: string
}

async function carregarPesquisas(c: Ctx, f: Filtros, p: Periodo): Promise<PesqLinha[]> {
  const ps = (await c.db.query(
    `select p.id, p.titulo, p.categoria, p.modelo_chave, p.modo, p.status, to_char(p.inicio,'YYYY-MM-DD') as inicio, to_char(p.fim,'YYYY-MM-DD') as fim,
       p.min_grupo, p.link_publico_ativo,
       coalesce(to_char(p.inicio,'YYYY-MM-DD'), to_char(p.publicada_em,'YYYY-MM-DD'), to_char(p.criado_em,'YYYY-MM-DD')) as ref
     from pq_pesquisas p
     where p.status in ('aberta','pausada','encerrada') and p.versao_atual > 0
       and coalesce(p.inicio, p.publicada_em::date, p.criado_em::date) between $1::date and $2::date
     order by ref, p.titulo`, [p.de, p.ate])).rows
  if (!ps.length) return []
  const gente = await pessoas(c.db), sets = await setores(c.db)
  const setorDe = new Map(sets.map((s) => [s.id, s]))
  const noRecorte = (id: string) => {
    const g = gente.find((x) => x.id === id)
    if (!g) return false
    if (f.setor && g.setorId !== f.setor) return false
    if (f.unidade && (g.unidadeId ?? setorDe.get(g.setorId)?.unidadeId) !== f.unidade) return false
    return true
  }
  const out: PesqLinha[] = []
  for (const x of ps) {
    const versoes = (await c.db.query('select versao, perguntas from pq_versoes where pesquisa_id = $1 order by versao', [x.id])).rows as VersaoEstrutura[]
    const rs = (await c.db.query("select id, versao, to_char(enviada_em,'YYYY-MM-DD') as enviada_em, grupo, itens from pq_respostas where pesquisa_id = $1", [x.id])).rows
    const brutas: RespostaBruta[] = rs.map((r) => ({ id: r.id, versao: r.versao, enviadaEm: r.enviada_em, grupo: r.grupo ?? {}, itens: r.itens ?? {} }))
    const convs = (await c.db.query('select colaborador_id from pq_convites where pesquisa_id = $1', [x.id])).rows
    const comLink = !!x.link_publico_ativo || rs.some((r) => r.grupo?.via === 'link')
    const filtrado = !!(f.setor || f.unidade)
    const convidados = filtrado ? convs.filter((cv) => noRecorte(cv.colaborador_id)).length : convs.length
    const linha: PesqLinha = {
      id: x.id, titulo: x.titulo, categoria: x.categoria, modelo: x.modelo_chave ?? null, modo: x.modo, status: x.status, inicio: x.inicio, fim: x.fim,
      convidados, respostas: rs.length, taxa: null, comLink, suprimido: false, enps: null, dimensoes: [],
    }
    const res = calcularResultados({
      versoes, respostas: brutas, elegiveis: filtrado || comLink ? 0 : convs.length, convidados: convs.length, minGrupo: x.min_grupo,
      filtro: filtrado ? { setorId: f.setor, unidadeId: f.unidade } : undefined,
    })
    if (filtrado) {
      const nFiltro = brutas.filter((r) => (!f.setor || r.grupo.setorId === f.setor) && (!f.unidade || r.grupo.unidadeId === f.unidade)).length
      const av = avaliarFiltro(nFiltro, brutas.length, x.min_grupo)
      if (!av.permitido || res.suprimido) { linha.suprimido = true; linha.motivo = av.motivo ?? res.filtroBloqueado ?? 'Poucas respostas para exibir com segurança.'; linha.respostas = null; out.push(linha); continue }
      linha.respostas = nFiltro
      linha.taxa = !comLink && convidados > 0 ? Math.round((nFiltro / convidados) * 1000) / 10 : null
    } else {
      linha.taxa = !comLink && convs.length > 0 ? Math.round((rs.length / convs.length) * 1000) / 10 : null
      if (res.suprimido) { linha.suprimido = true; linha.motivo = `Menos de ${x.min_grupo} respostas: resultados ocultos para proteger o anonimato.`; out.push(linha); continue }
    }
    const ultima = [...versoes].sort((a, b) => b.versao - a.versao)[0]
    const perguntas: PerguntaPesquisa[] = ultima?.perguntas ?? []
    const penps = perguntas.find((q) => q.tipo === 'enps')
    if (res.enps && res.enps.enps !== null && penps) { linha.enps = { valor: res.enps.enps, n: res.enps.n }; linha.enpsPergunta = penps.texto; linha.enpsAssinatura = assinaturaPergunta(penps) }
    linha.dimensoes = res.dimensoes.map((dm) => ({
      dimensao: dm.dimensao, media: dm.media, n: dm.n,
      assinatura: perguntas.filter((q) => q.dimensao === dm.dimensao).map((q) => assinaturaPergunta(q)).sort().join('¦'),
    }))
    out.push(linha)
  }
  return out
}

function resumoPesq(l: PesqLinha[]) {
  const elegiveis = l.filter((x) => !x.comLink && !x.suprimido && x.respostas !== null && x.convidados > 0)
  const conv = elegiveis.reduce((a, x) => a + x.convidados, 0), resp = elegiveis.reduce((a, x) => a + (x.respostas ?? 0), 0)
  return { participacao: pctDe(resp, conv), convidados: conv, respostas: resp, n: elegiveis.length }
}

async function blocoPesquisas(c: Ctx, f: Filtros) {
  const p = f.periodo, ant = periodoAnterior(p)
  const [atual, anterior] = await Promise.all([carregarPesquisas(c, f, p), carregarPesquisas(c, f, ant)])
  const ra = resumoPesq(atual), rb = resumoPesq(anterior)
  const per = rotuloPeriodo(p)
  const fonte = 'Central de pesquisas'
  const filtrado = !!(f.setor || f.unidade)
  const comEnps = atual.filter((x) => x.enps)
  const ultimoEnps = comEnps.length ? comEnps[comEnps.length - 1].enps!.valor : null
  const anteriorEnps = anterior.filter((x) => x.enps).slice(-1)[0]?.enps?.valor ?? null
  const baixa = atual.filter((x) => !x.comLink && x.convidados >= 5 && (x.taxa ?? 100) < 30 && ['aberta', 'encerrada'].includes(x.status))

  const indicadores: Indicador[] = [
    indicador({ chave: 'pesquisas_n', rotulo: 'Pesquisas iniciadas', valor: atual.length || null, anterior: anterior.length || null, unidade: 'n', base: atual.length, detalhe: 'pq_pesquisas',
      definicao: 'Pesquisas publicadas cujo início está no período.', fonte, periodo: per }),
    indicador({ chave: 'participacao', rotulo: 'Taxa de participação', valor: ra.participacao, anterior: rb.participacao, unidade: '%', base: ra.n, detalhe: 'pq_pesquisas',
      definicao: 'Respostas ÷ convidados, somando as pesquisas com convite individual. Mede participação, não satisfação. Links públicos ficam de fora (não há público elegível definido).', fonte, periodo: per,
      dependencia: ra.n ? undefined : 'Nenhuma pesquisa do período tem convites individuais com respostas visíveis.' }),
    indicador({ chave: 'enps', rotulo: 'eNPS (pesquisa mais recente)', valor: ultimoEnps, anterior: anteriorEnps, unidade: 'pontos', base: comEnps.length ? comEnps[comEnps.length - 1].enps!.n : 0, detalhe: 'pq_enps',
      definicao: 'Percentual de promotores (9–10) menos percentual de detratores (0–6) na pergunta eNPS da pesquisa mais recente do período, de −100 a 100. Só aparece com respostas suficientes.', fonte, periodo: per,
      dependencia: comEnps.length ? undefined : 'Nenhuma pesquisa do período com pergunta eNPS e respostas suficientes para exibir.' }),
    indicador({ chave: 'baixa_adesao', rotulo: 'Pesquisas com baixa participação', valor: atual.some((x) => !x.comLink) ? baixa.length : null, unidade: 'n', base: baixa.length, detalhe: 'pq_baixa_adesao',
      definicao: 'Pesquisas abertas ou encerradas com pelo menos 5 convidados e participação abaixo de 30%.', fonte, periodo: per }),
  ]

  // Evolução do eNPS: só pontos de perguntas idênticas (mesma redação, tipo e escala)
  const porAssin = new Map<string, { pergunta: string; pontos: { pesquisaId: string; titulo: string; data: string; enps: number; n: number }[] }>()
  for (const x of atual) if (x.enps && x.enpsAssinatura) {
    const g = porAssin.get(x.enpsAssinatura) ?? { pergunta: x.enpsPergunta ?? '', pontos: [] }
    g.pontos.push({ pesquisaId: x.id, titulo: x.titulo, data: x.fim ?? x.inicio ?? '', enps: x.enps.valor, n: x.enps.n }); porAssin.set(x.enpsAssinatura, g)
  }
  const seriesEnps = [...porAssin.values()].sort((a, b) => b.pontos.length - a.pontos.length)

  // Dimensões (clima/engajamento/liderança): comparáveis entre pesquisas só com as mesmas perguntas
  const dimSeries = new Map<string, { dimensao: string; pontos: { pesquisaId: string; titulo: string; data: string; media: number; n: number }[] }>()
  for (const x of atual) for (const dm of x.dimensoes) {
    const k = `${dm.dimensao}§${dm.assinatura}`
    const g = dimSeries.get(k) ?? { dimensao: dm.dimensao, pontos: [] }
    g.pontos.push({ pesquisaId: x.id, titulo: x.titulo, data: x.fim ?? x.inicio ?? '', media: dm.media, n: dm.n }); dimSeries.set(k, g)
  }
  const dimensoes = [...dimSeries.values()].map((g) => ({ ...g, comparavel: g.pontos.length >= 2 })).sort((a, b) => b.pontos.length - a.pontos.length || a.dimensao.localeCompare(b.dimensao))

  // Participação por área/unidade (com supressão complementar)
  let porArea: { chave: string; area: string; convidados: number; respostas: number | null; taxa: number | null; suprimido: boolean }[] = []
  if (!filtrado && atual.length) {
    const ids = atual.filter((x) => !x.comLink).map((x) => x.id)
    if (ids.length) {
      const gente = await pessoas(c.db), nomes = Object.fromEntries((await setores(c.db)).map((s) => [s.id, s.nome]))
      const convPorSetor = new Map<string, number>()
      for (const cv of (await c.db.query('select colaborador_id from pq_convites where pesquisa_id = any($1::uuid[])', [ids])).rows) {
        const s = gente.find((g) => g.id === cv.colaborador_id)?.setorId; if (s) convPorSetor.set(s, (convPorSetor.get(s) ?? 0) + 1)
      }
      const respPorSetor = new Map<string, number>(
        (await c.db.query("select grupo->>'setorId' as setor, count(*)::int as n from pq_respostas where pesquisa_id = any($1::uuid[]) and grupo ? 'setorId' group by 1", [ids])).rows.map((r) => [r.setor as string, r.n as number]))
      const min = Math.max(5, ...(await c.db.query('select min_grupo from pq_pesquisas where id = any($1::uuid[])', [ids])).rows.map((r) => r.min_grupo as number))
      const cont = [...convPorSetor.keys()].map((k) => ({ chave: k, n: respPorSetor.get(k) ?? 0 }))
      const oculto = suprimirGrupos(cont, min)
      porArea = cont.map(({ chave, n }) => {
        const sup = n > 0 ? !!oculto.get(chave) : false
        return { chave, area: nomes[chave] ?? 'Cadastro removido', convidados: convPorSetor.get(chave) ?? 0, respostas: sup ? null : n, taxa: sup || !convPorSetor.get(chave) ? null : Math.round((n / convPorSetor.get(chave)!) * 1000) / 10, suprimido: sup }
      }).sort((a, b) => a.area.localeCompare(b.area, 'pt-BR'))
    }
  }

  const tabelas: Tabela[] = [
    tabela('pesquisas', 'Pesquisas do período', [['titulo', 'Pesquisa'], ['categoria', 'Categoria'], ['modo', 'Tipo'], ['status', 'Situação'], ['convidados', 'Convidados'], ['respostas', 'Respostas'], ['taxa', 'Participação (%)'], ['enps', 'eNPS'], ['observacao', 'Observação']],
      atual.map((x) => ({ titulo: x.titulo, categoria: x.categoria, modo: x.modo === 'anonima' ? 'Anônima' : 'Identificada', status: x.status, convidados: x.convidados, respostas: x.respostas, taxa: x.taxa, enps: x.enps?.valor ?? null, observacao: x.suprimido ? x.motivo ?? 'Oculto' : x.comLink ? 'Link público: sem taxa de resposta' : null }))),
    tabela('enps', 'Evolução do eNPS', [['titulo', 'Pesquisa'], ['data', 'Data'], ['enps', 'eNPS'], ['n', 'Respostas']], (seriesEnps[0]?.pontos ?? []).map((x) => ({ ...x, pesquisaId: undefined } as unknown as Record<string, string | number | null>))),
    tabela('dimensoes', 'Dimensões (média de 1 a 5)', [['dimensao', 'Dimensão'], ['titulo', 'Pesquisa'], ['media', 'Média'], ['n', 'Respostas']],
      dimensoes.flatMap((g) => g.pontos.map((pt) => ({ dimensao: g.dimensao, titulo: pt.titulo, media: pt.media, n: pt.n })))),
    tabela('areas', 'Participação por área', [['area', 'Área'], ['convidados', 'Convidados'], ['respostas', 'Respostas'], ['taxa', 'Participação (%)']],
      porArea.map((x) => ({ area: x.area, convidados: x.convidados, respostas: x.suprimido ? 'Oculto (grupo pequeno)' : x.respostas, taxa: x.taxa }))),
  ]
  return {
    disponivel: true as const,
    periodo: per, periodoAnterior: rotuloPeriodo(ant), semDados: atual.length === 0,
    filtrosAplicados: ['período (início da pesquisa)', ...(f.setor ? ['área'] : []), ...(f.unidade ? ['unidade'] : [])],
    filtrosIgnorados: [...(f.recrutador ? ['recrutador'] : []), ...(f.gestor ? ['gestor'] : [])].map((x) => `${x}: pesquisas não são ligadas a recrutadores nem a equipes de gestores`),
    indicadores, pesquisas: atual.map(({ dimensoes: _d, enpsAssinatura: _e, ...r }) => r), baixaAdesao: baixa.map((x) => ({ id: x.id, titulo: x.titulo, taxa: x.taxa, convidados: x.convidados })),
    seriesEnps: seriesEnps.map((s) => ({ pergunta: s.pergunta, comparavel: s.pontos.length >= 2, pontos: s.pontos })),
    dimensoes, porArea, tabelas,
    avisoAnonimato: 'Somente resultados agregados. Recortes com poucas respostas são ocultados e, quando necessário, o menor grupo visível também, para impedir identificar pessoas por subtração.',
  }
}

/* ============================================================
   ESTRUTURA
   Retrato ATUAL da organização; o período só delimita a linha do tempo (retratos mensais).
   ============================================================ */
async function dadosEstrutura(c: Ctx, f: Filtros, podeVerVagas: boolean) {
  const [legado, sets, cgs, uns] = await Promise.all([pessoas(c.db), setores(c.db), cargos(c.db), unidades(c.db)])
  const pessoasH: PessoaHier[] = legado.map((x) => ({ id: x.id, nome: x.nome, setorId: x.setorId, cargoId: x.cargoId, unidadeId: x.unidadeId, status: x.status, responsavelId: x.responsavelId ?? null }))
  const rv = (await c.db.query(
    `select id, titulo, status, setor_id, cargo_id, gestor_imediato_id, unidade_id, qtd_posicoes, posicoes_preenchidas from rec_vagas
     where not arquivada and status in ('aprovada','publicada','pausada') ${podeVerVagas ? '' : "and status = 'publicada'"}`)).rows
  return { legado, sets, cgs, uns, pessoasH, vagasLinhas: rv }
}

async function blocoEstrutura(c: Ctx, f: Filtros) {
  const { legado, sets, cgs, uns, pessoasH, vagasLinhas } = await dadosEstrutura(c, f, c.usuario.caps.has('vagas:ver'))
  const cargosE = cgs.map((x) => ({ id: x.id, nome: x.nome, nivel: x.nivel as string | undefined }))
  const filtrada = filtrarPessoas(pessoasH, { setorId: f.setor, unidadeId: f.unidade, gestorId: f.gestor }, sets)
  const idsF = new Set(filtrada.map((x) => x.id))
  const vagasF = vagasLinhas.filter((v) => (!f.setor || v.setor_id === f.setor) && (!f.unidade || v.unidade_id === f.unidade) && (!f.gestor || idsF.has(v.gestor_imediato_id)))
  const vagasOrg: VagaOrg[] = vagasF.map((v) => ({ id: v.id, titulo: v.titulo, status: v.status, setorId: v.setor_id, cargoId: v.cargo_id, gestorImediatoId: v.gestor_imediato_id, qtdPosicoes: v.qtd_posicoes, posicoesPreenchidas: v.posicoes_preenchidas }))
  const semFiltro = !f.setor && !f.unidade && !f.gestor
  const completo = indicadoresEstrutura(pessoasH, sets, cargosE, uns, vagasOrg)
  const ind = semFiltro ? completo : { ...indicadoresEstrutura(filtrada, sets, cargosE, uns, vagasOrg), niveisHierarquicos: completo.niveisHierarquicos, porNivelHierarquico: completo.porNivelHierarquico }
  const equipes = completo.equipes.filter((e) => idsF.has(e.id))
  const pendencias = completo.pendencias.filter((x) => semFiltro || (x.pessoaId ? idsF.has(x.pessoaId) : !!x.setorId && (!f.setor || x.setorId === f.setor)))
  const nomeSetor = new Map(sets.map((s) => [s.id, s.nome])), nomePessoa = new Map(pessoasH.map((x) => [x.id, x.nome]))

  const snaps = (await c.db.query("select to_char(mes,'YYYY-MM-DD') as mes, dados from org_snapshots where mes between $1::date and $2::date order by mes", [f.periodo.de.slice(0, 7) + '-01', f.periodo.ate])).rows as SnapshotEstrutura[]
  const evolucao = snaps.length >= 2 && semFiltro ? snaps.map((s) => ({ mes: s.mes.slice(0, 7), ativos: s.dados.ativos, gestores: s.dados.gestores, niveis: s.dados.niveis, pendencias: s.dados.pendencias })) : null
  const per = rotuloPeriodo(f.periodo)
  const fonte = 'Cadastro de pessoas, áreas e funções (relações explícitas de gestor imediato)'
  const hoje = 'situação atual'
  const totalPend = pendencias.length
  const indicadores: Indicador[] = [
    indicador({ chave: 'pessoas', rotulo: 'Pessoas ativas', valor: ind.totalAtivos, unidade: 'n', base: ind.totalAtivos, detalhe: 'est_pessoas', definicao: 'Pessoas cadastradas com parceria não encerrada, dentro dos filtros.', fonte, periodo: hoje }),
    indicador({ chave: 'gestores', rotulo: 'Gestores', valor: equipes.length, unidade: 'n', base: equipes.length, detalhe: 'est_equipes', definicao: 'Pessoas que são gestor imediato de ao menos uma pessoa ativa.', fonte, periodo: hoje }),
    indicador({ chave: 'tamanho_equipe', rotulo: 'Tamanho médio das equipes', valor: equipes.length ? Math.round((equipes.reduce((s, e) => s + e.diretos, 0) / equipes.length) * 10) / 10 : null, unidade: 'n', base: equipes.length, detalhe: 'est_equipes',
      definicao: 'Média de subordinados diretos por gestor. Descreve a estrutura; não indica se ela é adequada.', fonte, periodo: hoje }),
    indicador({ chave: 'niveis', rotulo: 'Níveis hierárquicos', valor: ind.totalAtivos ? completo.niveisHierarquicos : null, unidade: 'n', definicao: 'Profundidade da árvore de gestores imediatos (organização inteira). Quantidade de níveis não é, por si só, boa nem má.', fonte, periodo: hoje }),
    indicador({ chave: 'posicoes_vagas', rotulo: 'Posições vagas registradas', valor: ind.posicoesVagas.total, unidade: 'n', base: ind.posicoesVagas.total, detalhe: 'est_posicoes_vagas',
      definicao: 'Posições abertas (qtd − preenchidas) das vagas aprovadas, publicadas ou pausadas.', fonte: 'Módulo de recrutamento', periodo: hoje }),
    indicador({ chave: 'qualidade_cadastro', rotulo: 'Pendências de cadastro hierárquico', valor: totalPend, unidade: 'n', base: totalPend, detalhe: 'est_pendencias',
      definicao: 'Pessoas sem gestor, com gestor inexistente/inativo, ciclos e áreas sem gestor. Indica cadastro incompleto, não má estrutura.', fonte, periodo: hoje }),
  ]
  const tabelas: Tabela[] = [
    tabela('por_setor', 'Pessoas por departamento', [['nome', 'Departamento'], ['qtd', 'Pessoas']], ind.porSetor.map((x) => ({ nome: x.nome, qtd: x.qtd }))),
    tabela('por_unidade', 'Pessoas por unidade', [['nome', 'Unidade'], ['qtd', 'Pessoas']], ind.porUnidade.map((x) => ({ nome: x.nome, qtd: x.qtd }))),
    tabela('por_cargo', 'Pessoas por função', [['nome', 'Função'], ['qtd', 'Pessoas']], ind.porCargo.map((x) => ({ nome: x.nome, qtd: x.qtd }))),
    tabela('por_nivel', 'Pessoas por senioridade', [['nome', 'Senioridade'], ['qtd', 'Pessoas']], ind.porSenioridade.map((x) => ({ nome: x.nome, qtd: x.qtd }))),
    tabela('equipes', 'Tamanho das equipes', [['nome', 'Gestor'], ['diretos', 'Diretos'], ['totais', 'Total na equipe']], equipes.map((x) => ({ nome: x.nome, diretos: x.diretos, totais: x.totais }))),
    tabela('pendencias', 'Pendências de cadastro', [['tipo', 'Tipo'], ['pessoa', 'Pessoa'], ['area', 'Área']],
      pendencias.map((x) => ({ tipo: ROTULO_PENDENCIA[x.tipo], pessoa: x.pessoaId ? nomePessoa.get(x.pessoaId) ?? null : null, area: x.setorId ? nomeSetor.get(x.setorId) ?? null : null }))),
  ]
  void legado
  return {
    disponivel: true as const,
    periodo: per, periodoAnterior: null as string | null, semDados: ind.totalAtivos === 0,
    filtrosAplicados: [...(f.setor ? ['área'] : []), ...(f.unidade ? ['unidade'] : []), ...(f.gestor ? ['gestor (a pessoa e toda a sua equipe)'] : []), 'período (apenas na linha do tempo)'],
    filtrosIgnorados: [...(f.recrutador ? ['recrutador: não se aplica à estrutura'] : []), ...(!semFiltro ? ['níveis hierárquicos e linha do tempo consideram a organização inteira'] : [])],
    indicadores, porNivelHierarquico: completo.porNivelHierarquico, porSetor: ind.porSetor, porUnidade: ind.porUnidade, porCargo: ind.porCargo, porSenioridade: ind.porSenioridade,
    equipes: equipes.slice(0, 15), posicoesVagas: ind.posicoesVagas,
    evolucao, mensagemEvolucao: evolucao ? null : semFiltro ? 'Ainda não há histórico suficiente: a linha do tempo aparece quando houver retratos de pelo menos dois meses no período.' : 'A linha do tempo só é exibida sem filtros de área, unidade ou gestor.',
    tabelas,
  }
}

/* ============================================================
   RESUMO
   ============================================================ */
const omitido = (motivo: string) => ({ disponivel: false as const, motivo })

async function montarResumo(c: Ctx, f: Filtros) {
  const u = c.usuario, hoje = hojeISO(c.agora)
  const [rec, pesq, est] = await Promise.all([
    u.caps.has('vagas:ver') ? blocoRecrutamento(c, f, hoje) : Promise.resolve(omitido('Seu perfil não tem acesso aos dados de recrutamento (capacidade vagas:ver).')),
    u.caps.has('pesq:resultados') ? blocoPesquisas(c, f) : Promise.resolve(omitido('Seu perfil não tem acesso a resultados de pesquisas.')),
    u.caps.has('org:ver') ? blocoEstrutura(c, f) : Promise.resolve(omitido('Seu perfil não tem acesso à estrutura organizacional.')),
  ])
  const nomes = {
    setores: (await setores(c.db)).map((s) => ({ id: s.id, nome: s.nome })),
    unidades: (await unidades(c.db)).map((x) => ({ id: x.id, nome: x.nome })),
  }
  return {
    geradoEm: c.agora.toISOString(),
    filtros: { de: f.periodo.de, ate: f.periodo.ate, setor: f.setor ?? null, unidade: f.unidade ?? null, recrutador: f.recrutador ?? null, gestor: f.gestor ?? null },
    periodo: rotuloPeriodo(f.periodo), periodoAnterior: rotuloPeriodo(periodoAnterior(f.periodo)),
    blocos: { recrutamento: rec, pesquisas: pesq, estrutura: est },
    indisponiveis: INDISPONIVEIS_PADRAO,
    opcoes: nomes,
  }
}

async function resumoComCache(c: Ctx) {
  const f = lerFiltros(c.req.query, hojeISO(c.agora))
  const chave = chaveCache(c.usuario, f)
  if (c.req.query.fresh !== '1') {
    const h = cache.obter(chave, c.agora.getTime())
    if (h) return { f, r: h as Awaited<ReturnType<typeof montarResumo>>, doCache: true }
  }
  const r = await montarResumo(c, f)
  cache.guardar(chave, r, c.agora.getTime())
  return { f, r, doCache: false }
}

/* ============================================================
   DETALHE (drilldown)
   ============================================================ */
type Colunas = [string, string][]
interface Detalhe { titulo: string; colunas: Colunas; linhas: Record<string, string | number | null>[]; nota?: string }

const INDICADORES_DETALHE: Record<string, { bloco: Bloco; cap: 'vagas:ver' | 'pesq:resultados' | 'org:ver' }> = {
  rec_vagas_abertas: { bloco: 'recrutamento', cap: 'vagas:ver' }, rec_vagas: { bloco: 'recrutamento', cap: 'vagas:ver' },
  rec_candidaturas: { bloco: 'recrutamento', cap: 'vagas:ver' }, rec_contratacoes: { bloco: 'recrutamento', cap: 'vagas:ver' },
  rec_tempo_preenchimento: { bloco: 'recrutamento', cap: 'vagas:ver' }, rec_prazo: { bloco: 'recrutamento', cap: 'vagas:ver' },
  rec_encerradas: { bloco: 'recrutamento', cap: 'vagas:ver' }, rec_propostas: { bloco: 'recrutamento', cap: 'vagas:ver' },
  pq_pesquisas: { bloco: 'pesquisas', cap: 'pesq:resultados' }, pq_enps: { bloco: 'pesquisas', cap: 'pesq:resultados' }, pq_baixa_adesao: { bloco: 'pesquisas', cap: 'pesq:resultados' },
  est_pessoas: { bloco: 'estrutura', cap: 'org:ver' }, est_equipes: { bloco: 'estrutura', cap: 'org:ver' },
  est_pendencias: { bloco: 'estrutura', cap: 'org:ver' }, est_posicoes_vagas: { bloco: 'estrutura', cap: 'org:ver' },
}

async function detalhe(c: Ctx, chave: string, f: Filtros): Promise<Detalhe> {
  const hoje = hojeISO(c.agora)
  if (chave.startsWith('rec_')) {
    const d = await carregarRec(c, f, f.periodo)
    const e = escalaresRec(d, hoje)
    const org = { setor: new Map((await setores(c.db)).map((s) => [s.id, s.nome])), pessoa: new Map((await pessoas(c.db)).map((x) => [x.id, x.nomeSocial || x.nome])) }
    const cand = new Map<string, number>(), contr = new Map<string, number>(), aceitas = new Map<string, number>(), recusadas = new Map<string, number>()
    for (const x of d.cands) cand.set(x.vaga_id, (cand.get(x.vaga_id) ?? 0) + 1)
    for (const x of e.contr) contr.set(x.vagaId, (contr.get(x.vagaId) ?? 0) + 1)
    for (const x of d.propostas) (x.status === 'aceita' ? aceitas : recusadas).set(x.vaga_id, ((x.status === 'aceita' ? aceitas : recusadas).get(x.vaga_id) ?? 0) + 1)
    const podeMotivo = c.usuario.caps.has('vagas:gerenciar')
    const linha = (v: any) => {
      const tp = tempoPreenchimentoDias(vagaIndic(v), e.contr)
      const np = vagaNoPrazo(vagaIndic(v), e.contr, hoje)
      return {
        codigo: v.codigo, titulo: v.titulo, status: ROTULO_STATUS_VAGA[v.status] ?? v.status, area: org.setor.get(v.setor_id) ?? '—', recrutador: org.pessoa.get(v.recrutador_id) ?? '—',
        abertura: v.abertura, prazo: v.prazo ?? '—', candidaturas: cand.get(v.id) ?? 0, contratacoes: contr.get(v.id) ?? 0, diasPreencher: tp,
        noPrazo: np === null ? 'Sem prazo' : np ? 'Sim' : 'Não', propostasAceitas: aceitas.get(v.id) ?? 0, propostasRecusadas: recusadas.get(v.id) ?? 0,
        motivo: podeMotivo ? v.motivo_encerramento ?? null : null,
      } as Record<string, string | number | null>
    }
    const todas: Colunas = [['codigo', 'Código'], ['titulo', 'Vaga'], ['status', 'Situação'], ['area', 'Área'], ['recrutador', 'Recrutador'], ['abertura', 'Abertura'], ['prazo', 'Prazo']]
    const sel = (filtro: (v: any) => boolean, extra: Colunas, titulo: string, nota?: string): Detalhe => ({ titulo, colunas: [...todas, ...extra], linhas: d.vagas.filter(filtro).map(linha), nota })
    switch (chave) {
      case 'rec_vagas_abertas': return sel((v) => STATUS_ATIVOS.includes(v.status), [['candidaturas', 'Candidaturas']], 'Vagas em andamento')
      case 'rec_vagas': return sel(() => true, [['candidaturas', 'Candidaturas'], ['contratacoes', 'Contratações']], 'Vagas abertas no período')
      case 'rec_candidaturas': return sel((v) => (cand.get(v.id) ?? 0) > 0, [['candidaturas', 'Candidaturas']], 'Candidaturas por vaga', 'Contagens por vaga; dados pessoais de candidatos ficam no ATS.')
      case 'rec_contratacoes': return sel((v) => (contr.get(v.id) ?? 0) > 0, [['contratacoes', 'Contratações']], 'Contratações por vaga')
      case 'rec_tempo_preenchimento': return sel((v) => tempoPreenchimentoDias(vagaIndic(v), e.contr) !== null, [['diasPreencher', 'Dias para preencher']], 'Vagas que compõem o tempo de preenchimento')
      case 'rec_prazo': return sel((v) => vagaNoPrazo(vagaIndic(v), e.contr, hoje) !== null, [['noPrazo', 'Dentro do prazo?']], 'Vagas com prazo de preenchimento')
      case 'rec_encerradas': return sel((v) => ['encerrada', 'cancelada'].includes(v.status), [['contratacoes', 'Contratações'], ['motivo', 'Motivo informado']], 'Vagas encerradas ou canceladas', podeMotivo ? undefined : 'O texto do motivo é visível apenas para quem gerencia vagas.')
      case 'rec_propostas': return sel((v) => (aceitas.get(v.id) ?? 0) + (recusadas.get(v.id) ?? 0) > 0, [['propostasAceitas', 'Aceitas'], ['propostasRecusadas', 'Recusadas']], 'Propostas por vaga', 'Contagens apenas; valores de proposta não são exibidos aqui.')
    }
  }
  if (chave.startsWith('pq_')) {
    const l = await carregarPesquisas(c, f, f.periodo)
    const base = (x: PesqLinha) => ({ titulo: x.titulo, categoria: x.categoria, tipo: x.modo === 'anonima' ? 'Anônima' : 'Identificada', situacao: x.status, inicio: x.inicio, convidados: x.convidados, respostas: x.respostas, taxa: x.taxa, enps: x.enps?.valor ?? null, observacao: x.suprimido ? x.motivo ?? 'Oculto' : x.comLink ? 'Link público: sem taxa de resposta' : null })
    const cols: Colunas = [['titulo', 'Pesquisa'], ['categoria', 'Categoria'], ['tipo', 'Tipo'], ['situacao', 'Situação'], ['inicio', 'Início'], ['convidados', 'Convidados'], ['respostas', 'Respostas'], ['taxa', 'Participação (%)']]
    const nota = 'Somente dados agregados: respostas individuais nunca aparecem neste painel.'
    if (chave === 'pq_pesquisas') return { titulo: 'Pesquisas do período', colunas: [...cols, ['enps', 'eNPS'], ['observacao', 'Observação']], linhas: l.map(base), nota }
    if (chave === 'pq_enps') return { titulo: 'Pesquisas com eNPS', colunas: [...cols, ['enps', 'eNPS']], linhas: l.filter((x) => x.enps).map(base), nota }
    if (chave === 'pq_baixa_adesao') return { titulo: 'Pesquisas com baixa participação', colunas: cols, linhas: l.filter((x) => !x.comLink && x.convidados >= 5 && (x.taxa ?? 100) < 30 && ['aberta', 'encerrada'].includes(x.status)).map(base), nota }
  }
  if (chave.startsWith('est_')) {
    const b = await blocoEstrutura(c, f)
    const t = (k: string) => b.tabelas.find((x) => x.chave === k)!
    const { legado, sets, cgs, uns, pessoasH } = await dadosEstrutura(c, f, c.usuario.caps.has('vagas:ver'))
    switch (chave) {
      case 'est_pessoas': {
        const filtrada = filtrarPessoas(pessoasH, { setorId: f.setor, unidadeId: f.unidade, gestorId: f.gestor }, sets).filter(ehAtiva)
        const ns = new Map(sets.map((s) => [s.id, s.nome])), nc = new Map(cgs.map((x) => [x.id, x.nome])), nu = new Map(uns.map((x) => [x.id, x.nome])), np = new Map(legado.map((x) => [x.id, x.nomeSocial || x.nome]))
        return {
          titulo: 'Pessoas ativas', colunas: [['nome', 'Pessoa'], ['funcao', 'Função'], ['area', 'Área'], ['unidade', 'Unidade'], ['gestor', 'Gestor imediato']],
          linhas: filtrada.map((x) => ({ nome: np.get(x.id) ?? x.nome, funcao: nc.get(x.cargoId ?? '') ?? '—', area: ns.get(x.setorId ?? '') ?? '—', unidade: nu.get(x.unidadeId ?? '') ?? '—', gestor: x.responsavelId ? np.get(x.responsavelId) ?? 'Cadastro removido' : '—' })),
          nota: 'Sem contato, contrato, valores ou avaliações.',
        }
      }
      case 'est_equipes': return { titulo: t('equipes').titulo, colunas: t('equipes').colunas.map((x) => [x.chave, x.rotulo] as [string, string]), linhas: t('equipes').linhas }
      case 'est_pendencias': return { titulo: t('pendencias').titulo, colunas: t('pendencias').colunas.map((x) => [x.chave, x.rotulo] as [string, string]), linhas: t('pendencias').linhas, nota: 'Pendências indicam cadastro incompleto, não julgam a estrutura.' }
      case 'est_posicoes_vagas': return { titulo: 'Posições vagas por área', colunas: [['nome', 'Área'], ['qtd', 'Posições abertas']], linhas: b.posicoesVagas.porSetor.map((x) => ({ nome: x.nome, qtd: x.qtd })) }
    }
  }
  throw invalido('Indicador desconhecido.')
}

/* ============================================================
   ROTAS
   ============================================================ */
const CSV_BLOCOS: Bloco[] = ['recrutamento', 'pesquisas', 'estrutura']

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'analytics/resumo', cap: 'analytics:ver',
    h: async (c) => {
      const { r, doCache } = await resumoComCache(c)
      return ok({ ...r, doCache })
    },
  },
  {
    metodo: 'GET', padrao: 'analytics/detalhe', cap: 'analytics:ver',
    h: async (c) => {
      const chave = String(c.req.query.indicador ?? '')
      const def = INDICADORES_DETALHE[chave]
      if (!def) throw invalido('Indicador desconhecido.')
      if (!c.usuario.caps.has(def.cap)) throw proibido('Seu perfil não tem acesso aos registros deste indicador.')
      const f = lerFiltros(c.req.query, hojeISO(c.agora))
      const d = await detalhe(c, chave, f)
      const { pagina, por, offset } = paginacao(c.req.query, 25, 100)
      return ok({
        indicador: chave, bloco: def.bloco, titulo: d.titulo, nota: d.nota ?? null, periodo: rotuloPeriodo(f.periodo),
        colunas: d.colunas.map(([k, r]) => ({ chave: k, rotulo: r })), itens: d.linhas.slice(offset, offset + por), total: d.linhas.length, pagina, por,
      })
    },
  },
  {
    metodo: 'GET', padrao: 'analytics/exportar', cap: 'analytics:ver',
    h: async (c) => {
      const bloco = c.req.query.bloco as Bloco
      if (!CSV_BLOCOS.includes(bloco)) throw invalido('Informe o bloco: recrutamento, pesquisas ou estrutura.')
      const { f, r } = await resumoComCache(c)
      const b = r.blocos[bloco] as { disponivel: boolean; motivo?: string; indicadores?: Indicador[]; tabelas?: Tabela[]; periodo?: string; filtrosAplicados?: string[]; filtrosIgnorados?: string[] }
      if (!b.disponivel) throw proibido(b.motivo ?? 'Sem acesso a este bloco.')
      const linhas: unknown[][] = [
        ['People Analytics', bloco], ['Período', b.periodo ?? ''], ['Gerado em', r.geradoEm],
        ['Filtros aplicados', (b.filtrosAplicados ?? []).join(', ')], ['Filtros ignorados', (b.filtrosIgnorados ?? []).join(', ')], [],
        ['INDICADORES'], ['Indicador', 'Valor', 'Unidade', 'Período anterior', 'Registros na base', 'Definição', 'Fonte', 'Disponível', 'Dependência'],
        ...(b.indicadores ?? []).map((i) => [i.rotulo, i.valor, i.unidade, i.anterior ?? '', i.base ?? '', i.definicao, i.fonte, i.disponivel ? 'sim' : 'não', i.dependencia ?? '']),
      ]
      for (const t of b.tabelas ?? []) { linhas.push([], [t.titulo.toUpperCase()], t.colunas.map((x) => x.rotulo), ...t.linhas.map((l) => t.colunas.map((x) => l[x.chave] ?? ''))) }
      await auditar(c.db, c.usuario.colaboradorId, 'analytics', bloco, 'exportar', { de: f.periodo.de, ate: f.periodo.ate })
      return { status: 200, binario: { mime: 'text/csv; charset=utf-8', nome: `analytics-${bloco}-${hojeISO(c.agora)}.csv`, dados: Buffer.from(paraCsv(linhas), 'utf8') } }
    },
  },
]
void inteiro
