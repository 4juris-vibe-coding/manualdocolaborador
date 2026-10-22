/* ============================================================
   Central de pesquisas · cálculo de resultados e proteção do anonimato.
   Funções PURAS. Regras:
   - Nada é exibido (nem somado) para grupos abaixo do mínimo.
   - Supressão COMPLEMENTAR: o conjunto suprimido, somado, também precisa
     atingir o mínimo; senão o menor grupo visível é suprimido junto
     (impede descobrir um grupo pequeno por subtração do total).
   - Filtros que isolariam (ou deixariam de fora) um grupo pequeno são bloqueados.
   - Médias só para escalas; taxa de resposta NÃO é índice de satisfação.
   - Texto livre nunca é mostrado por segmento.
   ============================================================ */
import { assinaturaPergunta, faixaNumerica, ROTULOS_LIKERT, tipoTexto, type PerguntaPesquisa, type Valor } from './pesquisaTipos.js'

export interface RespostaBruta {
  id?: string
  versao: number
  /** AAAA-MM-DD */
  enviadaEm: string
  grupo: { setorId?: string; unidadeId?: string }
  itens: Record<string, Valor>
  tags?: Record<string, string[]>
}
export interface VersaoEstrutura { versao: number; perguntas: PerguntaPesquisa[] }

const arred = (n: number, c = 1) => Math.round(n * 10 ** c) / 10 ** c

/* ---------------- eNPS / NPS ---------------- */
export type ClasseNps = 'promotor' | 'neutro' | 'detrator'
export const classificarNps = (n: number): ClasseNps => (n >= 9 ? 'promotor' : n >= 7 ? 'neutro' : 'detrator')

export interface ResumoNps {
  n: number; promotores: number; neutros: number; detratores: number
  pctPromotores: number; pctNeutros: number; pctDetratores: number
  /** %promotores − %detratores, de −100 a 100 (null sem respostas). */
  enps: number | null
  distribuicao: number[]
}
export function calcularNps(valores: number[]): ResumoNps {
  const v = valores.filter((x) => Number.isInteger(x) && x >= 0 && x <= 10)
  const n = v.length
  const pro = v.filter((x) => classificarNps(x) === 'promotor').length
  const det = v.filter((x) => classificarNps(x) === 'detrator').length
  const dist = Array.from({ length: 11 }, (_, i) => v.filter((x) => x === i).length)
  const pct = (q: number) => (n ? arred((q / n) * 100) : 0)
  return {
    n, promotores: pro, neutros: n - pro - det, detratores: det,
    pctPromotores: pct(pro), pctNeutros: pct(n - pro - det), pctDetratores: pct(det),
    enps: n ? Math.round(((pro - det) / n) * 100) : null, distribuicao: dist,
  }
}

/* ---------------- agregação por pergunta ---------------- */
export type ResultadoPergunta =
  | { tipo: 'numerica'; n: number; media: number | null; distribuicao: { valor: number; rotulo?: string; qtd: number; pct: number }[]; mediaValida: boolean }
  | ({ tipo: 'nps' } & ResumoNps)
  | { tipo: 'opcoes'; n: number; contagem: { opcao: string; qtd: number; pct: number }[] }
  | { tipo: 'ordenacao'; n: number; posicaoMedia: { opcao: string; media: number }[] }
  | { tipo: 'datas'; n: number; porMes: { mes: string; qtd: number }[] }
  | { tipo: 'texto'; n: number }

export function agregarPergunta(p: PerguntaPesquisa, valores: Valor[]): ResultadoPergunta {
  const vs = valores.filter((v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
  const n = vs.length
  if (p.tipo === 'nps' || p.tipo === 'enps') return { tipo: 'nps', ...calcularNps(vs.map(Number)) }
  const faixa = faixaNumerica(p)
  if (faixa) {
    const nums = vs.map(Number).filter((x) => x >= faixa.min && x <= faixa.max)
    const distribuicao = []
    for (let x = faixa.min; x <= faixa.max; x++) {
      const qtd = nums.filter((y) => y === x).length
      distribuicao.push({ valor: x, rotulo: p.tipo === 'likert' ? ROTULOS_LIKERT[x - 1] : undefined, qtd, pct: nums.length ? arred((qtd / nums.length) * 100) : 0 })
    }
    return { tipo: 'numerica', n: nums.length, media: nums.length ? arred(nums.reduce((a, b) => a + b, 0) / nums.length, 2) : null, distribuicao, mediaValida: true }
  }
  if (p.tipo === 'unica' || p.tipo === 'sim_nao' || p.tipo === 'multipla') {
    const opcoes = p.tipo === 'sim_nao' ? ['sim', 'nao'] : p.opcoes ?? []
    const contagem = opcoes.map((o) => {
      const qtd = vs.filter((v) => (Array.isArray(v) ? v.includes(o) : v === o)).length
      return { opcao: p.tipo === 'sim_nao' ? (o === 'sim' ? 'Sim' : 'Não') : o, qtd, pct: n ? arred((qtd / n) * 100) : 0 }
    })
    return { tipo: 'opcoes', n, contagem }
  }
  if (p.tipo === 'ordenacao') {
    const opcoes = p.opcoes ?? []
    const posicaoMedia = opcoes.map((o) => {
      const pos = vs.map((v) => (Array.isArray(v) ? v.indexOf(o) + 1 : 0)).filter((x) => x > 0)
      return { opcao: o, media: pos.length ? arred(pos.reduce((a, b) => a + b, 0) / pos.length, 2) : 0 }
    }).sort((a, b) => a.media - b.media)
    return { tipo: 'ordenacao', n, posicaoMedia }
  }
  if (p.tipo === 'data') {
    const m = new Map<string, number>()
    for (const v of vs) { const k = String(v).slice(0, 7); m.set(k, (m.get(k) ?? 0) + 1) }
    return { tipo: 'datas', n, porMes: [...m.entries()].sort().map(([mes, qtd]) => ({ mes, qtd })) }
  }
  return { tipo: 'texto', n }
}

/* ---------------- proteção de grupos pequenos ---------------- */
export interface ContagemGrupo { chave: string; n: number }

/**
 * Decide quais grupos ficam ocultos. Regra 1: n < mínimo. Regra 2 (complementar): se houver
 * grupos ocultos e a soma deles for menor que o mínimo (ou se só um estiver oculto), o menor grupo
 * visível também é ocultado — senão (total − visíveis) revelaria os pequenos. Repete até a soma dos ocultos
 * atingir o mínimo ou não restar grupo visível.
 */
export function suprimirGrupos(grupos: ContagemGrupo[], min: number): Map<string, boolean> {
  const oculto = new Map<string, boolean>(grupos.map((g) => [g.chave, g.n < min]))
  const somaOcultos = () => grupos.filter((g) => oculto.get(g.chave)).reduce((a, g) => a + g.n, 0)
  const qtdOcultos = () => grupos.filter((g) => oculto.get(g.chave)).length
  // Grupos vazios (n = 0) não revelam nada e não contam para a regra complementar.
  const relevantes = () => grupos.filter((g) => oculto.get(g.chave) && g.n > 0)
  while (relevantes().length > 0 && (somaOcultos() < min || qtdOcultos() === 1)) {
    const visiveis = grupos.filter((g) => !oculto.get(g.chave) && g.n > 0).sort((a, b) => a.n - b.n)
    if (!visiveis.length) break
    oculto.set(visiveis[0].chave, true)
  }
  return oculto
}

export interface AvaliacaoFiltro { permitido: boolean; motivo?: string }
/** Um filtro é seguro se o recorte e o RESTANTE (total − recorte) têm ao menos `min` respostas (ou o restante é zero). */
export function avaliarFiltro(nFiltrado: number, nTotal: number, min: number): AvaliacaoFiltro {
  if (nFiltrado < min) return { permitido: false, motivo: `Este recorte tem menos de ${min} respostas e poderia identificar pessoas.` }
  const resto = nTotal - nFiltrado
  if (resto > 0 && resto < min) return { permitido: false, motivo: `Este recorte deixaria de fora menos de ${min} respostas, o que permitiria deduzir esse grupo por subtração.` }
  return { permitido: true }
}

/* ---------------- resultados completos ---------------- */
export type DimensaoSegmento = 'setorId' | 'unidadeId'

export interface SegmentoResultado { chave: string; rotulo: string; n: number; suprimido: boolean; resultado: ResultadoPergunta | null }

export interface PerguntaResultado {
  id: string
  texto: string
  tipo: PerguntaPesquisa['tipo']
  dimensao?: string
  versoes: number[]
  /** Versões em que a pergunta existe com outra redação/escala e por isso NÃO foram somadas. */
  versoesNaoComparaveis: number[]
  n: number
  resultado: ResultadoPergunta | null
  textos?: { respostaId?: string; texto: string; tags: string[] }[]
  porSetor?: SegmentoResultado[]
  porUnidade?: SegmentoResultado[]
}

export interface ResultadosPesquisa {
  total: number
  elegiveis: number
  convidados: number
  taxaResposta: number | null
  minGrupo: number
  /** Total menor que o mínimo: nenhum resultado é mostrado. */
  suprimido: boolean
  filtro?: { setorId?: string; unidadeId?: string }
  filtroBloqueado?: string
  perguntas: PerguntaResultado[]
  evolucao: { data: string; qtd: number; acumulado: number }[]
  dimensoes: { dimensao: string; media: number; n: number; perguntas: number }[]
  enps: ResumoNps | null
  porVersao: { versao: number; n: number }[]
}

export interface EntradaResultados {
  versoes: VersaoEstrutura[]
  respostas: RespostaBruta[]
  elegiveis: number
  convidados: number
  minGrupo: number
  filtro?: { setorId?: string; unidadeId?: string }
  rotulosSetor?: Record<string, string>
  rotulosUnidade?: Record<string, string>
  incluirTextos?: boolean
}

export function taxaResposta(respondidas: number, elegiveis: number): number | null {
  return elegiveis > 0 ? arred((respondidas / elegiveis) * 100) : null
}

export function calcularResultados(e: EntradaResultados): ResultadosPesquisa {
  const todas = e.respostas
  const base: ResultadosPesquisa = {
    total: todas.length, elegiveis: e.elegiveis, convidados: e.convidados, taxaResposta: taxaResposta(todas.length, e.elegiveis),
    minGrupo: e.minGrupo, suprimido: todas.length < e.minGrupo, perguntas: [], evolucao: [], dimensoes: [], enps: null,
    porVersao: [...new Set(todas.map((r) => r.versao))].sort((a, b) => a - b).map((v) => ({ versao: v, n: todas.filter((r) => r.versao === v).length })),
  }
  if (base.suprimido) return base

  let rs = todas
  if (e.filtro && (e.filtro.setorId || e.filtro.unidadeId)) {
    rs = todas.filter((r) => (!e.filtro!.setorId || r.grupo.setorId === e.filtro!.setorId) && (!e.filtro!.unidadeId || r.grupo.unidadeId === e.filtro!.unidadeId))
    const av = avaliarFiltro(rs.length, todas.length, e.minGrupo)
    if (!av.permitido) return { ...base, filtro: e.filtro, filtroBloqueado: av.motivo, suprimido: true }
    base.filtro = e.filtro
  }
  const filtrado = !!base.filtro

  // Estrutura mais recente de cada pergunta (id) — percorre versões da mais nova para a mais antiga.
  const versoes = [...e.versoes].sort((a, b) => b.versao - a.versao)
  const porId = new Map<string, { p: PerguntaPesquisa; versao: number }>()
  const ordem: string[] = []
  for (const v of versoes) for (const p of v.perguntas) if (!porId.has(p.id)) { porId.set(p.id, { p, versao: v.versao }); ordem.push(p.id) }
  // Mantém a ordem da versão mais nova primeiro, depois perguntas que só existiam em versões antigas.
  const ordemFinal = versoes.length ? [...versoes[0].perguntas.map((p) => p.id), ...ordem.filter((id) => !versoes[0].perguntas.some((p) => p.id === id))] : []

  const estruturaPorVersao = new Map(e.versoes.map((v) => [v.versao, new Map(v.perguntas.map((p) => [p.id, p]))]))

  for (const id of ordemFinal) {
    const { p } = porId.get(id)!
    const assin = assinaturaPergunta(p)
    const incluidas: number[] = [], naoComp: number[] = []
    for (const v of e.versoes) {
      const q = estruturaPorVersao.get(v.versao)?.get(id)
      if (!q) continue
      ;(assinaturaPergunta(q) === assin ? incluidas : naoComp).push(v.versao)
    }
    const doEscopo = rs.filter((r) => incluidas.includes(r.versao))
    const valores = doEscopo.map((r) => r.itens[id])
    const resultado = agregarPergunta(p, valores)
    const pr: PerguntaResultado = { id, texto: p.texto, tipo: p.tipo, dimensao: p.dimensao, versoes: incluidas.sort((a, b) => a - b), versoesNaoComparaveis: naoComp.sort((a, b) => a - b), n: resultado.n, resultado }

    if (tipoTexto(p.tipo)) {
      // Texto livre: só no agregado geral, sem filtro, e ordem sem relação com o envio.
      if (e.incluirTextos && !filtrado && resultado.n >= e.minGrupo) {
        pr.textos = doEscopo
          .filter((r) => typeof r.itens[id] === 'string' && String(r.itens[id]).trim())
          .map((r) => ({ respostaId: r.id, texto: String(r.itens[id]), tags: r.tags?.[id] ?? [] }))
          .sort((a, b) => String(a.respostaId).localeCompare(String(b.respostaId)))
      } else pr.resultado = { tipo: 'texto', n: resultado.n }
    } else if (!filtrado) {
      pr.porSetor = segmentar(doEscopo, id, p, 'setorId', e.minGrupo, e.rotulosSetor)
      pr.porUnidade = segmentar(doEscopo, id, p, 'unidadeId', e.minGrupo, e.rotulosUnidade)
      if (pr.porSetor.length <= 1) delete pr.porSetor
      if (pr.porUnidade.length <= 1) delete pr.porUnidade
    }
    base.perguntas.push(pr)
  }

  // Evolução diária (apenas contagens por data)
  const porDia = new Map<string, number>()
  for (const r of rs) porDia.set(r.enviadaEm, (porDia.get(r.enviadaEm) ?? 0) + 1)
  let acc = 0
  base.evolucao = [...porDia.entries()].sort().map(([data, qtd]) => ({ data, qtd, acumulado: (acc += qtd) }))

  // Dimensões: média só de escalas Likert/estrelas (1–5); eNPS geral se houver pergunta eNPS
  const dims = new Map<string, { soma: number; n: number; perguntas: number }>()
  for (const pr of base.perguntas) {
    if (!pr.dimensao || pr.resultado?.tipo !== 'numerica' || pr.resultado.media === null) continue
    if (pr.tipo !== 'likert' && pr.tipo !== 'estrelas') continue
    const d = dims.get(pr.dimensao) ?? { soma: 0, n: 0, perguntas: 0 }
    d.soma += pr.resultado.media * pr.resultado.n; d.n += pr.resultado.n; d.perguntas++
    dims.set(pr.dimensao, d)
  }
  base.dimensoes = [...dims.entries()].map(([dimensao, d]) => ({ dimensao, media: arred(d.soma / d.n, 2), n: d.n, perguntas: d.perguntas })).sort((a, b) => b.media - a.media)
  const pe = base.perguntas.find((p) => p.tipo === 'enps' && p.resultado?.tipo === 'nps')
  base.enps = pe && pe.resultado?.tipo === 'nps' ? pe.resultado : null
  base.total = rs.length
  base.taxaResposta = taxaResposta(rs.length, filtrado ? 0 : e.elegiveis) ?? (filtrado ? null : base.taxaResposta)
  return base
}

function segmentar(rs: RespostaBruta[], id: string, p: PerguntaPesquisa, dim: DimensaoSegmento, min: number, rotulos?: Record<string, string>): SegmentoResultado[] {
  const chaves = new Map<string, RespostaBruta[]>()
  for (const r of rs) {
    const k = r.grupo[dim] ?? '—'
    if (!chaves.has(k)) chaves.set(k, [])
    chaves.get(k)!.push(r)
  }
  const respondeu = (r: RespostaBruta) => { const v = r.itens[id]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) }
  // A decisão de ocultar usa a contagem de quem RESPONDEU esta pergunta, com supressão complementar.
  const contagens = [...chaves.entries()].map(([chave, lista]) => ({ chave, n: lista.filter(respondeu).length }))
  const oculto = suprimirGrupos(contagens, min)
  return contagens
    .filter((c) => c.n > 0)
    .map((c) => {
      const suprimido = !!oculto.get(c.chave)
      return {
        chave: c.chave,
        rotulo: c.chave === '—' ? 'Sem informação' : rotulos?.[c.chave] ?? c.chave,
        n: suprimido ? 0 : c.n,
        suprimido,
        resultado: suprimido ? null : agregarPergunta(p, chaves.get(c.chave)!.map((r) => r.itens[id])),
      }
    })
    .sort((a, b) => Number(a.suprimido) - Number(b.suprimido) || b.n - a.n)
}

/* ---------------- resumo executivo (por regras, NÃO é IA) ---------------- */
export function resumoExecutivo(r: ResultadosPesquisa, titulo: string): string[] {
  if (r.filtroBloqueado) return [r.filtroBloqueado]
  if (r.suprimido) return [`Ainda não há respostas suficientes para exibir resultados (mínimo de ${r.minGrupo}, para proteger o anonimato). Respostas recebidas: ${r.total}.`]
  const linhas: string[] = []
  const taxa = r.taxaResposta === null ? 'sem público elegível definido' : `taxa de resposta de ${r.taxaResposta}% (${r.total} de ${r.elegiveis})`
  linhas.push(`"${titulo}": ${taxa}. A taxa mede participação, não satisfação.`)
  if (r.taxaResposta !== null && r.taxaResposta < 50) linhas.push('Participação abaixo de 50%: interprete os resultados com cautela, pois quem respondeu pode não representar todo o público.')
  if (r.enps && r.enps.enps !== null) {
    const faixa = r.enps.enps >= 50 ? 'zona de excelência' : r.enps.enps >= 10 ? 'zona de qualidade' : r.enps.enps >= 0 ? 'zona de aperfeiçoamento' : 'zona crítica'
    linhas.push(`eNPS de ${r.enps.enps} (${r.enps.pctPromotores}% promotores, ${r.enps.pctNeutros}% neutros, ${r.enps.pctDetratores}% detratores) — ${faixa} segundo a escala usual de referência.`)
  }
  if (r.dimensoes.length) {
    const alta = r.dimensoes[0], baixa = r.dimensoes[r.dimensoes.length - 1]
    linhas.push(`Maior média (escala de 1 a 5): ${alta.dimensao} (${alta.media}).`)
    if (r.dimensoes.length > 1) linhas.push(`Menor média: ${baixa.dimensao} (${baixa.media}). Vale aprofundar com a equipe.`)
  }
  const ocultos = r.perguntas.flatMap((p) => [...(p.porSetor ?? []), ...(p.porUnidade ?? [])]).filter((s) => s.suprimido).length
  if (ocultos) linhas.push('Alguns recortes por área/unidade estão ocultos por terem poucas respostas (proteção do anonimato).')
  return linhas
}

/* ---------------- CSV (mesmas proteções: só agregados visíveis) ---------------- */
const csvCelula = (v: unknown) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // evita injeção de fórmula em planilhas
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function resultadosParaCsv(r: ResultadosPesquisa): string {
  const linhas: string[][] = [['Pergunta', 'Tipo', 'Recorte', 'Respostas', 'Indicador', 'Valor']]
  const add = (p: PerguntaResultado, recorte: string, res: ResultadoPergunta | null) => {
    if (!res) return
    if (res.tipo === 'numerica') { linhas.push([p.texto, p.tipo, recorte, String(res.n), 'Média', String(res.media ?? '')]); res.distribuicao.forEach((d) => linhas.push([p.texto, p.tipo, recorte, String(res.n), `Nota ${d.valor}`, `${d.qtd} (${d.pct}%)`])) }
    else if (res.tipo === 'nps') { linhas.push([p.texto, p.tipo, recorte, String(res.n), 'eNPS', String(res.enps ?? '')]); linhas.push([p.texto, p.tipo, recorte, String(res.n), '% promotores', String(res.pctPromotores)]); linhas.push([p.texto, p.tipo, recorte, String(res.n), '% detratores', String(res.pctDetratores)]) }
    else if (res.tipo === 'opcoes') res.contagem.forEach((c) => linhas.push([p.texto, p.tipo, recorte, String(res.n), c.opcao, `${c.qtd} (${c.pct}%)`]))
    else if (res.tipo === 'ordenacao') res.posicaoMedia.forEach((c) => linhas.push([p.texto, p.tipo, recorte, String(res.n), c.opcao, `posição média ${c.media}`]))
  }
  if (r.suprimido) return 'Aviso\nResultados indisponíveis: poucas respostas para exibir com segurança.\n'
  for (const p of r.perguntas) {
    add(p, 'Geral', p.resultado)
    for (const s of p.porSetor ?? []) add(p, `Área: ${s.rotulo}`, s.resultado)
    for (const s of p.porUnidade ?? []) add(p, `Unidade: ${s.rotulo}`, s.resultado)
    for (const t of p.textos ?? []) linhas.push([p.texto, p.tipo, 'Geral', '1', 'Resposta aberta', t.texto])
  }
  return '﻿' + linhas.map((l) => l.map(csvCelula).join(';')).join('\n') + '\n'
}

/* ---------------- destaques por dimensão ----------------
   Critério (escala de 1 a 5, Likert/estrelas):
   - ponto forte: média ≥ 4,0 (a resposta típica é "concordo");
   - merece investigação: média < 3,5 (a resposta típica fica entre neutro e discordo).
   Só entram dimensões com ao menos `minRespostas` respostas. É um resultado OBSERVADO;
   a causa é hipótese a investigar com a equipe, nunca conclusão. */
export const LIMIAR_FORTE = 4
export const LIMIAR_ATENCAO = 3.5

export interface Destaques {
  fortes: ResultadosPesquisa['dimensoes']
  atencao: ResultadosPesquisa['dimensoes']
}

export function destaquesDimensoes(dims: ResultadosPesquisa['dimensoes'], minRespostas = 1, max = 3): Destaques {
  const validas = dims.filter((d) => d.n >= minRespostas)
  return {
    fortes: validas.filter((d) => d.media >= LIMIAR_FORTE).sort((a, b) => b.media - a.media).slice(0, max),
    atencao: validas.filter((d) => d.media < LIMIAR_ATENCAO).sort((a, b) => a.media - b.media).slice(0, max),
  }
}
