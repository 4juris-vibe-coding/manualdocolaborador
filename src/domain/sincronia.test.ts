import { describe, expect, it } from 'vitest'
import { canonico, chaveRegistro, diferenca, hashRegistro } from './sincronia'

describe('sincronização por registro', () => {
  it('JSON canônico ignora ordem de chaves e undefined (o jsonb reordena chaves)', () => {
    expect(canonico({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: undefined } })).toBe(canonico({ a: { d: [1, { x: 1, y: 2 }] }, b: 1 }))
    expect(hashRegistro({ a: 1, b: 2 })).toBe(hashRegistro({ b: 2, a: 1 }))
    expect(hashRegistro({ a: 1 })).not.toBe(hashRegistro({ a: 2 }))
  })

  it('chave composta para coleções sem id', () => {
    expect(chaveRegistro('participacoes', { pesquisaId: 'q1', colaboradorId: 'c1' })).toBe('q1|c1')
    expect(chaveRegistro('notas', { id: 'n1' })).toBe('n1')
  })

  it('diferença: novos no topo vão para o início (na ordem da tela), alterados e removidos com o hash visto', () => {
    const antes = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }]
    const depois = [{ id: 'n1', v: 0 }, { id: 'n2', v: 0 }, { id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'z', v: 9 }]
    const d = diferenca('x', antes, depois)!
    expect(d.upserts.map((u) => [u.chave, u.pos, u.base === null])).toEqual([['n2', 'inicio', true], ['n1', 'inicio', true], ['b', 'fim', false], ['z', 'fim', true]])
    expect(d.upserts.find((u) => u.chave === 'b')!.base).toBe(hashRegistro({ id: 'b', v: 1 }))
    expect(d.remocoes).toEqual([{ chave: 'c', base: hashRegistro({ id: 'c', v: 1 }) }])
    expect(diferenca('x', antes, antes.map((r) => ({ ...r })))).toBeNull()
  })
})
