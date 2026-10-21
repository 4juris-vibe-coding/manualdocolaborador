import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'

const st = () => useStore.getState()
// Personas do seed: c9 RH, c2 colaborador. O CNPJ do seed é fictício, por isso o teste informa um válido.
const editar = (id: string, responsavelId: string | undefined) => {
  const { id: _i, ...resto } = st().pessoa(id)!
  return st().salvarPessoa({ ...resto, cnpj: '11.222.333/0001-81', responsavelId }, id)
}
const gestorDe = (id: string) => st().pessoa(id)!.responsavelId

beforeEach(() => { st().reset(); st().entrar('c9') })

describe('troca de gestor imediato pela store', () => {
  it('persiste e registra de → para na auditoria (sem duplicar quando nada muda)', () => {
    editar('c5', undefined)
    editar('c3', 'c5')
    expect(gestorDe('c3')).toBe('c5')
    const antes = st().auditoria.filter((a) => a.acao === 'pessoa.gestor' && a.entidadeId === 'c3').length
    const reg = st().auditoria.find((a) => a.acao === 'pessoa.gestor' && a.entidadeId === 'c3')
    expect(reg?.resumo).toMatch(/→ .+/)
    expect(editar('c3', 'c5').ok).toBe(true)
    expect(st().auditoria.filter((a) => a.acao === 'pessoa.gestor' && a.entidadeId === 'c3').length).toBe(antes)
    expect(editar('c3', undefined).ok).toBe(true)
    expect(st().auditoria.find((a) => a.acao === 'pessoa.gestor' && a.entidadeId === 'c3')?.resumo).toMatch(/→ sem gestor/)
  })

  it('recusa ciclo e auto-gestão, sem alterar nada', () => {
    editar('c5', undefined)
    editar('c3', 'c5')
    const r = editar('c5', 'c3')
    expect(r.ok).toBe(false)
    expect(r.ok ? '' : r.erro).toMatch(/ciclo/)
    expect(gestorDe('c5')).toBeUndefined()
    expect(editar('c5', 'c5').ok).toBe(false)
  })

  it('recusa gestor com parceria encerrada ou inexistente', () => {
    expect(editar('c3', 'nao-existe').ok).toBe(false)
    expect(st().encerrarParceria('c5', '2026-01-10', st().motivosEncerramento[0].id).ok).toBe(true)
    expect(editar('c3', 'c5').ok).toBe(false)
  })

  it('colaborador não altera a estrutura', () => {
    st().entrar('c2')
    const antes = gestorDe('c3')
    expect(editar('c3', antes === 'c5' ? 'c6' : 'c5').ok).toBe(false)
    expect(gestorDe('c3')).toBe(antes)
  })
})
