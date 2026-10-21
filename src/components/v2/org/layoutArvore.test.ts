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
})
