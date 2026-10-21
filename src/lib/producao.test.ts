import { describe, it, expect } from 'vitest'
import { seedProducao, ADMIN_EMAIL } from './mock'

describe('estado inicial de produção', () => {
  const d = seedProducao()
  it('tem um único usuário: o administrador', () => {
    expect(d.colaboradores).toHaveLength(1)
    expect(d.colaboradores[0]).toMatchObject({ email: ADMIN_EMAIL, papel: 'admin', status: 'ativo' })
  })
  it('mantém a estrutura padrão e não traz dados fictícios de pessoas', () => {
    expect(d.setores.length).toBeGreaterThan(0)
    expect(d.setores.every((s) => s.gestorId === null && s.liderancaIds.length === 0)).toBe(true)
    expect(d.setores.some((s) => s.id === d.colaboradores[0].setorId)).toBe(true)
    expect(d.cargos.some((c) => c.id === d.colaboradores[0].cargoId)).toBe(true)
    for (const k of ['contratos', 'reembolsos', 'notas', 'eventos', 'comunicados', 'lancamentos', 'sugestoes', 'apresentacoes', 'pesquisas', 'documentos'] as const) expect(d[k]).toHaveLength(0)
  })
})
