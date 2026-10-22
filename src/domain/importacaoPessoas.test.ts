import { describe, it, expect } from 'vitest'
import type { Cargo, Colaborador, Setor } from '@/lib/types'
import type { PessoaInput } from '@/lib/store'
import { aplicarImportacao, escolherAba, lerContatoEmergencia, lerData, lerPlanilhaPessoas, mapearCabecalho, type Referencias } from './importacaoPessoas'

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

describe('planilha no formato da listagem de colaboradores', () => {
  // Mesmo formato da "Listagem de colaboradores": coluna vazia à esquerda, liderança pelo primeiro nome,
  // sem coluna de área, CARGO livre, modalidade, contato de emergência em texto e rodapé.
  const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
  const cab = [null, 'Admissão', 'Liderança', 'Nome', 'Modalidade', 'Salário bruto', 'CARGO', 'email', 'CPF', 'Nascimento', 'Contato', 'Contato de emergência']
  const rows = [
    cab,
    [null, d('2026-07-01'), 'Carla', 'Alex Teste Ribeiro', 'Presencial', 3500, 'Closer PL III', 'alex@x.com', 52998224725, d('2002-07-05'), '85 8734-9410', null],
    [null, d('2025-09-11'), 'Nilo', 'Francisco Jardel Teste', 'Presencial', 5000, 'Gerente Operacional', 'jardel@x.com', '111.111.111-11', d('2004-07-27'), '88 9940-6593', '88992817932 - Janaina (Mãe)'],
    [null, d('2026-09-04'), 'Nilo', 'Carla Aparecida Teste', 'Presencial', 4500, 'Coordenador Comercial', 'carla@x.com', null, d('1992-10-12'), 85999801836, null],
    [null, d('2026-06-08'), 'Jardel', 'Joana Teste Lima', 'Home', 2500, 'Gestor de Trafego', 'JOANA@X.COM', null, d('2003-10-27'), '85 8535-3433', 'Valesca - Esposa - (85)9 9221-8801'],
    [null, d('2025-11-28'), 'Nilo', 'Eduardo Icaro Teste Andrade', 'Presencial', 2300, 'Videomaker', 'eduardo.pessoal@x.com', null, d('2007-10-10'), null, null],
    [null, 'Atualizada 20/10', null, null, null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, 21, null, null, null, null, null],
  ]
  const setores = [{ id: 'sc', nome: 'Comercial' }, { id: 'so', nome: 'Operacional' }, { id: 'sm', nome: 'Marketing' }, { id: 'sr', nome: 'RH & Pessoas' }]
  const cargos = [{ id: 'gt', nome: 'Gestor de Tráfego', setorId: 'so' }]
  const unidades = [{ id: 'u1', nome: 'Sede - Fortaleza - CE' }, { id: 'u2', nome: 'Remoto' }]
  const nilo = pessoa('nilo', { nome: 'Nilo Carvalho', email: 'nilo@4juris.com', papel: 'admin', setorId: 'sr' })
  const edu = pessoa('edu', { nome: 'Eduardo Icaro', email: 'social@4juris.com', setorId: 'sm', responsavelId: 'nilo' })

  it('escolhe a aba com nome e e-mail', () => {
    const abas = [{ nome: 'Benefícios', rows: [[null], [null, 'Admissão', 'Nome', 'Valor']] }, { nome: 'Colaboradores', rows }]
    expect(escolherAba(abas)?.nome).toBe('Colaboradores')
  })

  it('lê o contato de emergência em texto livre', () => {
    expect(lerContatoEmergencia('Ana Paula - Esposa - 88992066008')).toEqual({ nome: 'Ana Paula', parentesco: 'Esposa', telefone: '88992066008' })
    expect(lerContatoEmergencia('88992817932 - Janaina (Mãe)\r\n88993519500 - Ozanir (Pai)')).toEqual({ nome: 'Janaina', parentesco: 'Mãe', telefone: '88992817932' })
    expect(lerContatoEmergencia('Naiara: +55 85 9613-9912')).toEqual({ nome: 'Naiara', telefone: '+55 85 9613-9912' })
    expect(lerContatoEmergencia('Socorro, 85985084682, mãe.')).toEqual({ nome: 'Socorro', parentesco: 'Mãe', telefone: '85985084682' })
    expect(lerContatoEmergencia('85987501527 (sem nome)')).toEqual({ telefone: '85987501527' })
  })

  it('deduz área, cria funções, reconhece cadastro pelo nome e ignora o rodapé', () => {
    const r = lerPlanilhaPessoas(rows, { setores, cargos, unidades, pessoas: [nilo, edu] }, '2026-10-22', { modo: 'novos' })
    expect(r.ignoradas).toEqual(['Salário bruto'])
    expect(r.linhas).toHaveLength(5)
    const [alex, jardel, carla, joana, eduardo] = r.linhas
    expect(alex.input).toMatchObject({ setorId: 'sc', unidadeId: 'u1', dataEntrada: '2026-07-01', cpf: '52998224725', nascimento: '2002-07-05' })
    expect(alex.novaFuncao).toEqual({ nome: 'Closer PL III', nivel: 'Pleno', setorId: 'sc' })
    expect(jardel.input).toMatchObject({ setorId: 'so', emergenciaNome: 'Janaina', emergenciaParentesco: 'Mãe', emergenciaTelefone: '88992817932' })
    expect(jardel.input.cpf).toBeUndefined()
    expect(jardel.avisos[0]).toContain('CPF inválido')
    expect(jardel.novaFuncao?.nivel).toBe('Liderança')
    expect(carla.input).toMatchObject({ setorId: 'sc', celular: '85999801836' })
    expect(joana.input).toMatchObject({ email: 'joana@x.com', setorId: 'so', cargoId: 'gt', unidadeId: 'u2' })
    expect(joana.novaFuncao).toBeUndefined()
    expect(eduardo).toMatchObject({ acao: 'ignorar', existenteId: 'edu', reconhecidoPor: 'nome' })
    expect(r.linhas.filter((l) => l.acao !== 'ignorar').every((l) => !l.erros.length)).toBe(true)
    expect(r.funcoesNovas.map((f) => f.nome)).toEqual(['Closer PL III', 'Gerente Operacional', 'Coordenador Comercial'])
  })

  it('no modo completar, preenche só o que está vazio e guarda o e-mail da planilha como pessoal', () => {
    const r = lerPlanilhaPessoas(rows, { setores, cargos, unidades, pessoas: [nilo, edu] }, '2026-10-22', { modo: 'completar' })
    const eduardo = r.linhas[4]
    expect(eduardo.acao).toBe('atualizar')
    expect(eduardo.input).toMatchObject({ nome: 'Eduardo Icaro', email: 'social@4juris.com', emailPessoal: 'eduardo.pessoal@x.com', setorId: 'sm', nascimento: '2007-10-10', dataEntrada: '2024-01-01' })
    // A função nova vai para a área que o nome indica, mesmo que a pessoa esteja em outra.
    const outraArea = lerPlanilhaPessoas(rows, { setores, cargos, unidades, pessoas: [nilo, { ...edu, setorId: 'sr' }] }, '2026-10-22', { modo: 'completar' })
    expect(outraArea.linhas[4].input.setorId).toBe('sr')
    expect(outraArea.linhas[4].novaFuncao).toMatchObject({ nome: 'Videomaker', setorId: 'sm' })
  })

  it('aplica: cria funções uma vez, liga lideranças pelo primeiro nome e conecta as áreas', () => {
    const banco: Colaborador[] = [nilo, edu]
    const bancoCargos: Cargo[] = cargos.map((c) => ({ ...c, nivel: 'Pleno' as const }))
    const bancoSetores: Setor[] = setores.map((s) => ({ ...s, descricao: '', cor: '', icon: '', gestorId: null, liderancaIds: [], reembolsoApenasLideranca: false }))
    let n = 0
    const acoes = {
      pessoas: () => banco,
      salvarPessoa: (i: PessoaInput, id?: string) => {
        if (id) { const k = banco.findIndex((p) => p.id === id); banco[k] = { ...banco[k], ...i }; return { ok: true as const, id } }
        const novo = pessoa(`n${++n}`, i as Partial<Colaborador>)
        banco.push(novo)
        return { ok: true as const, id: novo.id }
      },
      cargos: () => bancoCargos,
      salvarCargo: (c: Omit<Cargo, 'id'>) => { const id = `g${bancoCargos.length}`; bancoCargos.push({ ...c, id }); return { ok: true as const, id } },
      setores: () => bancoSetores,
      salvarSetor: (s: Omit<Setor, 'id'>, id: string) => { const k = bancoSetores.findIndex((x) => x.id === id); bancoSetores[k] = { ...s, id }; return { ok: true as const } },
    }
    const leitura = lerPlanilhaPessoas(rows, { setores, cargos, unidades, pessoas: banco }, '2026-10-22', { modo: 'novos' })
    const res = aplicarImportacao(leitura.linhas, acoes, { modo: 'novos' })
    expect(res).toMatchObject({ ignoradas: 1, erros: [] })
    expect(res.criadas).toHaveLength(4)
    expect(res.funcoesCriadas).toEqual(['Closer PL III', 'Gerente Operacional', 'Coordenador Comercial'])
    const por = (email: string) => banco.find((p) => p.email === email)!
    expect(por('alex@x.com').responsavelId).toBe(por('carla@x.com').id)
    expect(por('joana@x.com').responsavelId).toBe(por('jardel@x.com').id)
    expect(por('carla@x.com')).toMatchObject({ responsavelId: 'nilo', papel: 'gestor' })
    expect(por('jardel@x.com').papel).toBe('gestor')
    expect(por('social@4juris.com').email).toBe('social@4juris.com')
    const setor = (id: string) => bancoSetores.find((s) => s.id === id)!
    expect(setor('sc')).toMatchObject({ gestorId: por('carla@x.com').id })
    expect(setor('sc').liderancaIds).toEqual(expect.arrayContaining([por('carla@x.com').id, 'nilo']))
    expect(setor('so')).toMatchObject({ gestorId: por('jardel@x.com').id })

    // Subir a mesma planilha de novo não cria nada.
    const deNovo = lerPlanilhaPessoas(rows, { setores, cargos: bancoCargos, unidades, pessoas: banco }, '2026-10-22', { modo: 'novos' })
    expect(deNovo.linhas.every((l) => l.acao === 'ignorar')).toBe(true)
  })
})
