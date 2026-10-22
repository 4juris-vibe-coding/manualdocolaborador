import { describe, it, expect } from 'vitest'
import { calcularLayout, MEDIDAS, type NoLayout } from './layoutArvore'

const n = (chave: string, ...filhos: NoLayout[]): NoLayout => ({ chave, filhos })
const W = MEDIDAS.largura, G = MEDIDAS.espacoH

describe('layout do organograma', () => {
  it('centraliza o pai sobre os filhos e não sobrepõe irmãos', () => {
    const r = calcularLayout([n('a', n('b'), n('c'))])
    const p = Object.fromEntries(r.nos.map((x) => [x.chave, x]))
    expect(p.c.x - p.b.x).toBe(W + G)
    expect(p.a.x).toBe((p.b.x + p.c.x) / 2)
    expect(p.a.y).toBe(0)
    expect(p.b.y).toBe(MEDIDAS.altura + MEDIDAS.espacoV)
    expect(r.arestas).toHaveLength(2)
    expect(r.largura).toBe(2 * W + G)
  })
  it('subárvores largas empurram as vizinhas (sem colisão em nenhum nível)', () => {
    const r = calcularLayout([n('a', n('b', n('b1'), n('b2'), n('b3')), n('c', n('c1')))])
    for (let nivel = 0; nivel < 3; nivel++) {
      const linha = r.nos.filter((x) => x.nivel === nivel).sort((x, y) => x.x - y.x)
      for (let i = 1; i < linha.length; i++) expect(linha[i].x - linha[i - 1].x).toBeGreaterThanOrEqual(W + G)
    }
  })
  it('recolhido (sem filhos) ocupa um cartão; várias raízes ficam lado a lado', () => {
    const r = calcularLayout([n('a'), n('b')])
    expect(r.nos).toHaveLength(2)
    expect(r.nos[1].x).toBeGreaterThan(r.nos[0].x)
    expect(calcularLayout([])).toEqual({ nos: [], arestas: [], largura: 0, altura: 0 })
  })
  it('no máximo 3 filhos por fileira: o resto quebra para baixo e o mapa não cresce para os lados', () => {
    const filhos = Array.from({ length: 8 }, (_, i) => n(`f${i}`))
    const r = calcularLayout([n('jardel', ...filhos)])
    const p = Object.fromEntries(r.nos.map((x) => [x.chave, x]))
    expect(r.largura).toBe(3 * W + 2 * G)
    const fileiras = [...new Set(filhos.map((f) => p[f.chave].y))].sort((a, b) => a - b)
    expect(fileiras).toHaveLength(3)
    for (const y of fileiras) expect(filhos.filter((f) => p[f.chave].y === y).length).toBeLessThanOrEqual(3)
    expect(fileiras[1] - fileiras[0]).toBe(MEDIDAS.altura + MEDIDAS.espacoV)
    // Colunas alinhadas entre as fileiras.
    expect(p.f3.x).toBe(p.f0.x)
    expect(p.f4.x).toBe(p.f1.x)
    // O pai fica sobre a coluna do meio; cada filho tem a sua conexão.
    expect(p.jardel.x).toBe(p.f1.x)
    expect(r.arestas).toHaveLength(8)
    expect(r.altura).toBe(4 * MEDIDAS.altura + 3 * MEDIDAS.espacoV)
  })
  it('subárvores dentro da grade não se sobrepõem', () => {
    const r = calcularLayout([n('a', n('b', n('b1'), n('b2'), n('b3'), n('b4')), n('c'), n('d'), n('e', n('e1')))])
    const ret = r.nos.map((x) => ({ ...x, x2: x.x + W, y2: x.y + MEDIDAS.altura }))
    for (let i = 0; i < ret.length; i++) for (let j = i + 1; j < ret.length; j++) {
      const a = ret[i], b = ret[j]
      expect(a.x < b.x2 && b.x < a.x2 && a.y < b.y2 && b.y < a.y2).toBe(false)
    }
  })
})
