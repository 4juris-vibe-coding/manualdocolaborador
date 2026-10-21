import { describe, it, expect } from 'vitest'
import { detectarDuplicidades, diffFichas, normalizar, podeAprovar, posicaoNaFaixa, revisaoPendente, validarFaixa, vigenciasSobrepoem } from './cargos'

describe('cargos · regras puras', () => {
  it('normaliza acentos e pontuação', () => {
    expect(normalizar('  Analista de Comunicação – Jr. ')).toBe('analista de comunicacao jr')
  })
  it('detecta duplicidade por nome, código e nome parecido', () => {
    const d = detectarDuplicidades([
      { id: '1', nome: 'Advogado(a) Pleno', codigo: 'ADV-1' },
      { id: '2', nome: 'advogado a pleno', codigo: 'X' },
      { id: '3', nome: 'Outro', codigo: 'adv-1' },
      { id: '4', nome: 'Analista financeiro', codigo: 'F1' },
      { id: '5', nome: 'Analista financeira', codigo: 'F2' },
    ])
    const motivos = d.map((x) => `${x.a}-${x.b}-${x.motivo}`)
    expect(motivos).toContain('1-2-nome_igual')
    expect(motivos).toContain('1-3-codigo_igual')
    expect(motivos).toContain('4-5-nome_parecido')
  })
  it('vigências: sobreposição, aberta e adjacente', () => {
    expect(vigenciasSobrepoem({ inicio: '2026-01-01', fim: '2026-06-30' }, { inicio: '2026-07-01' })).toBe(false)
    expect(vigenciasSobrepoem({ inicio: '2026-01-01', fim: '2026-06-30' }, { inicio: '2026-06-30' })).toBe(true)
    expect(vigenciasSobrepoem({ inicio: '2026-01-01' }, { inicio: '2030-01-01' })).toBe(true)
  })
  it('valida faixa', () => {
    expect(validarFaixa({ minimo: 10, maximo: 5 }, { inicio: '2026-01-01' })).toMatch(/mínimo/)
    expect(validarFaixa({ minimo: 1, referencia: 9, maximo: 5 }, { inicio: '2026-01-01' })).toMatch(/referência/)
    expect(validarFaixa({ minimo: 1, maximo: 5 }, { inicio: '2026-02-01', fim: '2026-01-01' })).toMatch(/fim/)
    expect(validarFaixa({ minimo: 1, referencia: 3, maximo: 5 }, { inicio: '2026-01-01' })).toBeNull()
  })
  it('posição na faixa', () => {
    const f = { minimo: 100, maximo: 200 }
    expect([50, 100, 200, 250].map((v) => posicaoNaFaixa(v, f))).toEqual(['abaixo', 'dentro', 'dentro', 'acima'])
  })
  it('diff e aprovação', () => {
    expect(diffFichas({ a: 1, b: [1] }, { a: 2, b: [1] })).toEqual([{ campo: 'a', de: 1, para: 2 }])
    expect(podeAprovar('x', 'x', 'rh')).toBe(false)
    expect(podeAprovar('x', 'x', 'admin')).toBe(true)
    expect(podeAprovar('x', 'y', 'rh')).toBe(true)
  })
  it('revisão pendente', () => {
    const hoje = new Date('2026-10-01')
    expect(revisaoPendente(null, hoje)).toBe(true)
    expect(revisaoPendente('2025-01-01', hoje)).toBe(true)
    expect(revisaoPendente('2026-05-01', hoje)).toBe(false)
  })
})
