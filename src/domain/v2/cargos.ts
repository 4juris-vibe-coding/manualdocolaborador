/* Regras puras da arquitetura de cargos (sem React/DB; só imports relativos). */

export const TRILHAS_INICIAIS = [
  { nome: 'Operacional', descricao: 'Execução de rotinas e suporte.', niveis: ['Assistente', 'Auxiliar', 'Analista I'] },
  { nome: 'Técnica', descricao: 'Aprofundamento técnico sem gestão de pessoas.', niveis: ['Júnior', 'Pleno', 'Sênior'] },
  { nome: 'Especialista', descricao: 'Referência técnica reconhecida.', niveis: ['Especialista', 'Especialista sênior', 'Principal'] },
  { nome: 'Liderança', descricao: 'Gestão de equipes e áreas.', niveis: ['Coordenação', 'Gerência', 'Diretoria de área'] },
  { nome: 'Gestão executiva', descricao: 'Decisão estratégica.', niveis: ['Diretoria', 'Vice-presidência', 'Presidência'] },
] as const

export const STATUS_FICHA = ['rascunho', 'em_aprovacao', 'vigente', 'inativo'] as const
export type StatusFicha = (typeof STATUS_FICHA)[number]

export const CAMPOS_FICHA = [
  'codigo', 'familiaId', 'subfamiliaId', 'area', 'trilhaId', 'nivelId', 'cargoReferenciaId', 'descricaoOficial', 'objetivo',
  'responsabilidades', 'entregas', 'requisitosMinimos', 'formacao', 'experiencia', 'competenciasTecnicas',
  'competenciasComportamentais', 'conhecimentos', 'certificacoes', 'kpis', 'vigenciaInicio', 'aprovadores',
] as const

/** Minúsculas, sem acento nem pontuação, espaços normalizados. */
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const SUFIXOS_NIVEL = new Set(['i', 'ii', 'iii', 'iv', 'jr', 'junior', 'pleno', 'pl', 'sr', 'senior', 'especialista'])

/** Remove termos de nível para comparar o "núcleo" do nome (Advogado Pleno ≈ Advogado Sênior é mesmo núcleo, não duplicata exata). */
export const nucleoNome = (s: string) => normalizar(s).split(' ').filter((p) => !SUFIXOS_NIVEL.has(p)).join(' ')

export interface ItemDup { id: string; nome: string; codigo?: string | null }
export interface Duplicidade { a: string; b: string; motivo: 'nome_igual' | 'codigo_igual' | 'nome_parecido' }

/** Duplicidades por nome normalizado idêntico, código igual ou nome com distância de edição ≤ 1 (nomes ≥ 8 letras). */
export function detectarDuplicidades(itens: ItemDup[]): Duplicidade[] {
  const out: Duplicidade[] = []
  for (let i = 0; i < itens.length; i++) {
    for (let j = i + 1; j < itens.length; j++) {
      const x = itens[i], y = itens[j]
      const nx = normalizar(x.nome), ny = normalizar(y.nome)
      if (x.codigo && y.codigo && x.codigo.trim().toUpperCase() === y.codigo.trim().toUpperCase()) out.push({ a: x.id, b: y.id, motivo: 'codigo_igual' })
      else if (nx === ny) out.push({ a: x.id, b: y.id, motivo: 'nome_igual' })
      else if (nx.length >= 8 && ny.length >= 8 && distancia(nx, ny) <= 1) out.push({ a: x.id, b: y.id, motivo: 'nome_parecido' })
    }
  }
  return out
}

function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  const m = a.length, n = b.length
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[n]
}

/* ---------- vigência de faixas ---------- */
export interface Vigencia { inicio: string; fim?: string | null }

/** Intervalos [inicio, fim] (fim vazio = aberto) se sobrepõem? Datas AAAA-MM-DD. */
export function vigenciasSobrepoem(a: Vigencia, b: Vigencia): boolean {
  const fimA = a.fim || '9999-12-31', fimB = b.fim || '9999-12-31'
  return a.inicio <= fimB && b.inicio <= fimA
}

export interface ValoresFaixa { minimo: number; referencia?: number | null; maximo: number }
export function validarFaixa(f: ValoresFaixa, v: Vigencia): string | null {
  if (![f.minimo, f.maximo].every((n) => Number.isFinite(n) && n >= 0)) return 'Informe mínimo e máximo válidos.'
  if (f.minimo > f.maximo) return 'O mínimo não pode ser maior que o máximo.'
  if (f.referencia != null && (f.referencia < f.minimo || f.referencia > f.maximo)) return 'A referência deve estar entre o mínimo e o máximo.'
  if (v.fim && v.fim < v.inicio) return 'O fim da vigência não pode ser anterior ao início.'
  return null
}

export type PosicaoFaixa = 'abaixo' | 'dentro' | 'acima'
export const posicaoNaFaixa = (valor: number, f: { minimo: number; maximo: number }): PosicaoFaixa =>
  valor < f.minimo ? 'abaixo' : valor > f.maximo ? 'acima' : 'dentro'

export const RESSALVA_FAIXA =
  'A posição em relação à faixa é apenas um indicador de apoio: considere vigência, moeda, escopo (nível/unidade), tempo de casa e a política da empresa antes de qualquer conclusão.'

/* ---------- versões ---------- */
export interface Mudanca { campo: string; de: unknown; para: unknown }
export function diffFichas(a: Record<string, unknown>, b: Record<string, unknown>): Mudanca[] {
  const out: Mudanca[] = []
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out.push({ campo: k, de: a[k] ?? null, para: b[k] ?? null })
  }
  return out
}

/** Quem propõe não aprova a própria mudança (exceto administração). */
export const podeAprovar = (proponente: string, aprovador: string, papel: string) => papel === 'admin' || proponente !== aprovador

/** Revisão pendente se nunca revisado ou revisado há mais de `meses` meses. */
export function revisaoPendente(revisadoEm: string | null | undefined, hoje: Date, meses = 12): boolean {
  if (!revisadoEm) return true
  const lim = new Date(hoje); lim.setMonth(lim.getMonth() - meses)
  return new Date(revisadoEm) < lim
}

/** Lacuna = esperado − atual (positivo = falta). */
export const lacuna = (esperado: number, atual: number) => Math.max(0, esperado - atual)
