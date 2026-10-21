import { describe, it, expect } from 'vitest'
import { FORMATOS_ARTE, ehArte, ehEmbutido, modeloIdArte, tamanhoDe, tipoDeDesign } from './canva'
import { ehEditorLivre, modeloProntoDe } from './apresentacoes'

describe('4juris Canva · formatos e tipos', () => {
  it('codifica e decodifica o tamanho da arte no modeloId', () => {
    expect(modeloIdArte(1080, 1350)).toBe('arte:1080x1350')
    expect(tamanhoDe('arte:1080x1350')).toEqual({ w: 1080, h: 1350 })
    expect(tamanhoDe('arte:1920.4x1080.6')).toEqual({ w: 1080, h: 1080 }) // formato inválido cai no padrão
    expect(modeloIdArte(1080.4, 1919.6)).toBe('arte:1080x1920')
  })

  it('distingue arte, apresentação do editor livre e apresentação por formulário', () => {
    expect(ehArte('arte:1080x1080')).toBe(true)
    expect(ehArte('editor-livre:avisos')).toBe(false)
    expect(ehEditorLivre('editor-livre')).toBe(true)
    expect(ehEditorLivre('editor-livre:evento')).toBe(true)
    expect(ehEditorLivre('institucional')).toBe(false)
    expect(ehEmbutido({ modeloId: 'arte:1080x1080' })).toBe(true)
    expect(ehEmbutido({ modeloId: 'editor-livre:galeria' })).toBe(true)
    expect(ehEmbutido({ modeloId: 'resultados' })).toBe(false)
    expect(tipoDeDesign({ modeloId: 'arte:1080x1080' })).toBe('arte')
    expect(tipoDeDesign({ modeloId: 'institucional' })).toBe('apresentacao')
  })

  it('o modelo pronto padrão do editor livre é o 4JURIS Day', () => {
    expect(modeloProntoDe('editor-livre')).toBe('4jurisday')
    expect(modeloProntoDe('editor-livre:avisos')).toBe('avisos')
  })

  it('os formatos prontos têm proporções distintas e dentro dos limites', () => {
    const ids = new Set(FORMATOS_ARTE.map((f) => f.id))
    expect(ids.size).toBe(FORMATOS_ARTE.length)
    for (const f of FORMATOS_ARTE) {
      expect(f.w).toBeGreaterThanOrEqual(100)
      expect(f.h).toBeLessThanOrEqual(5000)
    }
  })
})
