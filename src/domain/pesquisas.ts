/* ============================================================
   4JURIS Pessoas · Pesquisas voluntárias e anônimas
   - Respostas não guardam a identidade de quem respondeu.
   - Resultados de grupos com menos de `minimoRespostas` respostas
     são suprimidos para reduzir o risco de identificação.
   - Respostas em texto livre só são exibidas quando o total geral
     atinge o mínimo, e nunca por área.
   ============================================================ */
import type { Pergunta, Pesquisa, RespostaPesquisa } from '@/lib/types'

export type ResultadoPergunta =
  | { tipo: 'escala'; media: number; distribuicao: number[]; n: number } // índices 0..4 → notas 1..5
  | { tipo: 'enps'; enps: number; promotores: number; neutros: number; detratores: number; n: number }
  | { tipo: 'opcoes'; contagem: { opcao: string; qtd: number }[]; n: number }
  | { tipo: 'texto'; textos: string[]; n: number }

export interface ResultadoPesquisa {
  total: number
  suprimido: boolean
  porPergunta: Record<string, ResultadoPergunta | null>
}

export function agregar(pesquisa: Pesquisa, respostas: RespostaPesquisa[], filtroSetorId?: string): ResultadoPesquisa {
  const rs = respostas.filter((r) => r.pesquisaId === pesquisa.id && (!filtroSetorId || r.setorId === filtroSetorId))
  const suprimido = rs.length < pesquisa.minimoRespostas
  const porPergunta: Record<string, ResultadoPergunta | null> = {}
  for (const p of pesquisa.perguntas) {
    porPergunta[p.id] = suprimido ? null : agregarPergunta(p, rs, !!filtroSetorId)
  }
  return { total: rs.length, suprimido, porPergunta }
}

function agregarPergunta(p: Pergunta, rs: RespostaPesquisa[], recorteArea: boolean): ResultadoPergunta | null {
  const vals = rs.map((r) => r.respostas[p.id]).filter((v) => v !== undefined && v !== '')
  if (p.tipo === 'escala') {
    const nums = vals.map(Number).filter((n) => n >= 1 && n <= 5)
    const dist = [0, 0, 0, 0, 0]
    nums.forEach((n) => dist[n - 1]++)
    return { tipo: 'escala', media: nums.length ? round1(nums.reduce((a, b) => a + b, 0) / nums.length) : 0, distribuicao: dist, n: nums.length }
  }
  if (p.tipo === 'enps') {
    const nums = vals.map(Number).filter((n) => n >= 0 && n <= 10)
    const pro = nums.filter((n) => n >= 9).length, det = nums.filter((n) => n <= 6).length
    const n = nums.length
    return { tipo: 'enps', enps: n ? Math.round(((pro - det) / n) * 100) : 0, promotores: pro, neutros: n - pro - det, detratores: det, n }
  }
  if (p.tipo === 'opcoes') {
    const cont = (p.opcoes ?? []).map((o) => ({ opcao: o, qtd: vals.filter((v) => v === o).length }))
    return { tipo: 'opcoes', contagem: cont, n: vals.length }
  }
  // Texto livre: nunca por área (risco de reidentificação pelo estilo/conteúdo).
  if (recorteArea) return null
  return { tipo: 'texto', textos: vals.map(String), n: vals.length }
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function validarRespostas(p: Pesquisa, respostas: Record<string, number | string>): string | null {
  for (const q of p.perguntas) {
    const v = respostas[q.id]
    if (q.tipo === 'texto') continue // texto é sempre opcional
    if (v === undefined || v === '') return `Responda: "${q.texto}"`
    if (q.tipo === 'escala' && !(Number(v) >= 1 && Number(v) <= 5)) return 'Resposta de escala inválida.'
    if (q.tipo === 'enps' && !(Number(v) >= 0 && Number(v) <= 10)) return 'Resposta de 0 a 10 inválida.'
    if (q.tipo === 'opcoes' && !(q.opcoes ?? []).includes(String(v))) return 'Opção inválida.'
  }
  return null
}

export function pesquisaAbertaPara(p: Pesquisa, setorId: string, hoje: string): boolean {
  return p.status === 'aberta' && p.inicio <= hoje && hoje <= p.fim && (p.setoresAlvo.length === 0 || p.setoresAlvo.includes(setorId))
}
