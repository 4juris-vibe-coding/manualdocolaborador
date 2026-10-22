import { describe, it, expect } from 'vitest'
import type { Colaborador } from '@/lib/types'
import type { PessoaInput } from '@/lib/store'
import { aplicarImportacao, lerData, lerPlanilhaPessoas, mapearCabecalho, type Referencias } from './importacaoPessoas'

const pessoa = (id: string, p: Partial<Colaborador> = {}): Colaborador => ({
  id, nome: `Pessoa ${id}`, email: `${id}@x.com`, telefone: '', avatarCor: '', papel: 'colaborador', setorId: 's1', cargoId: '', status: 'ativo', dataEntrada: '2024-01-01',
  cidade: '', uf: '', regime: 'autonomo', razaoSocial: '', cnpj: '', privacidade: { mostrarAniversario: false, mostrarMarcos: false, aparecerEmDestaques: false }, ...p,
})
const ref = (pessoas: Colaborador[] = []): Referencias => ({
  setores: [{ id: 's1', nome: 'Comercial' }, { id: 's2', nome: 'Diretoria' }],
  cargos: [{ id: 'g1', nome: 'Executivo de contas', setorId: 's1' }, { id: 'g2', nome: 'CEO', setorId: 's2' }],
  pessoas,
})

describe('importação de colaboradores por planilha', () => {
  it('reconhece cabeçalhos com variações de nome, acento e caixa', () => {
    const { indices, ignoradas } = mapearCabecalho(['NOME', 'Email', 'Setor', 'Cargo', 'E-mail pessoal', 'Data de Nascimento', 'Gestor imediato', 'Telefone de emergência', 'Coluna X'])
    expect(indices).toMatchObject({ nome: 0, email: 1, area: 2, funcao: 3, emailPessoal: 4, nascimento: 5, superior: 6, emergenciaTelefone: 7 })
    expect(ignoradas).toEqual(['Coluna X'])
  })

  it('lê datas em vários formatos', () => {
    expect(lerData('15/08/1990')).toBe('1990-08-15')
    expect(lerData('1990-08-15')).toBe('1990-08-15')
    expect(lerData(new Date(Date.UTC(2025, 2, 1)))).toBe('2025-03-01')
    expect(lerData(45717)).toBe('2025-03-01')
    expect(lerData('31/02/2020')).toBeNull()
  })

  it('cria novos, atualiza existentes só nos campos preenchidos e aponta erros', () => {
    const existente = pessoa('ana', { nome: 'Ana Lima', email: 'ana@x.com', telefone: '1111', cidade: 'Recife' })
    const rows = [
      ['Nome completo', 'E-mail', 'Área', 'Função', 'CPF', 'Forma', 'CNPJ', 'Razão social', 'Superior direto', 'CEO', 'Cidade'],
      ['Carla CEO', 'carla@x.com', 'Diretoria', 'CEO', '', '', '', '', '', 'Sim', ''],
      ['', 'ANA@x.com', '', '', '', '', '', '', 'carla@x.com', '', 'Olinda'],
      ['Bruno Dias', 'bruno@x.com', 'Comercial', 'Executivo de contas', 52998224725, 'PJ', '11.222.333/0001-81', 'Bruno ME', 'Ana Lima', '', ''],
      ['Sem Área', 'sem@x.com', 'Marketing', '', '', '', '', '', '', '', ''],
      ['Dup', 'bruno@x.com', 'Comercial', '', '', '', '', '', '', '', ''],
    ]
    const r = lerPlanilhaPessoas(rows, ref([existente]), '2026-10-22')
    const [carla, ana, bruno, sem, dup] = r.linhas
    expect(carla).toMatchObject({ acao: 'criar', topo: true, erros: [] })
    expect(carla.input).toMatchObject({ setorId: 's2', cargoId: 'g2', regime: 'autonomo', dataEntrada: '2026-10-22' })
    expect(ana).toMatchObject({ acao: 'atualizar', existenteId: 'ana', erros: [] })
    expect(ana.input).toMatchObject({ nome: 'Ana Lima', telefone: '1111', cidade: 'Olinda', setorId: 's1' })
    expect(bruno.erros).toEqual([])
    expect(bruno.input).toMatchObject({ regime: 'PJ', cpf: '52998224725', cnpj: '11.222.333/0001-81' })
    expect(sem.erros[0]).toContain('Marketing')
    expect(dup.erros[0]).toContain('repetido')
  })

  it('aplica superior direto e CEO depois de criar todos', () => {
    const banco: Colaborador[] = [pessoa('velho', { topoOrganizacao: true })]
    let n = 0
    const acoes = {
      pessoas: () => banco,
      salvarPessoa: (i: PessoaInput, id?: string) => {
        if (id) { const k = banco.findIndex((p) => p.id === id); banco[k] = { ...banco[k], ...i }; return { ok: true as const, id } }
        const novo = pessoa(`n${++n}`, i as Partial<Colaborador>)
        banco.push(novo)
        return { ok: true as const, id: novo.id }
      },
    }
    const rows = [
      ['Nome', 'E-mail', 'Área', 'Superior direto', 'CEO'],
      ['Diego Ramos', 'diego@x.com', 'Comercial', 'carla@x.com', ''],
      ['Carla Souza', 'carla@x.com', 'Diretoria', '', 'sim'],
    ]
    const leitura = lerPlanilhaPessoas(rows, ref(banco))
    expect(leitura.linhas.every((l) => !l.erros.length && !l.avisos.length)).toBe(true)
    const res = aplicarImportacao(leitura.linhas, acoes)
    expect(res.criadas).toHaveLength(2)
    const carla = banco.find((p) => p.email === 'carla@x.com')!
    const diego = banco.find((p) => p.email === 'diego@x.com')!
    expect(diego.responsavelId).toBe(carla.id)
    expect(carla.topoOrganizacao).toBe(true)
    expect(banco.find((p) => p.id === 'velho')!.topoOrganizacao).toBe(false)
  })
})

describe('importação com a store real (demonstração)', () => {
  it('grava pela mesma validação do cadastro', async () => {
    const { useStore } = await import('@/lib/store')
    const st = useStore.getState
    st().reset()
    const admin = st().colaboradores.find((c) => c.papel === 'admin')!
    st().entrar(admin.id)
    const area = st().setores[0]
    const rows = [
      ['Nome', 'E-mail', 'Área', 'Superior direto', 'CEO', 'Nascimento'],
      ['Teste Topo', 'topo.import@x.com', area.nome, '', 'Sim', ''],
      ['Teste Base', 'base.import@x.com', area.nome, 'topo.import@x.com', '', '10/05/1995'],
    ]
    const leitura = lerPlanilhaPessoas(rows, { setores: st().setores, cargos: st().cargos, pessoas: st().colaboradores })
    const res = aplicarImportacao(leitura.linhas, { salvarPessoa: st().salvarPessoa, pessoas: () => st().colaboradores })
    expect(res.erros).toEqual([])
    const topo = st().colaboradores.find((c) => c.email === 'topo.import@x.com')!
    const base = st().colaboradores.find((c) => c.email === 'base.import@x.com')!
    expect(topo.topoOrganizacao).toBe(true)
    expect(base).toMatchObject({ responsavelId: topo.id, nascimento: '1995-05-10' })
  })
})
