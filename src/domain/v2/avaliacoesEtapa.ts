/* ============================================================
   Recrutamento · questionários por etapa (fit cultural e DISC).
   Funções PURAS (sem React/DB) usadas pelo servidor e pelo cliente.

   Princípios:
   - Apoio à decisão: nenhum resultado aprova ou reprova ninguém.
     A decisão é sempre de uma pessoa.
   - Fit cultural: só perguntas com pontuação entram na nota; perguntas
     abertas não são pontuadas (o RH lê). Faixa de interpretação só
     existe quando o RH definiu critérios.
   - DISC: instrumento de escolha forçada GENÉRICO, configurado pelo RH.
     Não é um teste psicométrico validado. Um provedor validado pode
     ser plugado no futuro pela interface `ProvedorDisc`.
   ============================================================ */

export const AVISO_APOIO = 'Apoio à decisão — não substitui a análise humana.'
export const AVISO_DISC_INTERNO = 'Instrumento interno configurado pelo RH, sem validação psicométrica; use como referência complementar.'
export const AVISO_NAO_DISCRIMINACAO =
  'Pergunte apenas o que se relaciona com o trabalho. Não pergunte sobre idade, gênero, orientação sexual, raça/etnia, religião, saúde, deficiência, gravidez, estado civil, filhos ou família, origem, filiação política ou sindical.'

export const TIPOS_QUESTIONARIO = ['fit_cultural', 'disc'] as const
export type TipoQuestionario = (typeof TIPOS_QUESTIONARIO)[number]
export const ROTULO_TIPO_QUESTIONARIO: Record<TipoQuestionario, string> = { fit_cultural: 'Fit cultural', disc: 'Perfil comportamental (DISC)' }

export const TIPOS_PERGUNTA_FIT = ['aberta', 'escolha', 'escala'] as const
export type TipoPerguntaFit = (typeof TIPOS_PERGUNTA_FIT)[number]
export const ROTULO_TIPO_PERGUNTA: Record<TipoPerguntaFit, string> = { aberta: 'Resposta aberta', escolha: 'Múltipla escolha', escala: 'Escala de 1 a 5' }

export const DIMENSOES = ['D', 'I', 'S', 'C'] as const
export type Dimensao = (typeof DIMENSOES)[number]
export const ROTULO_DIMENSAO: Record<Dimensao, string> = { D: 'Dominância', I: 'Influência', S: 'Estabilidade', C: 'Conformidade' }

export const LIMITES = { perguntas: 40, alternativas: 8, itensDisc: 30, competencias: 12, faixas: 6, textoPergunta: 500, textoResposta: 3000 }

export interface Alternativa { id: string; texto: string; pontos?: number | null }
export interface PerguntaFit {
  id: string
  tipo: TipoPerguntaFit
  texto: string
  obrigatoria: boolean
  alternativas?: Alternativa[]
  /** Nome de uma das competências do questionário (ou vazio = só entra na nota geral). */
  competencia?: string | null
  /** Peso relativo (1 a 5). */
  peso?: number
  /** Justificativa / critério de avaliação (interno, nunca vai ao candidato). */
  criterio?: string | null
}
export interface Afirmacao { id: string; texto: string; dimensao: Dimensao }
export interface ItemDisc { id: string; afirmacoes: Afirmacao[] }
export interface PerfilDisc { D: number; I: number; S: number; C: number; justificativa?: string }
export interface Instrumento { origem: 'interno' | 'externo'; nome: string; versao: string }
/** Critério de interpretação da nota geral: vale a faixa com o maior `min` ≤ nota. */
export interface FaixaInterpretacao { min: number; rotulo: string; descricao?: string }

export type RespostaFit = string | number
export type RespostasFit = Record<string, RespostaFit>
export interface EscolhaDisc { mais: string; menos: string }
export type RespostasDisc = Record<string, EscolhaDisc>

/* ---------- adaptador para provedor externo (não implementado) ---------- */
/**
 * Contrato para integrar um instrumento DISC validado de terceiros. Nenhum provedor é implementado aqui:
 * o sistema usa o instrumento interno (`origem: 'interno'`) até que uma integração real exista.
 */
export interface ProvedorDisc {
  readonly id: string
  readonly nome: string
  /** Instrumento e itens a apresentar (o provedor pode não expor os itens; nesse caso o candidato responde no ambiente dele). */
  instrumento(): Promise<{ instrumento: Instrumento & { origem: 'externo' }; itens?: ItemDisc[]; urlExterna?: string }>
  /** Pontuação oficial do provedor, já normalizada em 0–100 por dimensão. */
  pontuar(respostas: RespostasDisc): Promise<{ pontuacao: PontuacaoDisc; laudoUrl?: string }>
}

/* ---------- utilidades ---------- */
const arred = (n: number) => Math.round(n)
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const limitar0a100 = (n: number) => Math.max(0, Math.min(100, n))

/* ---------- validação da configuração (servidor) ---------- */
export type Erros = Record<string, string>

export function validarPerguntasFit(perguntas: PerguntaFit[], competencias: string[]): Erros {
  const e: Erros = {}
  if (!perguntas.length) e.perguntas = 'Inclua ao menos uma pergunta.'
  if (perguntas.length > LIMITES.perguntas) e.perguntas = `Máximo de ${LIMITES.perguntas} perguntas.`
  const ids = new Set<string>()
  perguntas.forEach((p, i) => {
    const k = `pergunta_${i + 1}`
    if (!p.id || ids.has(p.id)) e[k] = 'Identificador repetido.'
    ids.add(p.id)
    if (!TIPOS_PERGUNTA_FIT.includes(p.tipo)) e[k] = 'Tipo inválido.'
    if (!p.texto?.trim()) e[k] = 'Escreva a pergunta.'
    else if (p.texto.length > LIMITES.textoPergunta) e[k] = `Máximo de ${LIMITES.textoPergunta} caracteres.`
    if (p.peso !== undefined && (!ehNumero(p.peso) || p.peso < 1 || p.peso > 5)) e[k] = 'Peso entre 1 e 5.'
    if (p.competencia && !competencias.includes(p.competencia)) e[k] = 'Competência não cadastrada no questionário.'
    if (p.tipo === 'escolha') {
      const alts = p.alternativas ?? []
      if (alts.length < 2) e[k] = 'Inclua ao menos duas alternativas.'
      if (alts.length > LIMITES.alternativas) e[k] = `Máximo de ${LIMITES.alternativas} alternativas.`
      const aIds = new Set<string>()
      for (const a of alts) {
        if (!a.id || aIds.has(a.id) || !a.texto?.trim()) e[k] = 'Alternativas precisam de texto.'
        aIds.add(a.id)
        if (a.pontos !== undefined && a.pontos !== null && (!ehNumero(a.pontos) || a.pontos < 0 || a.pontos > 100)) e[k] = 'Pontos entre 0 e 100.'
      }
    }
  })
  return e
}

export function validarItensDisc(itens: ItemDisc[]): Erros {
  const e: Erros = {}
  if (itens.length < 2) e.itens = 'Inclua ao menos dois blocos de afirmações.'
  if (itens.length > LIMITES.itensDisc) e.itens = `Máximo de ${LIMITES.itensDisc} blocos.`
  const ids = new Set<string>()
  itens.forEach((it, i) => {
    const k = `item_${i + 1}`
    if (!it.id || ids.has(it.id)) e[k] = 'Identificador repetido.'
    ids.add(it.id)
    if (it.afirmacoes.length !== 4) { e[k] = 'Cada bloco tem exatamente 4 afirmações.'; return }
    const dims = new Set(it.afirmacoes.map((a) => a.dimensao))
    if (dims.size !== 4 || !DIMENSOES.every((d) => dims.has(d))) e[k] = 'Cada bloco precisa de uma afirmação para cada dimensão (D, I, S, C).'
    if (it.afirmacoes.some((a) => !a.texto?.trim())) e[k] = 'Preencha o texto das 4 afirmações.'
    if (new Set(it.afirmacoes.map((a) => a.id)).size !== 4) e[k] = 'Identificadores das afirmações repetidos.'
  })
  return e
}

export function validarPerfil(p: PerfilDisc): Erros {
  const e: Erros = {}
  for (const d of DIMENSOES) if (!ehNumero(p[d]) || p[d] < 0 || p[d] > 100) e[`perfil_${d}`] = 'Entre 0 e 100.'
  return e
}

/* ---------- validação das respostas (servidor e cliente) ---------- */
export function validarRespostasFit(perguntas: PerguntaFit[], respostas: RespostasFit): { erros: Erros; limpas: RespostasFit } {
  const erros: Erros = {}
  const limpas: RespostasFit = {}
  for (const p of perguntas) {
    const v = respostas?.[p.id]
    const vazio = v === undefined || v === null || (typeof v === 'string' && !v.trim())
    if (vazio) { if (p.obrigatoria) erros[p.id] = 'Resposta obrigatória.'; continue }
    if (p.tipo === 'aberta') {
      if (typeof v !== 'string') { erros[p.id] = 'Resposta inválida.'; continue }
      if (v.length > LIMITES.textoResposta) { erros[p.id] = `Máximo de ${LIMITES.textoResposta} caracteres.`; continue }
      limpas[p.id] = v.trim()
    } else if (p.tipo === 'escolha') {
      if (typeof v !== 'string' || !(p.alternativas ?? []).some((a) => a.id === v)) { erros[p.id] = 'Escolha uma das alternativas.'; continue }
      limpas[p.id] = v
    } else {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 1 || n > 5) { erros[p.id] = 'Escolha um valor de 1 a 5.'; continue }
      limpas[p.id] = n
    }
  }
  return { erros, limpas }
}

export function validarRespostasDisc(itens: ItemDisc[], respostas: RespostasDisc): { erros: Erros; limpas: RespostasDisc } {
  const erros: Erros = {}
  const limpas: RespostasDisc = {}
  for (const it of itens) {
    const r = respostas?.[it.id]
    const ids = new Set(it.afirmacoes.map((a) => a.id))
    if (!r || typeof r.mais !== 'string' || typeof r.menos !== 'string' || !r.mais || !r.menos) { erros[it.id] = 'Marque a que mais e a que menos parece com você.'; continue }
    if (!ids.has(r.mais) || !ids.has(r.menos)) { erros[it.id] = 'Escolha inválida.'; continue }
    if (r.mais === r.menos) { erros[it.id] = 'A mesma afirmação não pode ser "mais" e "menos".'; continue }
    limpas[it.id] = { mais: r.mais, menos: r.menos }
  }
  return { erros, limpas }
}

/* ---------- pontuação · fit cultural ---------- */
export interface NotaCompetencia { competencia: string; nota: number; perguntas: number }
export interface ResultadoFit {
  /** Nota geral 0–100 das perguntas pontuadas respondidas (null se nenhuma). */
  geral: number | null
  competencias: NotaCompetencia[]
  /** Perguntas pontuadas respondidas / não pontuadas (abertas ou sem pontos). */
  pontuadas: number
  naoPontuadas: number
  faixa: FaixaInterpretacao | null
}

/** Fração 0–1 obtida na pergunta, ou null quando a pergunta não é pontuada / não foi respondida. */
export function fracaoPergunta(p: PerguntaFit, v: RespostaFit | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  if (p.tipo === 'aberta') return null
  if (p.tipo === 'escala') {
    const n = Number(v)
    return Number.isFinite(n) ? limitar0a100((n - 1) / 4 * 100) / 100 : null
  }
  const alts = p.alternativas ?? []
  if (!alts.some((a) => ehNumero(a.pontos))) return null
  const pts = alts.map((a) => (ehNumero(a.pontos) ? a.pontos : 0))
  const min = Math.min(...pts), max = Math.max(...pts)
  if (max === min) return null
  const esc = alts.find((a) => a.id === v)
  if (!esc) return null
  const pe = ehNumero(esc.pontos) ? esc.pontos : 0
  return (pe - min) / (max - min)
}

export const perguntaPontuada = (p: PerguntaFit) =>
  p.tipo === 'escala' || (p.tipo === 'escolha' && (p.alternativas ?? []).some((a) => ehNumero(a.pontos)) &&
    new Set((p.alternativas ?? []).map((a) => (ehNumero(a.pontos) ? a.pontos : 0))).size > 1)

export function faixaDe(nota: number | null, faixas: FaixaInterpretacao[] | undefined): FaixaInterpretacao | null {
  if (nota === null || !faixas?.length) return null
  const ord = [...faixas].filter((f) => ehNumero(f.min) && f.rotulo?.trim()).sort((a, b) => b.min - a.min)
  return ord.find((f) => nota >= f.min) ?? null
}

/** Média ponderada normalizada (0–100) por competência e geral. */
export function pontuarFit(perguntas: PerguntaFit[], respostas: RespostasFit, faixas?: FaixaInterpretacao[]): ResultadoFit {
  const por = new Map<string, { soma: number; pesos: number; n: number }>()
  let soma = 0, pesos = 0, pontuadas = 0, naoPontuadas = 0
  for (const p of perguntas) {
    const f = fracaoPergunta(p, respostas[p.id])
    if (f === null) { if (!perguntaPontuada(p)) naoPontuadas++; continue }
    const w = ehNumero(p.peso) && p.peso > 0 ? p.peso : 1
    pontuadas++
    soma += w * f; pesos += w
    if (p.competencia) {
      const x = por.get(p.competencia) ?? { soma: 0, pesos: 0, n: 0 }
      x.soma += w * f; x.pesos += w; x.n++
      por.set(p.competencia, x)
    }
  }
  const geral = pesos ? arred((soma / pesos) * 100) : null
  return {
    geral,
    competencias: [...por.entries()].map(([competencia, x]) => ({ competencia, nota: arred((x.soma / x.pesos) * 100), perguntas: x.n })),
    pontuadas, naoPontuadas,
    faixa: faixaDe(geral, faixas),
  }
}

/* ---------- pontuação · DISC (escolha forçada) ---------- */
export type PontuacaoDisc = Record<Dimensao, number>
export interface ResultadoDisc { pontuacao: PontuacaoDisc; bruto: Record<Dimensao, { mais: number; menos: number }>; itens: number }

/** Por dimensão: (mais − menos), normalizado de [−n, +n] para 0–100, sendo n o número de blocos respondidos. */
export function pontuarDisc(itens: ItemDisc[], respostas: RespostasDisc): ResultadoDisc {
  const bruto = { D: { mais: 0, menos: 0 }, I: { mais: 0, menos: 0 }, S: { mais: 0, menos: 0 }, C: { mais: 0, menos: 0 } } as Record<Dimensao, { mais: number; menos: number }>
  let n = 0
  for (const it of itens) {
    const r = respostas[it.id]
    if (!r) continue
    const mais = it.afirmacoes.find((a) => a.id === r.mais)
    const menos = it.afirmacoes.find((a) => a.id === r.menos)
    if (!mais || !menos || mais.id === menos.id) continue
    n++
    bruto[mais.dimensao].mais++
    bruto[menos.dimensao].menos++
  }
  const pontuacao = {} as PontuacaoDisc
  for (const d of DIMENSOES) pontuacao[d] = n ? arred(((bruto[d].mais - bruto[d].menos + n) / (2 * n)) * 100) : 0
  return { pontuacao, bruto, itens: n }
}

export type FaixaCompat = 'alta' | 'moderada' | 'baixa'
export const ROTULO_COMPAT: Record<FaixaCompat, string> = { alta: 'Compatibilidade alta', moderada: 'Compatibilidade moderada', baixa: 'Compatibilidade baixa' }
export interface Compatibilidade {
  indice: number
  faixa: FaixaCompat
  diferencas: { dimensao: Dimensao; candidato: number; recomendado: number; diferenca: number }[]
  justificativa: string[]
}

export const faixaCompat = (indice: number): FaixaCompat => (indice >= 75 ? 'alta' : indice >= 50 ? 'moderada' : 'baixa')

/** 100 − média das diferenças absolutas entre o perfil do candidato e o recomendado. Nunca decide sozinho. */
export function compatibilidadeDisc(p: PontuacaoDisc, rec: PerfilDisc): Compatibilidade {
  const diferencas = DIMENSOES.map((d) => ({ dimensao: d, candidato: p[d], recomendado: rec[d], diferenca: p[d] - rec[d] }))
  const media = diferencas.reduce((s, x) => s + Math.abs(x.diferenca), 0) / DIMENSOES.length
  const indice = arred(limitar0a100(100 - media))
  const justificativa = diferencas.map((x) => {
    const abs = Math.abs(x.diferenca)
    const sentido = abs === 0 ? 'igual ao recomendado' : x.diferenca > 0 ? `${abs} pontos acima do recomendado` : `${abs} pontos abaixo do recomendado`
    return `${ROTULO_DIMENSAO[x.dimensao]} (${x.dimensao}): ${x.candidato} × ${x.recomendado} recomendado — ${sentido}.`
  })
  return { indice, faixa: faixaCompat(indice), diferencas, justificativa }
}

/* ---------- versão pública (o que o candidato pode ver) ---------- */
export interface PerguntaPublica { id: string; tipo: TipoPerguntaFit; texto: string; obrigatoria: boolean; alternativas?: { id: string; texto: string }[] }
export interface ItemPublico { id: string; afirmacoes: { id: string; texto: string }[] }

/** Remove pontos, pesos, competências, critérios e a dimensão de cada afirmação. */
export const perguntasPublicas = (ps: PerguntaFit[]): PerguntaPublica[] =>
  ps.map((p) => ({
    id: p.id, tipo: p.tipo, texto: p.texto, obrigatoria: !!p.obrigatoria,
    ...(p.tipo === 'escolha' ? { alternativas: (p.alternativas ?? []).map((a) => ({ id: a.id, texto: a.texto })) } : {}),
  }))
export const itensPublicos = (its: ItemDisc[]): ItemPublico[] => its.map((i) => ({ id: i.id, afirmacoes: i.afirmacoes.map((a) => ({ id: a.id, texto: a.texto })) }))
