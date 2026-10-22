import { describe, it, expect } from 'vitest'
import { arvoreDepartamentos, caminhoDepartamento, subdepartamentos, validarDepartamentoPai, type DepartamentoBase } from './departamentos'

//  Diretoria ── Jurídico ── Contencioso
//           └─ Comercial
const deps: DepartamentoBase[] = [
  { id: 'dir', nome: 'Diretoria', gestorId: 'ceo' },
  { id: 'jur', nome: 'Jurídico', gestorId: 'l', paiId: 'dir', liderancaIds: ['l', 'co'] },
  { id: 'cont', nome: 'Contencioso', paiId: 'jur' },
  { id: 'com', nome: 'Comercial', paiId: 'dir', gestorId: 'saiu' },
]
const pessoas = [
  { id: 'ceo', nome: 'Ana', setorId: 'dir', cargoId: 'g-ceo', status: 'ativo' },
  { id: 'l', nome: 'Bia', setorId: 'jur', cargoId: 'g-adv', status: 'ativo' },
  { id: 'co', nome: 'Caio', setorId: 'jur', cargoId: 'g-adv', status: 'ativo' },
  { id: 'p', nome: 'Duda', setorId: 'cont', cargoId: 'g-est', status: 'ativo' },
  { id: 'saiu', nome: 'Edu', setorId: 'com', status: 'encerrado' },
]
const cargos = [
  { id: 'g-ceo', nome: 'CEO', setorId: 'dir' },
  { id: 'g-adv', nome: 'Advogado', setorId: 'jur', nivel: 'Pleno' },
  { id: 'g-est', nome: 'Estagiário', setorId: 'cont' },
]

describe('departamentos', () => {
  it('monta a árvore com líder, cargos e pessoas (inclusive dos subdepartamentos)', () => {
    const a = arvoreDepartamentos(deps, cargos, pessoas)
    const no = (id: string) => a.nos.find((n) => n.id === id)!
    expect(a.raizes).toEqual(['dir'])
    expect(no('dir').filhos).toEqual(['com', 'jur']) // ordem alfabética
    expect(no('jur').lider).toMatchObject({ id: 'l', nome: 'Bia' })
    expect(no('jur').liderancas).toEqual([{ id: 'co', nome: 'Caio' }])
    expect(no('jur').cargos).toEqual([{ id: 'g-adv', nome: 'Advogado', nivel: 'Pleno', pessoas: 2 }])
    expect(no('jur').pessoasTotal).toBe(3)
    expect(no('dir').pessoasTotal).toBe(4) // encerrados não contam
    expect(no('cont').nivel).toBe(2)
    expect(no('com').lider).toBeNull() // líder com parceria encerrada não aparece
  })
  it('pai inexistente ou ciclo nos dados viram departamento de topo, sem travar', () => {
    const ruins: DepartamentoBase[] = [{ id: 'a', nome: 'A', paiId: 'b' }, { id: 'b', nome: 'B', paiId: 'a' }, { id: 'c', nome: 'C', paiId: 'fantasma' }]
    expect(arvoreDepartamentos(ruins, [], []).raizes.sort()).toEqual(['a', 'b', 'c'])
    expect(caminhoDepartamento(ruins, 'a')).toEqual(['A'])
  })
  it('caminho e subdepartamentos', () => {
    expect(caminhoDepartamento(deps, 'cont')).toEqual(['Diretoria', 'Jurídico', 'Contencioso'])
    expect(subdepartamentos(deps, 'dir').sort()).toEqual(['com', 'cont', 'jur'])
    expect(subdepartamentos(deps, 'cont')).toEqual([])
  })
  it('valida o departamento pai', () => {
    expect(validarDepartamentoPai(deps, undefined, 'jur')).toBeNull()
    expect(validarDepartamentoPai(deps, 'cont', null)).toBeNull()
    expect(validarDepartamentoPai(deps, 'jur', 'jur')).toMatch(/dele mesmo/)
    expect(validarDepartamentoPai(deps, 'dir', 'cont')).toMatch(/já está dentro/)
    expect(validarDepartamentoPai(deps, 'com', 'nada')).toMatch(/não existe/)
    expect(validarDepartamentoPai(deps, 'com', 'jur')).toBeNull()
  })
})
