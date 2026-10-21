/* ============================================================
   4JURIS Pessoas · Indicadores do RH (cálculos puros)
   ------------------------------------------------------------
   Cada indicador tem definição, fonte e período. Não há índices de
   "produtividade" baseados em cliques, tempo conectado ou presença
   digital, nem rankings individuais punitivos.
   Cálculo de encerramentos adaptado de
   gest-o_rh-master/lib/turnover-calculo.ts.
   ============================================================ */
import type { Colaborador, DB } from '@/lib/types'
import { diasEntre, somarDias } from './datas.js'

export interface Filtro {
  inicio: string
  fim: string
  setorId?: string // 'todos' ou id
}

export interface Indicador {
  id: string
  titulo: string
  valor: string | number
  definicao: string
  fonte: string
  detalhe?: string
}

export function ativoEm(c: Colaborador, dia: string): boolean {
  if (c.dataEntrada > dia) return false
  if (c.encerramento && c.encerramento.data <= dia) return false
  return c.status !== 'pendente' || c.dataEntrada <= dia
}

const noSetor = (f: Filtro) => (c: Colaborador) => !f.setorId || f.setorId === 'todos' || c.setorId === f.setorId
const noPeriodo = (d: string | undefined, f: Filtro) => !!d && d.slice(0, 10) >= f.inicio && d.slice(0, 10) <= f.fim

export function pessoasNoFiltro(db: DB, f: Filtro) {
  return db.colaboradores.filter(noSetor(f))
}

export function indicadoresPessoas(db: DB, f: Filtro, hoje: string): Indicador[] {
  const pessoas = pessoasNoFiltro(db, f)
  const ativosFim = pessoas.filter((c) => ativoEm(c, f.fim)).length
  const ativosIni = pessoas.filter((c) => ativoEm(c, f.inicio)).length
  const inicios = pessoas.filter((c) => noPeriodo(c.dataEntrada, f)).length
  const encerramentos = pessoas.filter((c) => noPeriodo(c.encerramento?.data, f)).length
  const media = (ativosIni + ativosFim) / 2
  const taxa = media > 0 ? Math.round((encerramentos / media) * 1000) / 10 : 0
  const ids = new Set(pessoas.map((c) => c.id))
  const limite = somarDias(hoje, 60)
  const contratosVencendo = db.contratos.filter((k) => ids.has(k.colaboradorId) && k.status !== 'encerrado' && k.fim && k.fim >= hoje && k.fim <= limite).length
  const docsVencidos = db.documentos.filter((d) => ids.has(d.colaboradorId) && d.validade && d.validade < hoje).length
  const docsVencendo = db.documentos.filter((d) => ids.has(d.colaboradorId) && d.validade && d.validade >= hoje && d.validade <= limite).length

  return [
    { id: 'ativos', titulo: 'Parcerias ativas', valor: ativosFim, definicao: 'Pessoas com parceria iniciada até o fim do período e não encerrada.', fonte: 'Cadastro de pessoas (início e encerramento da parceria)', detalhe: `${ativosIni} no início do período` },
    { id: 'inicios', titulo: 'Novas parcerias', valor: inicios, definicao: 'Parcerias com data de início dentro do período.', fonte: 'Cadastro de pessoas (data de início)' },
    { id: 'encerramentos', titulo: 'Parcerias encerradas', valor: encerramentos, definicao: 'Parcerias com encerramento registrado dentro do período.', fonte: 'Registros de encerramento de contrato' },
    { id: 'taxa', titulo: 'Taxa de encerramento', valor: `${taxa.toLocaleString('pt-BR')}%`, definicao: 'Encerramentos ÷ média de parcerias ativas (início e fim do período) × 100. Indicador descritivo: não explica causas.', fonte: 'Calculado a partir dos dois indicadores acima' },
    { id: 'contratos', titulo: 'Contratos vencendo (60 dias)', valor: contratosVencendo, definicao: 'Contratos não encerrados com data de término nos próximos 60 dias, a partir de hoje.', fonte: 'Contratos de prestação de serviços' },
    { id: 'docs', titulo: 'Documentos vencidos', valor: docsVencidos, definicao: 'Documentos com validade anterior a hoje.', fonte: 'Metadados de documentos', detalhe: `${docsVencendo} vencem em até 60 dias` },
  ]
}

export function distribuicaoPorSetor(db: DB, dia: string) {
  const ativos = db.colaboradores.filter((c) => ativoEm(c, dia))
  return db.setores.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor, qtd: ativos.filter((c) => c.setorId === s.id).length }))
    .sort((a, b) => b.qtd - a.qtd)
}

export function faixasTempoParceria(db: DB, f: Filtro, dia: string) {
  const faixas = [
    { rotulo: '< 6 meses', min: 0, max: 182 },
    { rotulo: '6–12 meses', min: 183, max: 365 },
    { rotulo: '1–2 anos', min: 366, max: 730 },
    { rotulo: '2–4 anos', min: 731, max: 1460 },
    { rotulo: '4+ anos', min: 1461, max: Infinity },
  ]
  const ativos = pessoasNoFiltro(db, f).filter((c) => ativoEm(c, dia))
  return faixas.map((fx) => ({ rotulo: fx.rotulo, qtd: ativos.filter((c) => { const d = diasEntre(c.dataEntrada, dia); return d >= fx.min && d <= fx.max }).length }))
}

export function encerramentosPorMotivo(db: DB, f: Filtro) {
  const enc = pessoasNoFiltro(db, f).filter((c) => noPeriodo(c.encerramento?.data, f))
  const mapa = new Map<string, number>()
  enc.forEach((c) => {
    const nome = db.motivosEncerramento.find((m) => m.id === c.encerramento?.motivoId)?.nome ?? 'Não informado'
    mapa.set(nome, (mapa.get(nome) ?? 0) + 1)
  })
  return [...mapa.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd)
}

export function indicadoresOnboarding(db: DB, f: Filtro) {
  const ids = new Set(pessoasNoFiltro(db, f).map((c) => c.id))
  const procs = db.processos.filter((p) => p.tipo === 'integracao' && ids.has(p.colaboradorId))
  const andamento = procs.filter((p) => !p.concluidoEm)
  const concluidosPeriodo = procs.filter((p) => noPeriodo(p.concluidoEm, f)).length
  const pctMedio = andamento.length
    ? Math.round(andamento.reduce((a, p) => a + p.itens.filter((i) => i.feito).length / Math.max(1, p.itens.length), 0) / andamento.length * 100)
    : 0
  const pendRH = andamento.reduce((a, p) => a + p.itens.filter((i) => !i.feito && i.responsavel === 'rh').length, 0)
  return { andamento: andamento.length, concluidosPeriodo, pctMedio, pendRH }
}

export function indicadoresEventos(db: DB, f: Filtro) {
  const evs = db.eventos.filter((e) => noPeriodo(e.inicio, f) && e.status !== 'cancelado' &&
    (!f.setorId || f.setorId === 'todos' || e.visibilidade === 'todos' || e.setoresAlvo.includes(f.setorId)))
  const porCategoria = new Map<string, number>()
  evs.forEach((e) => porCategoria.set(e.categoria, (porCategoria.get(e.categoria) ?? 0) + 1))
  const confirmacoes = evs.reduce((a, e) => a + e.confirmados.length, 0)
  const presencas = evs.reduce((a, e) => a + e.presencas.length, 0)
  const cancelados = db.eventos.filter((e) => noPeriodo(e.inicio, f) && e.status === 'cancelado').length
  return { total: evs.length, cancelados, confirmacoes, presencas, porCategoria: [...porCategoria.entries()].map(([nome, qtd]) => ({ nome, qtd })) }
}

export function indicadoresGamificacao(db: DB, f: Filtro) {
  const ids = new Set(pessoasNoFiltro(db, f).map((c) => c.id))
  const lanc = db.lancamentos.filter((l) => ids.has(l.colaboradorId) && noPeriodo(l.criadoEm, f))
  const pontos = lanc.reduce((a, l) => a + l.pontos, 0)
  const pessoasPontuaram = new Set(lanc.map((l) => l.colaboradorId)).size
  const reconhecimentos = db.reconhecimentos.filter((r) => ids.has(r.paraId) && noPeriodo(r.criadoEm, f)).length
  const desafios = lanc.filter((l) => l.acao === 'desafio_concluido').length
  const conquistas = db.conquistas.filter((c) => ids.has(c.colaboradorId) && noPeriodo(c.obtidaEm, f)).length
  const porAcao = new Map<string, number>()
  lanc.forEach((l) => porAcao.set(l.acao, (porAcao.get(l.acao) ?? 0) + l.pontos))
  return { pontos, pessoasPontuaram, reconhecimentos, desafios, conquistas, porAcao: [...porAcao.entries()].map(([acao, pts]) => ({ acao, pts })).sort((a, b) => b.pts - a.pts) }
}

/** Série mensal (últimos N meses até `fim`) de um contador por data. */
export function serieMensal(datas: (string | undefined)[], fim: string, meses = 6) {
  const out: { mes: string; qtd: number }[] = []
  const base = new Date(fim.slice(0, 7) + '-01T00:00:00')
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ mes: chave, qtd: datas.filter((x) => x?.slice(0, 7) === chave).length })
  }
  return out
}
