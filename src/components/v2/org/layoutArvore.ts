/* Layout puro do organograma (de cima para baixo). Sem React: testável e sem custo de render. */

export interface NoLayout {
  chave: string
  /** Filhos já filtrados pelo estado de expansão (recolhido = lista vazia). */
  filhos: NoLayout[]
}
export interface Posicionado { chave: string; x: number; y: number; nivel: number }
export interface Aresta { de: string; para: string; x1: number; y1: number; x2: number; y2: number }
export interface ResultadoLayout { nos: Posicionado[]; arestas: Aresta[]; largura: number; altura: number }

export interface Medidas { largura: number; altura: number; espacoH: number; espacoV: number }
export const MEDIDAS: Medidas = { largura: 208, altura: 80, espacoH: 18, espacoV: 44 }

/** Posiciona várias raízes lado a lado; cada pai fica centralizado sobre seus filhos. */
export function calcularLayout(raizes: NoLayout[], m: Medidas = MEDIDAS): ResultadoLayout {
  const larguraSub = new Map<string, number>()
  const medir = (n: NoLayout): number => {
    const filhos = n.filhos.map(medir)
    const soma = filhos.reduce((s, w) => s + w, 0) + Math.max(0, filhos.length - 1) * m.espacoH
    const w = Math.max(m.largura, soma)
    larguraSub.set(n.chave, w)
    return w
  }
  raizes.forEach(medir)

  const nos: Posicionado[] = [], arestas: Aresta[] = []
  let altura = 0
  const posicionar = (n: NoLayout, esq: number, nivel: number): Posicionado => {
    const w = larguraSub.get(n.chave)!
    const y = nivel * (m.altura + m.espacoV)
    let cursor = esq
    const somaFilhos = n.filhos.reduce((s, f) => s + larguraSub.get(f.chave)!, 0) + Math.max(0, n.filhos.length - 1) * m.espacoH
    cursor = esq + (w - somaFilhos) / 2
    const filhosPos = n.filhos.map((f) => {
      const p = posicionar(f, cursor, nivel + 1)
      cursor += larguraSub.get(f.chave)! + m.espacoH
      return p
    })
    const x = filhosPos.length ? (filhosPos[0].x + filhosPos[filhosPos.length - 1].x) / 2 : esq + (w - m.largura) / 2
    const p = { chave: n.chave, x, y, nivel }
    nos.push(p)
    altura = Math.max(altura, y + m.altura)
    for (const f of filhosPos) arestas.push({ de: n.chave, para: f.chave, x1: x + m.largura / 2, y1: y + m.altura, x2: f.x + m.largura / 2, y2: f.y })
    return p
  }

  let esq = 0
  for (const r of raizes) { posicionar(r, esq, 0); esq += larguraSub.get(r.chave)! + m.espacoH * 2 }
  const largura = Math.max(0, esq - m.espacoH * 2)
  return { nos, arestas, largura, altura }
}
