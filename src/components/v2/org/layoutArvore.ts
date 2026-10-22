/* Layout puro do organograma (de cima para baixo). Sem React: testável e sem custo de render.
   Regra de hierarquia: quem responde à mesma pessoa fica na mesma altura. Se algum dos filhos tem equipe aberta,
   todos ficam numa fileira só (uma quebra empurraria o liderado direto para baixo da equipe de um irmão e ele
   pareceria estar níveis abaixo). Só quando nenhum filho tem equipe aberta, e são mais de `porLinha`, eles quebram
   em fileiras (grade de colunas alinhadas) para o mapa não crescer para os lados. As conexões da grade descem por um
   "tronco" no vão entre a 1ª e a 2ª coluna e se ramificam em cada fileira. */

export interface NoLayout {
  chave: string
  /** Filhos já filtrados pelo estado de expansão (recolhido = lista vazia). */
  filhos: NoLayout[]
}
export interface Posicionado { chave: string; x: number; y: number; nivel: number }
/** `d` é o caminho SVG da conexão (pai → filho). x1/y1/x2/y2 são as pontas, mantidas para quem só precisa delas. */
export interface Aresta { de: string; para: string; x1: number; y1: number; x2: number; y2: number; d: string }
export interface ResultadoLayout { nos: Posicionado[]; arestas: Aresta[]; largura: number; altura: number }

export interface Medidas { largura: number; altura: number; espacoH: number; espacoV: number; porLinha?: number }
export const MEDIDAS: Medidas = { largura: 208, altura: 80, espacoH: 18, espacoV: 44, porLinha: 3 }

interface Bloco { w: number; h: number; grade: null | { colW: number[]; rowH: number[] } }

/** Posiciona várias raízes lado a lado; cada pai fica centralizado sobre seus filhos. */
export function calcularLayout(raizes: NoLayout[], m: Medidas = MEDIDAS): ResultadoLayout {
  const porLinha = Math.max(1, m.porLinha ?? 3)
  const blocos = new Map<string, Bloco>()

  const medir = (n: NoLayout): Bloco => {
    const filhos = n.filhos.map(medir)
    let b: Bloco
    if (!filhos.length) b = { w: m.largura, h: m.altura, grade: null }
    else if (filhos.length <= porLinha || n.filhos.some((f) => f.filhos.length > 0)) {
      // Uma fileira: larguras somadas, como um organograma clássico.
      const soma = filhos.reduce((s, f) => s + f.w, 0) + (filhos.length - 1) * m.espacoH
      b = { w: Math.max(m.largura, soma), h: m.altura + m.espacoV + Math.max(...filhos.map((f) => f.h)), grade: null }
    } else {
      // Grade: colunas com a largura da maior subárvore da coluna, fileiras com a altura da maior subárvore da fileira.
      const colW = Array.from({ length: porLinha }, (_, c) => Math.max(...filhos.filter((_, i) => i % porLinha === c).map((f) => f.w)))
      const rowH = Array.from({ length: Math.ceil(filhos.length / porLinha) }, (_, r) => Math.max(...filhos.slice(r * porLinha, (r + 1) * porLinha).map((f) => f.h)))
      const gw = colW.reduce((s, w) => s + w, 0) + (porLinha - 1) * m.espacoH
      const gh = rowH.reduce((s, h) => s + h, 0) + (rowH.length - 1) * m.espacoV
      b = { w: Math.max(m.largura, gw), h: m.altura + m.espacoV + gh, grade: { colW, rowH } }
    }
    blocos.set(n.chave, b)
    return b
  }
  raizes.forEach(medir)

  const nos: Posicionado[] = [], arestas: Aresta[] = []
  let altura = 0
  const cx = (p: Posicionado) => p.x + m.largura / 2

  const posicionar = (n: NoLayout, esq: number, topo: number, nivel: number): Posicionado => {
    const b = blocos.get(n.chave)!
    const yFilhos = topo + m.altura + m.espacoV
    let x: number
    let filhosPos: { p: Posicionado; d: (px: number, py: number) => string }[] = []

    if (!n.filhos.length) {
      x = esq + (b.w - m.largura) / 2
    } else if (!b.grade) {
      const somaFilhos = n.filhos.reduce((s, f) => s + blocos.get(f.chave)!.w, 0) + (n.filhos.length - 1) * m.espacoH
      let cursor = esq + (b.w - somaFilhos) / 2
      const barra = yFilhos - m.espacoV / 2
      filhosPos = n.filhos.map((f) => {
        const p = posicionar(f, cursor, yFilhos, nivel + 1)
        cursor += blocos.get(f.chave)!.w + m.espacoH
        return { p, d: (px, py) => `M${px},${py} V${barra} H${cx(p)} V${p.y}` }
      })
      x = (filhosPos[0].p.x + filhosPos[filhosPos.length - 1].p.x) / 2
    } else {
      const { colW, rowH } = b.grade
      const gw = colW.reduce((s, w) => s + w, 0) + (colW.length - 1) * m.espacoH
      const gEsq = esq + (b.w - gw) / 2
      const colEsq = colW.map((_, c) => gEsq + colW.slice(0, c).reduce((s, w) => s + w, 0) + c * m.espacoH)
      const rowTopo = rowH.map((_, r) => yFilhos + rowH.slice(0, r).reduce((s, h) => s + h, 0) + r * m.espacoV)
      const tronco = colEsq[0] + colW[0] + m.espacoH / 2
      filhosPos = n.filhos.map((f, i) => {
        const c = i % colW.length, r = Math.floor(i / colW.length)
        const fw = blocos.get(f.chave)!.w
        const p = posicionar(f, colEsq[c] + (colW[c] - fw) / 2, rowTopo[r], nivel + 1)
        const barra0 = rowTopo[0] - m.espacoV / 2, barra = rowTopo[r] - m.espacoV / 2
        return { p, d: (px, py) => (r === 0 ? `M${px},${py} V${barra0} H${cx(p)} V${p.y}` : `M${px},${py} V${barra0} H${tronco} V${barra} H${cx(p)} V${p.y}`) }
      })
      // O pai fica sobre a coluna do meio da grade.
      const meio = Math.floor(colW.length / 2)
      x = colEsq[meio] + colW[meio] / 2 - m.largura / 2
    }

    const p = { chave: n.chave, x, y: topo, nivel }
    nos.push(p)
    altura = Math.max(altura, topo + m.altura)
    const px = x + m.largura / 2, py = topo + m.altura
    for (const f of filhosPos) arestas.push({ de: n.chave, para: f.p.chave, x1: px, y1: py, x2: cx(f.p), y2: f.p.y, d: f.d(px, py) })
    return p
  }

  let esq = 0
  for (const r of raizes) { posicionar(r, esq, 0, 0); esq += blocos.get(r.chave)!.w + m.espacoH * 2 }
  const largura = Math.max(0, esq - m.espacoH * 2)
  return { nos, arestas, largura, altura }
}
