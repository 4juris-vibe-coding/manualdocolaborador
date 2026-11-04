/* ============================================================
   4JURIS Pessoas · Vínculos (períodos de parceria) e movimentação
   ------------------------------------------------------------
   A PESSOA é uma só (Colaborador.id). Cada período em que ela
   presta serviços é um VÍNCULO, com datas EFETIVAS informadas pelo
   RH — independentes de quando o registro foi criado ou alterado.

   - Encerrar: fecha o vínculo aberto com a data efetiva.
   - Reativar: desfaz o encerramento do MESMO vínculo (o período
     continua; o encerramento desfeito fica no histórico).
   - Novo vínculo: a pessoa volta depois de um encerramento
     definitivo. Abre outro período, sem criar outro cadastro.

   Convenção de datas (a mesma de analytics.ativoEm):
   a pessoa conta no quadro do dia `inicio` até a VÉSPERA de `fim`.
   No dia do encerramento ela já não está no quadro.
   Por isso, para qualquer mês: final = inicial + admissões − desligamentos.

   Puro (sem React, sem store): usado pelo cliente e pelo servidor.
   ============================================================ */
import type { Colaborador, HistoricoFuncao, IniciativaEncerramento, MovimentacaoVinculo, Vinculo } from '@/lib/types'
import { diasEntre, somarDias } from './datas.js'

/** Último elemento (o projeto compila para ES2020, sem Array.prototype.at). */
export const ultimo = <T,>(a: readonly T[]): T | undefined => a[a.length - 1]

export const INICIATIVA_LABEL: Record<IniciativaEncerramento, string> = {
  empresa: 'Iniciativa da 4JURIS (involuntário)',
  prestador: 'Iniciativa da pessoa prestadora (voluntário)',
  mutuo: 'Acordo entre as partes',
  termino: 'Término do escopo ou do prazo',
}
export const INICIATIVA_CURTA: Record<IniciativaEncerramento, string> = {
  empresa: 'Involuntário', prestador: 'Voluntário', mutuo: 'Acordo', termino: 'Término de escopo/prazo',
}
export const INICIATIVAS = Object.keys(INICIATIVA_LABEL) as IniciativaEncerramento[]
/** Desligamento involuntário = iniciativa da empresa, classificado pelo RH (nunca deduzido do texto do motivo). */
export const ehInvoluntario = (i?: IniciativaEncerramento) => i === 'empresa'

export const MOVIMENTACAO_LABEL: Record<MovimentacaoVinculo['tipo'], string> = {
  inicio: 'Início da parceria',
  encerramento: 'Encerramento da parceria',
  reativacao: 'Reativação (encerramento desfeito)',
  novo_vinculo: 'Novo período de parceria',
  correcao_encerramento: 'Correção do encerramento',
  correcao_inicio: 'Correção da data de início',
}

/**
 * Vínculos da pessoa, do mais antigo ao mais recente.
 * Cadastros anteriores a esta versão não têm `vinculos`: o período é derivado de
 * `dataEntrada` + `encerramento` (mesmo resultado que as telas já mostravam).
 */
export function vinculosDe(c: Pick<Colaborador, 'id' | 'dataEntrada' | 'encerramento' | 'vinculos'>): Vinculo[] {
  if (c.vinculos?.length) return [...c.vinculos].sort((a, b) => a.inicio.localeCompare(b.inicio))
  if (!c.dataEntrada) return []
  const e = c.encerramento
  return [{
    id: `${c.id}-v1`, inicio: c.dataEntrada,
    ...(e ? { fim: e.data, motivoId: e.motivoId, observacao: e.observacao, iniciativa: e.iniciativa, encerradoPorId: e.porId, encerradoEm: e.registradoEm } : {}),
  }]
}

export const vinculoAtual = (c: Parameters<typeof vinculosDe>[0]): Vinculo | undefined => ultimo(vinculosDe(c))

/** A pessoa estava no quadro ao FIM do dia `dia`. */
export function noQuadroEm(c: Colaborador, dia: string): boolean {
  if (c.status === 'pendente' && !c.vinculos?.length && c.dataEntrada > dia) return false
  return vinculosDe(c).some((v) => v.inicio <= dia && (!v.fim || v.fim > dia))
}

/** Valida a lista de vínculos (sem sobreposição, só o último aberto) e a coerência com o status. */
export function validarVinculos(c: Pick<Colaborador, 'status' | 'vinculos' | 'encerramento'>): string | null {
  const vs = c.vinculos
  if (!vs?.length) return null
  const ord = [...vs].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const ids = new Set<string>()
  for (let i = 0; i < ord.length; i++) {
    const v = ord[i]
    if (!v.id || ids.has(v.id)) return 'Período de parceria com identificador inválido.'
    ids.add(v.id)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.inicio) || (v.fim && !/^\d{4}-\d{2}-\d{2}$/.test(v.fim))) return 'Data de período de parceria inválida.'
    if (v.fim && v.fim < v.inicio) return 'O encerramento não pode ser anterior ao início da parceria.'
    if (i < ord.length - 1) {
      if (!v.fim) return 'Só o período mais recente pode estar em aberto.'
      if (ord[i + 1].inicio < v.fim) return 'Os períodos de parceria não podem se sobrepor.'
    }
  }
  const fimOrd = ultimo(ord)!
  if (c.status === 'encerrado' && !fimOrd.fim) return 'Parceria encerrada sem data de encerramento.'
  if (c.status !== 'encerrado' && fimOrd.fim) return 'O período mais recente está encerrado: a situação deve ser "encerrada".'
  if (c.status === 'encerrado' && c.encerramento && c.encerramento.data !== fimOrd.fim) return 'A data de encerramento diverge do período de parceria.'
  return null
}

/** O histórico de movimentações só cresce: nada do que existia pode sumir ou mudar. */
export function historicoSoAcrescenta(antes?: MovimentacaoVinculo[], depois?: MovimentacaoVinculo[]): boolean {
  const a = antes ?? [], d = depois ?? []
  const porId = new Map(d.map((m) => [m.id, JSON.stringify(m)]))
  return a.every((m) => porId.get(m.id) === JSON.stringify(m))
}

/**
 * Aplica o encerramento ao cadastro (fecha o período aberto, grava o espelho `encerramento`,
 * acrescenta a movimentação e remove o agendamento). Usado pela ação do RH e pela rotina do servidor.
 * Devolve null se não há período aberto ou a data é anterior ao início.
 */
export function aplicarEncerramento(
  c: Colaborador,
  e: { data: string; motivoId: string; iniciativa: IniciativaEncerramento; observacao?: string },
  porId: string | undefined, agora: string, idMovimentacao: string,
): Colaborador | null {
  const vs = vinculosDe(c)
  const atual = ultimo(vs)
  if (!atual || atual.fim || e.data < atual.inicio) return null
  const fechado: Vinculo = { ...atual, fim: e.data, motivoId: e.motivoId, iniciativa: e.iniciativa, observacao: e.observacao, encerradoPorId: porId, encerradoEm: agora }
  const mov: MovimentacaoVinculo = { id: idMovimentacao, tipo: 'encerramento', em: agora, porId, vinculoId: atual.id, dataEfetiva: e.data, motivoId: e.motivoId, iniciativa: e.iniciativa }
  const { encerramentoAgendado: _ag, ...resto } = c
  return {
    ...resto, status: 'encerrado', vinculos: [...vs.slice(0, -1), fechado], movimentacoes: [...(c.movimentacoes ?? []), mov],
    encerramento: { data: e.data, motivoId: e.motivoId, observacao: e.observacao, iniciativa: e.iniciativa, porId, registradoEm: agora },
  }
}

/** O agendamento já venceu (data efetiva chegou). */
export const agendamentoVencido = (c: Pick<Colaborador, 'encerramentoAgendado' | 'status'>, hoje: string) =>
  c.status !== 'encerrado' && !!c.encerramentoAgendado && c.encerramentoAgendado.data <= hoje

/* ============================================================
   Indicadores de movimentação (People Analytics)
   ============================================================ */

/** Critério do headcount médio. Um só critério por consulta (nunca mistura). */
export type CriterioMedia = 'inicio_fim' | 'diario'

export const CRITERIO_LABEL: Record<CriterioMedia, string> = {
  inicio_fim: 'Média entre início e fim do mês (padrão)',
  diario: 'Média diária do mês (mais precisa)',
}

export interface FiltroPessoas {
  setorId?: string; cargoId?: string; regime?: string; unidadeId?: string
  /**
   * Histórico de mudanças (área, função, gestor) com data efetiva. Quando informado, os filtros de área e
   * função usam o que a pessoa era NA DATA (ex.: quem estava no Comercial em julho e foi para o Jurídico em agosto).
   */
  historico?: HistoricoFuncao[]
}

/** Data efetiva de uma mudança registrada no histórico (registros antigos: o dia do registro). */
export const dataDaMudanca = (h: Pick<HistoricoFuncao, 'em' | 'dataEfetiva'>) => (h.dataEfetiva ?? h.em).slice(0, 10)

/**
 * Área, função e gestor que a pessoa tinha ao FIM do dia `dia`, reconstruídos a partir do cadastro atual
 * desfazendo (da mais recente para a mais antiga) as mudanças com data efetiva posterior ao dia.
 */
export function organizacaoEm(c: Pick<Colaborador, 'id' | 'setorId' | 'cargoId' | 'responsavelId'>, historico: HistoricoFuncao[] | undefined, dia: string) {
  const foto = { setorId: c.setorId, cargoId: c.cargoId, responsavelId: c.responsavelId }
  if (!historico?.length) return foto
  const minhas = historico.filter((h) => h.colaboradorId === c.id && dataDaMudanca(h) > dia).sort((a, b) => dataDaMudanca(b).localeCompare(dataDaMudanca(a)) || b.em.localeCompare(a.em))
  for (const h of minhas) {
    if ((h.cargoAnteriorId ?? '') !== (h.cargoNovoId ?? '') && (h.cargoAnteriorId !== undefined || h.cargoNovoId !== undefined)) foto.cargoId = h.cargoAnteriorId ?? ''
    if (h.setorNovoId !== undefined || h.setorAnteriorId !== undefined) foto.setorId = h.setorAnteriorId ?? foto.setorId
    if (h.gestorNovoId !== undefined || h.gestorAnteriorId !== undefined) foto.responsavelId = h.gestorAnteriorId
  }
  return foto
}

/** Pessoa do quadro com o vínculo que explica a presença no mês (para o detalhamento). */
export interface ItemMes { pessoaId: string; vinculoId: string; inicio: string; fim?: string; iniciativa?: IniciativaEncerramento; motivoId?: string }

export interface MesMovimentacao {
  mes: string // AAAA-MM
  inicio: string // primeiro dia
  fim: string // último dia (ou hoje, se o mês está em curso)
  emCurso: boolean
  headcountInicial: number
  headcountFinal: number
  headcountMedio: number
  admissoes: number
  desligamentos: number
  involuntarios: number
  /** Desligamentos sem iniciativa classificada pelo RH (não entram no involuntário). */
  naoClassificados: number
  saldo: number
  /** ((admissões + desligamentos) ÷ 2) ÷ headcount médio × 100. null se o quadro médio é 0. */
  turnover: number | null
  /** desligamentos involuntários ÷ headcount médio × 100. */
  turnoverInvoluntario: number | null
  pessoas: { iniciais: ItemMes[]; admitidas: ItemMes[]; desligadas: ItemMes[]; finais: ItemMes[] }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export function ultimoDiaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m, 0)
  return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function mesesDoIntervalo(de: string, ate: string): string[] {
  const out: string[] = []
  let [y, m] = de.slice(0, 7).split('-').map(Number)
  const [yf, mf] = ate.slice(0, 7).split('-').map(Number)
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

const okF = (v: string | undefined, alvo?: string) => !alvo || alvo === 'todos' || v === alvo
/** Filtro fixo (forma de contratação e unidade, que não têm histórico). */
function filtrar(pessoas: Colaborador[], f: FiltroPessoas = {}) {
  return pessoas.filter((c) => okF(c.regime, f.regime) && okF(c.unidadeId, f.unidadeId))
}
/** Filtro de área e função NA DATA (usa o histórico quando informado). */
function naData(c: Colaborador, f: FiltroPessoas, dia: string): boolean {
  if ((!f.setorId || f.setorId === 'todos') && (!f.cargoId || f.cargoId === 'todos')) return true
  const o = organizacaoEm(c, f.historico, dia)
  return okF(o.setorId, f.setorId) && okF(o.cargoId, f.cargoId)
}

/** Vínculos ativos ao fim do dia `dia`. */
function noQuadro(pessoas: Colaborador[], dia: string, f: FiltroPessoas = {}): ItemMes[] {
  const out: ItemMes[] = []
  for (const c of pessoas) for (const v of vinculosDe(c)) if (v.inicio <= dia && (!v.fim || v.fim > dia) && naData(c, f, dia)) out.push(item(c, v))
  return out
}
/** Último dia em que a pessoa esteve no quadro (véspera do encerramento), para saber de que área ela saiu. */
const ultimoDiaNoQuadro = (v: Vinculo) => (v.fim! > v.inicio ? somarDias(v.fim!, -1) : v.inicio)
const item = (c: Colaborador, v: Vinculo): ItemMes => ({ pessoaId: c.id, vinculoId: v.id, inicio: v.inicio, fim: v.fim, iniciativa: v.iniciativa, motivoId: v.motivoId })

/**
 * Movimentação de um mês. `hoje` limita o mês em curso (o final é hoje).
 * Fórmulas (definidas pelo RH da 4JURIS):
 *   Headcount médio = (inicial + final) ÷ 2                [critério padrão]
 *                   = média do quadro ao fim de cada dia   [critério diário]
 *   Turnover geral  = ((admissões + desligamentos) ÷ 2) ÷ headcount médio × 100
 *   Turnover involuntário = desligamentos involuntários ÷ headcount médio × 100
 *   Saldo = admissões − desligamentos
 */
export function movimentacaoDoMes(todas: Colaborador[], mes: string, hoje: string, f: FiltroPessoas = {}, criterio: CriterioMedia = 'inicio_fim'): MesMovimentacao {
  const pessoas = filtrar(todas, f)
  const inicio = `${mes}-01`
  const ultimo = ultimoDiaMes(mes)
  const emCurso = hoje >= inicio && hoje < ultimo
  const fim = emCurso ? hoje : ultimo
  const iniciais = noQuadro(pessoas, somarDias(inicio, -1), f)
  const finais = noQuadro(pessoas, fim, f)
  const admitidas: ItemMes[] = [], desligadas: ItemMes[] = []
  for (const c of pessoas) for (const v of vinculosDe(c)) {
    if (v.inicio >= inicio && v.inicio <= fim && naData(c, f, v.inicio)) admitidas.push(item(c, v))
    if (v.fim && v.fim >= inicio && v.fim <= fim && naData(c, f, ultimoDiaNoQuadro(v))) desligadas.push(item(c, v))
  }
  let medio: number
  if (criterio === 'diario') {
    const dias = diasEntre(inicio, fim) + 1
    let soma = 0
    for (let i = 0; i < dias; i++) soma += noQuadro(pessoas, somarDias(inicio, i), f).length
    medio = dias > 0 ? soma / dias : 0
  } else medio = (iniciais.length + finais.length) / 2
  const involuntarios = desligadas.filter((d) => ehInvoluntario(d.iniciativa)).length
  return {
    mes, inicio, fim, emCurso,
    headcountInicial: iniciais.length, headcountFinal: finais.length, headcountMedio: r2(medio),
    admissoes: admitidas.length, desligamentos: desligadas.length, involuntarios,
    naoClassificados: desligadas.filter((d) => !d.iniciativa).length,
    saldo: admitidas.length - desligadas.length,
    turnover: medio > 0 ? r1(((admitidas.length + desligadas.length) / 2) / medio * 100) : null,
    turnoverInvoluntario: medio > 0 ? r1(involuntarios / medio * 100) : null,
    pessoas: { iniciais, admitidas, desligadas, finais },
  }
}

export interface ResumoPeriodo {
  meses: MesMovimentacao[]
  admissoes: number
  desligamentos: number
  involuntarios: number
  naoClassificados: number
  saldo: number
  headcountInicial: number
  headcountFinal: number
  /** Média dos headcounts médios mensais (mesmo critério em todos os meses). */
  headcountMedio: number
  turnover: number | null
  turnoverInvoluntario: number | null
}

/** Série mensal + consolidado do intervalo, com a MESMA fórmula aplicada ao período inteiro. */
export function movimentacaoDoPeriodo(todas: Colaborador[], de: string, ate: string, hoje: string, f: FiltroPessoas = {}, criterio: CriterioMedia = 'inicio_fim'): ResumoPeriodo {
  const meses = mesesDoIntervalo(de, ate > hoje ? hoje : ate).map((m) => movimentacaoDoMes(todas, m, hoje, f, criterio))
  const soma = (k: 'admissoes' | 'desligamentos' | 'involuntarios' | 'naoClassificados') => meses.reduce((a, m) => a + m[k], 0)
  const adm = soma('admissoes'), desl = soma('desligamentos'), inv = soma('involuntarios')
  const medio = meses.length ? meses.reduce((a, m) => a + m.headcountMedio, 0) / meses.length : 0
  return {
    meses, admissoes: adm, desligamentos: desl, involuntarios: inv, naoClassificados: soma('naoClassificados'), saldo: adm - desl,
    headcountInicial: meses[0]?.headcountInicial ?? 0, headcountFinal: ultimo(meses)?.headcountFinal ?? 0,
    headcountMedio: r2(medio),
    turnover: medio > 0 ? r1(((adm + desl) / 2) / medio * 100) : null,
    turnoverInvoluntario: medio > 0 ? r1(inv / medio * 100) : null,
  }
}

/**
 * Retenção de contratações: para cada contratação (data + grupo, ex.: recrutador), procura o vínculo da pessoa
 * iniciado até 60 dias depois e verifica se ele seguia ativo `dias` depois do início. Contratações que ainda não
 * completaram o prazo ficam "em observação" (fora da taxa).
 */
export function retencaoPorGrupo(
  contratacoes: { pessoa: Pick<Colaborador, 'id' | 'dataEntrada' | 'encerramento' | 'vinculos'> | null; contratadoEm: string; grupo: string }[],
  hoje: string, dias = 90,
): { grupo: string; contratacoes: number; base: number; retidos: number; emObservacao: number; semCadastro: number; taxa: number | null }[] {
  const g = new Map<string, { contratacoes: number; base: number; retidos: number; emObservacao: number; semCadastro: number }>()
  for (const c of contratacoes) {
    const x = g.get(c.grupo) ?? { contratacoes: 0, base: 0, retidos: 0, emObservacao: 0, semCadastro: 0 }
    x.contratacoes++
    const v = c.pessoa ? vinculosDe(c.pessoa).find((y) => y.inicio >= somarDias(c.contratadoEm, -15) && y.inicio <= somarDias(c.contratadoEm, 60)) : undefined
    if (!v) x.semCadastro++
    else {
      const marco = somarDias(v.inicio, dias)
      if (marco > hoje && (!v.fim || v.fim > hoje)) x.emObservacao++
      else { x.base++; if (!v.fim || v.fim > marco) x.retidos++ }
    }
    g.set(c.grupo, x)
  }
  return [...g].map(([grupo, x]) => ({ grupo, ...x, taxa: x.base ? r1((x.retidos / x.base) * 100) : null })).sort((a, b) => b.contratacoes - a.contratacoes)
}

/** Retenção em `dias` agrupada por área (na data de início, pelo histórico) — todos os inícios do intervalo. */
export function retencaoPorArea(todas: Colaborador[], de: string, ate: string, hoje: string, dias = 90, historico?: HistoricoFuncao[]) {
  const g = new Map<string, { base: number; retidos: number; emObservacao: number }>()
  for (const c of todas) for (const v of vinculosDe(c)) {
    if (v.inicio < de || v.inicio > ate) continue
    const area = organizacaoEm(c, historico, v.inicio).setorId
    const x = g.get(area) ?? { base: 0, retidos: 0, emObservacao: 0 }
    const marco = somarDias(v.inicio, dias)
    if (marco > hoje && (!v.fim || v.fim > hoje)) x.emObservacao++
    else { x.base++; if (!v.fim || v.fim > marco) x.retidos++ }
    g.set(area, x)
  }
  return [...g].map(([setorId, x]) => ({ setorId, ...x, taxa: x.base ? r1((x.retidos / x.base) * 100) : null }))
}

/** Tempo médio de permanência (dias) dos vínculos encerrados no intervalo. */
export function permanenciaMedia(todas: Colaborador[], de: string, ate: string, f: FiltroPessoas = {}): number | null {
  const ds: number[] = []
  for (const c of filtrar(todas, f)) for (const v of vinculosDe(c)) if (v.fim && v.fim >= de && v.fim <= ate && naData(c, f, ultimoDiaNoQuadro(v))) ds.push(diasEntre(v.inicio, v.fim))
  return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : null
}

/** Retenção: dos vínculos iniciados no intervalo, % que continuavam ativos `dias` depois do início (só os que já completaram o prazo). */
export function retencao(todas: Colaborador[], de: string, ate: string, hoje: string, dias = 90, f: FiltroPessoas = {}): { base: number; retidos: number; taxa: number | null } {
  let base = 0, retidos = 0
  for (const c of filtrar(todas, f)) for (const v of vinculosDe(c)) {
    if (v.inicio < de || v.inicio > ate || !naData(c, f, v.inicio)) continue
    const marco = somarDias(v.inicio, dias)
    if (marco > hoje) continue
    base++
    if (!v.fim || v.fim > marco) retidos++
  }
  return { base, retidos, taxa: base ? r1((retidos / base) * 100) : null }
}
