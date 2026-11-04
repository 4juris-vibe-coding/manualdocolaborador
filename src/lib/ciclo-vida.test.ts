/* Ciclo de vida da parceria (critérios de aceitação 2.1–2.3 e 6):
   data efetiva independente de alterações, reativação sem duplicar,
   novo período preservando o histórico e checklist sem duplicidade. */
import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { vinculosDe, noQuadroEm, ultimo } from '@/domain/vinculos'
import { hojeISO, somarDias } from '@/domain/datas'

const st = () => useStore.getState()
const hoje = hojeISO()
const editar = (id: string, patch: Record<string, unknown> = {}) => {
  const { id: _i, ...resto } = st().pessoa(id)!
  return st().salvarPessoa({ ...resto, cnpj: '11.222.333/0001-81', ...patch } as never, id)
}
const pessoa = (id: string) => st().pessoa(id)!
const abertos = (id: string, tipo: string) => st().processos.filter((p) => p.colaboradorId === id && p.tipo === tipo && !p.concluidoEm && !p.canceladoEm)

beforeEach(() => { st().reset(); st().entrar('c9') })

describe('encerramento com data efetiva', () => {
  it('guarda a data informada pelo RH, independente da data do registro, e não muda ao editar o cadastro', () => {
    const efetiva = somarDias(hoje, -20)
    const r = st().encerrarParceria('c5', efetiva, 'me4', 'obs interna', true)
    expect(r.ok).toBe(true)
    expect(pessoa('c5').status).toBe('encerrado')
    expect(pessoa('c5').encerramento?.data).toBe(efetiva)
    expect(pessoa('c5').encerramento?.iniciativa).toBe('empresa') // sugerida pelo motivo
    expect(pessoa('c5').encerramento?.porId).toBe('c9')
    // O checklist de encerramento aponta para a data efetiva, não para hoje.
    expect(abertos('c5', 'encerramento')[0].referencia).toBe(efetiva)

    // Editar depois do encerramento (ex.: telefone) não altera a data nem reabre a parceria.
    expect(editar('c5', { telefone: '(11) 90000-0000', status: 'ativo' }).ok).toBe(true)
    expect(pessoa('c5').encerramento?.data).toBe(efetiva)
    expect(pessoa('c5').status).toBe('encerrado')
    expect(st().auditoria[0].resumo).toMatch(/após o encerramento/)
  })

  it('data futura agenda (parceria segue ativa); recusa data anterior ao início e encerramento repetido', () => {
    const r = st().encerrarParceria('c5', somarDias(hoje, 3), 'me4', undefined, true)
    expect(r.ok).toBe(true)
    expect(pessoa('c5').status).not.toBe('encerrado')
    expect(pessoa('c5').encerramentoAgendado).toMatchObject({ data: somarDias(hoje, 3), iniciativa: 'empresa', iniciarChecklist: true })
    expect(st().cancelarEncerramentoAgendado('c5').ok).toBe(true)
    expect(pessoa('c5').encerramentoAgendado).toBeUndefined()
    expect(st().encerrarParceria('c5', '1990-01-01', 'me4').ok).toBe(false)
    expect(st().encerrarParceria('c5', hoje, 'me4').ok).toBe(true)
    expect(st().encerrarParceria('c5', hoje, 'me4').ok).toBe(false)
  })

  it('exige iniciativa classificada quando o motivo não traz sugestão', () => {
    expect(st().encerrarParceria('c5', hoje, 'me6').ok).toBe(false)
    expect(st().encerrarParceria('c5', hoje, 'me6', undefined, false, 'prestador').ok).toBe(true)
    expect(pessoa('c5').encerramento?.iniciativa).toBe('prestador')
  })

  it('correção do encerramento guarda os valores anteriores e exige justificativa', () => {
    const d1 = somarDias(hoje, -10), d2 = somarDias(hoje, -12)
    st().encerrarParceria('c5', d1, 'me4')
    expect(st().corrigirEncerramento('c5', { data: d2 }, '').ok).toBe(false)
    expect(st().corrigirEncerramento('c5', { data: d2, iniciativa: 'mutuo' }, 'Data informada errada').ok).toBe(true)
    const p = pessoa('c5')
    expect(p.encerramento?.data).toBe(d2)
    expect(ultimo(vinculosDe(p))?.fim).toBe(d2)
    const mov = ultimo(p.movimentacoes!)!
    expect(mov.tipo).toBe('correcao_encerramento')
    expect(mov.anterior).toMatchObject({ data: d1, iniciativa: 'empresa' })
  })
})

describe('reativação e novo período sem duplicar a pessoa', () => {
  it('reativar desfaz o encerramento do mesmo vínculo, mantém um só cadastro e registra o histórico', () => {
    const total = st().colaboradores.length
    const efetiva = somarDias(hoje, -5)
    st().encerrarParceria('c5', efetiva, 'me4', undefined, true)
    expect(st().reativarParceria('c5', 'reativar', undefined, 'Encerrado por engano').ok).toBe(true)
    expect(st().colaboradores.length).toBe(total)
    expect(st().colaboradores.filter((c) => c.id === 'c5')).toHaveLength(1)
    const p = pessoa('c5')
    expect(p.status).toBe('ativo')
    expect(p.encerramento).toBeUndefined()
    expect(vinculosDe(p)).toHaveLength(1)
    expect(vinculosDe(p)[0].fim).toBeUndefined()
    expect(p.movimentacoes!.map((m) => m.tipo)).toEqual(['encerramento', 'reativacao'])
    expect(p.movimentacoes![1].anterior?.data).toBe(efetiva)
    // O checklist de encerramento não fica pendurado.
    expect(abertos('c5', 'encerramento')).toHaveLength(0)
  })

  it('encerrar → reativar → encerrar não cria dois checklists de encerramento (bug de duplicidade)', () => {
    st().encerrarParceria('c5', somarDias(hoje, -5), 'me4', undefined, true)
    st().reativarParceria('c5')
    st().encerrarParceria('c5', somarDias(hoje, -2), 'me4', undefined, true)
    expect(abertos('c5', 'encerramento')).toHaveLength(1)
    expect(abertos('c5', 'encerramento')[0].referencia).toBe(somarDias(hoje, -2))
  })

  it('novo período preserva o anterior e conta a pessoa uma vez no quadro', () => {
    const fim1 = somarDias(hoje, -60), ini2 = somarDias(hoje, -10)
    st().encerrarParceria('c5', fim1, 'me3')
    expect(st().reativarParceria('c5', 'novo_vinculo', somarDias(fim1, -1)).ok).toBe(false) // sobreposição
    expect(st().reativarParceria('c5', 'novo_vinculo', ini2).ok).toBe(true)
    const p = pessoa('c5')
    const vs = vinculosDe(p)
    expect(vs).toHaveLength(2)
    expect(vs[0].fim).toBe(fim1)
    expect(vs[0].iniciativa).toBe('prestador')
    expect(vs[1]).toMatchObject({ inicio: ini2, origem: 'novo_vinculo' })
    expect(p.dataEntrada).toBe(ini2)
    expect(noQuadroEm(p, somarDias(fim1, 5))).toBe(false) // no intervalo entre os períodos
    expect(noQuadroEm(p, hoje)).toBe(true)
    expect(st().colaboradores.filter((c) => c.email === p.email)).toHaveLength(1)
  })
})

describe('checklist de integração', () => {
  it('conclui só quando os obrigatórios estão feitos e passa a pessoa de integração para ativa', () => {
    const modelo = st().checklists.find((m) => m.tipo === 'integracao')!
    st().salvarChecklistModelo({ ...modelo, itens: modelo.itens.map((i, n) => ({ ...i, obrigatorio: n !== 0 })) }, modelo.id)
    const novo = st().salvarPessoa({ nome: 'Pessoa Teste', email: 'teste.ciclo@demo.4juris.com.br', papel: 'colaborador', setorId: st().setores[0].id, status: 'integracao', dataEntrada: hoje, regime: 'autonomo', cpf: '529.982.247-25' } as never)
    expect(novo.ok).toBe(true)
    const id = novo.ok ? novo.id! : ''
    const r = st().iniciarJornada(id, modelo.id)
    expect(r.ok).toBe(true)
    expect(st().iniciarJornada(id, modelo.id).ok).toBe(false) // sem duplicar
    const proc = st().processos.find((p) => p.colaboradorId === id)!
    expect(proc.referencia).toBe(hoje)
    proc.itens.slice(1).forEach((i) => st().marcarItemJornada(proc.id, i.id, true))
    expect(st().processos.find((p) => p.id === proc.id)!.concluidoEm).toBe(hoje)
    expect(pessoa(id).status).toBe('ativo')
  })
})

describe('movimentação organizacional com data efetiva', () => {
  it('mudar área, função e gestor gera um lançamento com a data efetiva e o motivo', () => {
    const p = pessoa('c5')
    const outraArea = st().setores.find((x) => x.id !== p.setorId)!
    const r = editar('c5', { setorId: outraArea.id, cargoId: '', responsavelId: undefined, dataMudanca: somarDias(hoje, -10), motivoMudanca: 'Reorganização' })
    expect(r.ok).toBe(true)
    const h = st().historicoFuncao.find((x) => x.colaboradorId === 'c5')!
    expect(h).toMatchObject({ dataEfetiva: somarDias(hoje, -10), setorAnteriorId: p.setorId, setorNovoId: outraArea.id, observacao: 'Reorganização' })
    expect(pessoa('c5')).not.toHaveProperty('dataMudanca')
  })
  it('recusa data da mudança anterior ao início da parceria', () => {
    const outraArea = st().setores.find((x) => x.id !== pessoa('c5').setorId)!
    expect(editar('c5', { setorId: outraArea.id, cargoId: '', dataMudanca: '1990-01-01' }).ok).toBe(false)
  })
})
