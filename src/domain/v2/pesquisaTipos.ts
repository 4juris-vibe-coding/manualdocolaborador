/* ============================================================
   Central de pesquisas · tipos de pergunta, validação, lógica
   condicional e público elegível. Regras PURAS: a mesma função
   valida no cliente (UX) e no servidor (autoridade).
   ============================================================ */

export type TipoPergunta =
  | 'unica' | 'multipla' | 'escala' | 'likert' | 'nps' | 'enps'
  | 'texto_curto' | 'texto_longo' | 'sim_nao' | 'estrelas' | 'ordenacao' | 'data'

export const TIPOS: { tipo: TipoPergunta; rotulo: string; desc: string }[] = [
  { tipo: 'unica', rotulo: 'Escolha única', desc: 'Uma opção entre várias.' },
  { tipo: 'multipla', rotulo: 'Múltipla escolha', desc: 'Uma ou mais opções.' },
  { tipo: 'escala', rotulo: 'Escala numérica', desc: 'Nota em uma faixa que você define.' },
  { tipo: 'likert', rotulo: 'Escala Likert', desc: 'Concordância de 1 (discordo totalmente) a 5 (concordo totalmente).' },
  { tipo: 'nps', rotulo: 'NPS (0 a 10)', desc: 'Probabilidade de recomendar, de 0 a 10.' },
  { tipo: 'enps', rotulo: 'eNPS (0 a 10)', desc: 'Probabilidade de recomendar a empresa como lugar para trabalhar.' },
  { tipo: 'texto_curto', rotulo: 'Texto curto', desc: 'Resposta de uma linha.' },
  { tipo: 'texto_longo', rotulo: 'Texto longo', desc: 'Resposta aberta, em parágrafos.' },
  { tipo: 'sim_nao', rotulo: 'Sim ou não', desc: 'Resposta binária.' },
  { tipo: 'estrelas', rotulo: 'Estrelas (1 a 5)', desc: 'Avaliação por estrelas.' },
  { tipo: 'ordenacao', rotulo: 'Ordenação', desc: 'Ordenar alternativas por prioridade.' },
  { tipo: 'data', rotulo: 'Data', desc: 'Uma data.' },
]
export const ROTULO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t.rotulo])) as Record<TipoPergunta, string>

export const ROTULOS_LIKERT = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente']

export type Operador = 'igual' | 'diferente' | 'maior_igual' | 'menor_igual' | 'contem' | 'respondida'
export interface Condicao { perguntaId: string; operador: Operador; valor?: string | number }

export interface PerguntaPesquisa {
  id: string
  tipo: TipoPergunta
  texto: string
  descricao?: string
  obrigatoria: boolean
  opcoes?: string[]
  escala?: { min: number; max: number; rotuloMin?: string; rotuloMax?: string }
  /** Agrupa perguntas na análise (ex.: "Liderança", "Reconhecimento"). */
  dimensao?: string
  /** Seção na tela de resposta: perguntas seguidas com a mesma seção aparecem juntas numa página. */
  secao?: string
  /** Só aparece se a condição for verdadeira (sempre sobre uma pergunta ANTERIOR). */
  condicao?: Condicao
}

export type Valor = string | number | string[] | null | undefined
export type Respostas = Record<string, Valor>

export const tipoTemOpcoes = (t: TipoPergunta) => t === 'unica' || t === 'multipla' || t === 'ordenacao'
export const tipoNumerico = (t: TipoPergunta) => t === 'escala' || t === 'likert' || t === 'nps' || t === 'enps' || t === 'estrelas'
export const tipoTexto = (t: TipoPergunta) => t === 'texto_curto' || t === 'texto_longo'

/** Faixa de valores válidos para tipos numéricos. */
export function faixaNumerica(p: Pick<PerguntaPesquisa, 'tipo' | 'escala'>): { min: number; max: number } | null {
  switch (p.tipo) {
    case 'likert': case 'estrelas': return { min: 1, max: 5 }
    case 'nps': case 'enps': return { min: 0, max: 10 }
    case 'escala': return { min: p.escala?.min ?? 1, max: p.escala?.max ?? 10 }
    default: return null
  }
}

const LIMITE_TEXTO: Record<string, number> = { texto_curto: 200, texto_longo: 4000 }

/** Valida a CONFIGURAÇÃO de uma pergunta (usada ao editar e ao publicar). */
export function validarPergunta(p: PerguntaPesquisa): string | null {
  if (!p.id || !/^[A-Za-z0-9_-]{1,40}$/.test(p.id)) return 'Identificador de pergunta inválido.'
  if (!p.texto || !p.texto.trim()) return 'Toda pergunta precisa de um enunciado.'
  if (p.texto.length > 500) return 'Enunciado muito longo (máx. 500 caracteres).'
  if (!TIPOS.some((t) => t.tipo === p.tipo)) return `Tipo de pergunta inválido: ${p.tipo}.`
  if (tipoTemOpcoes(p.tipo)) {
    const ops = (p.opcoes ?? []).map((o) => o.trim())
    if (ops.length < 2) return `"${p.texto.slice(0, 40)}": informe ao menos 2 alternativas.`
    if (ops.some((o) => !o)) return `"${p.texto.slice(0, 40)}": há alternativa em branco.`
    if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) return `"${p.texto.slice(0, 40)}": há alternativas repetidas.`
    if (ops.length > 20) return 'No máximo 20 alternativas.'
  }
  if (p.tipo === 'escala') {
    const e = p.escala
    if (!e || !Number.isInteger(e.min) || !Number.isInteger(e.max)) return `"${p.texto.slice(0, 40)}": defina o início e o fim da escala.`
    if (e.max <= e.min) return `"${p.texto.slice(0, 40)}": o fim da escala deve ser maior que o início.`
    if (e.max - e.min > 20) return 'A escala pode ter no máximo 21 pontos.'
  }
  return null
}

/** Valida a estrutura inteira: ids únicos, condições apontando para perguntas anteriores. */
export function validarEstrutura(perguntas: PerguntaPesquisa[]): string | null {
  if (!perguntas.length) return 'Adicione ao menos uma pergunta.'
  if (perguntas.length > 100) return 'No máximo 100 perguntas por pesquisa.'
  const vistos = new Set<string>()
  for (const p of perguntas) {
    const e = validarPergunta(p)
    if (e) return e
    if (vistos.has(p.id)) return 'Há perguntas com o mesmo identificador.'
    if (p.condicao) {
      const c = p.condicao
      if (!vistos.has(c.perguntaId)) return `"${p.texto.slice(0, 40)}": a condição deve depender de uma pergunta anterior.`
      if (c.operador !== 'respondida' && (c.valor === undefined || c.valor === '')) return `"${p.texto.slice(0, 40)}": informe o valor da condição.`
    }
    vistos.add(p.id)
  }
  return null
}

/** Avalia a condição de exibição de uma pergunta. */
export function condicaoVerdadeira(c: Condicao | undefined, respostas: Respostas): boolean {
  if (!c) return true
  const v = respostas[c.perguntaId]
  const vazio = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
  if (c.operador === 'respondida') return !vazio
  if (vazio) return false
  switch (c.operador) {
    case 'igual': return Array.isArray(v) ? v.includes(String(c.valor)) : String(v) === String(c.valor)
    case 'diferente': return Array.isArray(v) ? !v.includes(String(c.valor)) : String(v) !== String(c.valor)
    case 'maior_igual': return Number(v) >= Number(c.valor)
    case 'menor_igual': return Number(v) <= Number(c.valor)
    case 'contem': return Array.isArray(v) ? v.some((x) => x.toLowerCase().includes(String(c.valor).toLowerCase())) : String(v).toLowerCase().includes(String(c.valor).toLowerCase())
  }
}

/** Perguntas visíveis, na ordem, dadas as respostas (uma pergunta oculta por pai oculto também fica oculta). */
export function perguntasVisiveis(perguntas: PerguntaPesquisa[], respostas: Respostas): PerguntaPesquisa[] {
  const visiveis = new Set<string>()
  const out: PerguntaPesquisa[] = []
  for (const p of perguntas) {
    const paiOk = !p.condicao || visiveis.has(p.condicao.perguntaId)
    if (paiOk && condicaoVerdadeira(p.condicao, respostas)) { visiveis.add(p.id); out.push(p) }
  }
  return out
}

/** Valida UM valor de resposta. Devolve a mensagem de erro ou null. Não trata obrigatoriedade. */
export function validarValor(p: PerguntaPesquisa, v: Valor): string | null {
  const faixa = faixaNumerica(p)
  if (faixa) {
    const n = Number(v)
    if (typeof v === 'boolean' || v === '' || !Number.isInteger(n) || n < faixa.min || n > faixa.max) return `Escolha um valor de ${faixa.min} a ${faixa.max}.`
    return null
  }
  switch (p.tipo) {
    case 'unica': return typeof v === 'string' && (p.opcoes ?? []).includes(v) ? null : 'Escolha uma das alternativas.'
    case 'multipla':
      if (!Array.isArray(v) || !v.length) return 'Escolha ao menos uma alternativa.'
      if (new Set(v).size !== v.length || v.some((x) => !(p.opcoes ?? []).includes(x))) return 'Alternativa inválida.'
      return null
    case 'ordenacao': {
      const ops = p.opcoes ?? []
      if (!Array.isArray(v) || v.length !== ops.length || new Set(v).size !== ops.length || v.some((x) => !ops.includes(x))) return 'Ordene todas as alternativas.'
      return null
    }
    case 'sim_nao': return v === 'sim' || v === 'nao' ? null : 'Responda sim ou não.'
    case 'data': return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : 'Informe uma data válida.'
    case 'texto_curto': case 'texto_longo':
      if (typeof v !== 'string') return 'Resposta inválida.'
      if (v.length > LIMITE_TEXTO[p.tipo]) return `Máximo de ${LIMITE_TEXTO[p.tipo]} caracteres.`
      return null
    default: return 'Tipo desconhecido.'
  }
}

const vazioValor = (v: Valor) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0)

export interface ValidacaoRespostas { erros: Record<string, string>; limpas: Respostas }

/**
 * Valida o conjunto de respostas: só perguntas VISÍVEIS contam; obrigatórias precisam de resposta;
 * respostas a perguntas ocultas são descartadas (não ficam gravadas).
 */
export function validarRespostas(perguntas: PerguntaPesquisa[], respostas: Respostas): ValidacaoRespostas {
  const erros: Record<string, string> = {}
  const limpas: Respostas = {}
  for (const p of perguntasVisiveis(perguntas, respostas)) {
    const v = respostas[p.id]
    if (vazioValor(v)) { if (p.obrigatoria) erros[p.id] = 'Resposta obrigatória.'; continue }
    const e = validarValor(p, tipoTexto(p.tipo) ? String(v).trim() : v)
    if (e) erros[p.id] = e
    else limpas[p.id] = tipoTexto(p.tipo) ? String(v).trim() : v
  }
  return { erros, limpas }
}

/** Assinatura para comparar perguntas entre versões/pesquisas: só é comparável se o enunciado, o tipo e a escala/opções forem os mesmos. */
export function assinaturaPergunta(p: PerguntaPesquisa): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const f = faixaNumerica(p)
  return [p.tipo, norm(p.texto), f ? `${f.min}-${f.max}` : '', tipoTemOpcoes(p.tipo) ? [...(p.opcoes ?? [])].map(norm).sort().join('|') : ''].join('§')
}

/** ~12 s por pergunta de escolha, 45 s por texto livre; arredonda para cima. */
export function tempoEstimadoMin(perguntas: PerguntaPesquisa[]): number {
  const s = perguntas.reduce((a, p) => a + (p.tipo === 'texto_longo' ? 60 : p.tipo === 'texto_curto' ? 30 : 12), 0)
  return Math.max(1, Math.ceil(s / 60))
}

/* ---------------- público elegível ---------------- */

export interface CriteriosPublico {
  /** true = todas as pessoas ativas. */
  todos?: boolean
  unidadeIds?: string[]
  setorIds?: string[]
  /** Equipe de um gestor imediato (Colaborador.responsavelId). */
  gestorIds?: string[]
  cargoIds?: string[]
  /** Pessoas escolhidas individualmente (somam ao grupo). */
  pessoaIds?: string[]
  /** Pessoas excluídas. */
  excluirIds?: string[]
}

export interface PessoaElegivel { id: string; status?: string; setorId?: string; unidadeId?: string; cargoId?: string; responsavelId?: string }

/**
 * Regra: pessoas com parceria encerrada nunca entram. Dentro de cada tipo de critério vale "ou";
 * entre tipos diferentes vale "e" (ex.: área Jurídico E cargo Advogado). `pessoaIds` soma pessoas avulsas;
 * `excluirIds` sempre tira. Sem nenhum critério e sem `todos`, ninguém é elegível.
 */
export function resolverPublico(c: CriteriosPublico, pessoas: PessoaElegivel[]): string[] {
  const ativas = pessoas.filter((p) => p.status !== 'encerrado')
  const filtros: ((p: PessoaElegivel) => boolean)[] = []
  if (c.unidadeIds?.length) filtros.push((p) => !!p.unidadeId && c.unidadeIds!.includes(p.unidadeId))
  if (c.setorIds?.length) filtros.push((p) => !!p.setorId && c.setorIds!.includes(p.setorId))
  if (c.gestorIds?.length) filtros.push((p) => !!p.responsavelId && c.gestorIds!.includes(p.responsavelId))
  if (c.cargoIds?.length) filtros.push((p) => !!p.cargoId && c.cargoIds!.includes(p.cargoId))
  const ids = new Set<string>()
  if (c.todos) ativas.forEach((p) => ids.add(p.id))
  else if (filtros.length) ativas.filter((p) => filtros.every((f) => f(p))).forEach((p) => ids.add(p.id))
  for (const id of c.pessoaIds ?? []) if (ativas.some((p) => p.id === id)) ids.add(id)
  for (const id of c.excluirIds ?? []) ids.delete(id)
  return [...ids]
}

export const STATUS_PESQUISA: Record<string, { rotulo: string; tom: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold' }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutral' },
  agendada: { rotulo: 'Agendada', tom: 'brand' },
  aberta: { rotulo: 'Em andamento', tom: 'success' },
  pausada: { rotulo: 'Pausada', tom: 'warning' },
  encerrada: { rotulo: 'Encerrada', tom: 'neutral' },
}

export const MODO_ROTULO = { anonima: 'Anônima', identificada: 'Identificada' } as const

/** Texto de confidencialidade exibido ao respondente — honesto quanto ao que o sistema guarda. */
export function textoConfidencialidade(modo: 'anonima' | 'identificada', via: 'convite' | 'link', minGrupo: number, finalidade?: string | null, quemAcessa?: string | null): string {
  if (modo === 'identificada') {
    return `Esta pesquisa é IDENTIFICADA: suas respostas ficam associadas ao seu nome. ${quemAcessa ? `Quem poderá ver: ${quemAcessa}. ` : ''}${finalidade ? `Finalidade: ${finalidade}.` : ''}`.trim()
  }
  const base = `Esta pesquisa é anônima: o sistema não grava seu nome junto das respostas. Guardamos apenas a data, sua área e sua unidade para análises agrupadas, e só mostramos grupos com ao menos ${minGrupo} respostas.`
  return via === 'link'
    ? 'Esta pesquisa usa um link público: qualquer pessoa com o link pode responder e nenhuma identidade é registrada. Para limitar repetições, usamos uma marca do seu navegador (sem ligação com as respostas).'
    : base
}

/** Páginas da tela de resposta: perguntas consecutivas com a mesma seção formam uma página;
 *  pergunta sem seção ocupa uma página sozinha (comportamento original). */
export function paginasDeResposta(visiveis: PerguntaPesquisa[]): { secao?: string; perguntas: PerguntaPesquisa[] }[] {
  const paginas: { secao?: string; perguntas: PerguntaPesquisa[] }[] = []
  for (const p of visiveis) {
    const s = p.secao?.trim()
    const ultima = paginas[paginas.length - 1]
    if (s && ultima?.secao === s) ultima.perguntas.push(p)
    else paginas.push({ secao: s || undefined, perguntas: [p] })
  }
  return paginas
}
