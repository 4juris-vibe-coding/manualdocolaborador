import { describe, it, expect } from 'vitest'
import { construirHierarquia, validarMudancaGestor, posicoesVagas, filtrarPessoas, cadeiaAcima, descendentes, type PessoaOrg, type SetorOrg } from './organograma'
import { indicadoresEstrutura, evolucaoDisponivel } from './estrutura'

const P = (id: string, resp?: string | null, extra: Partial<PessoaOrg> = {}): PessoaOrg =>
  ({ id, nome: id.toUpperCase(), status: 'ativo', responsavelId: resp ?? null, setorId: 's1', cargoId: 'g1', ...extra })
const setores: SetorOrg[] = [{ id: 's1', nome: 'Jurídico', gestorId: 'a' }, { id: 's2', nome: 'Comercial', gestorId: null }]

//   a ── b ── d
//    └─ c      e (sozinha, sem gestor)
const base = [P('a'), P('b', 'a'), P('c', 'a'), P('d', 'b'), P('e')]

describe('hierarquia', () => {
  it('constrói a árvore pelos vínculos explícitos, com níveis e contagens', () => {
    const h = construirHierarquia(base, setores)
    expect(h.raizes).toEqual(['a'])
    expect(h.nos.get('d')!.nivel).toBe(2)
    expect(h.niveis).toBe(3)
    expect(h.diretos.get('a')).toBe(2)
    expect(h.totais.get('a')).toBe(3)
    expect(cadeiaAcima(h, 'd')).toEqual(['b', 'a'])
    expect(descendentes(h, 'a').sort()).toEqual(['b', 'c', 'd'])
  })
  it('quem não tem gestor nem equipe é pendência, não raiz', () => {
    const h = construirHierarquia(base, setores)
    expect(h.soltas).toEqual(['e'])
    expect(h.pendencias).toContainEqual({ tipo: 'sem_gestor', pessoaId: 'e' })
  })
  it('várias raízes com equipe são todas legítimas', () => {
    const h = construirHierarquia([P('a'), P('b', 'a'), P('x'), P('y', 'x')], setores)
    expect(h.raizes).toEqual(['a', 'x'])
  })
  it('não deduz subordinação por cargo ou senioridade', () => {
    const h = construirHierarquia([P('a', null, { cargoId: 'diretor' }), P('b', null, { cargoId: 'estagiario' })], setores)
    expect(h.diretos.get('a')).toBe(0)
    expect(h.raizes).toEqual([])
    expect(h.soltas.sort()).toEqual(['a', 'b'])
  })
  it('gestor inexistente e gestor encerrado viram pendência e a pessoa segue visível como órfã', () => {
    const h = construirHierarquia([P('a'), P('b', 'fantasma'), P('c', 'enc'), P('enc', null, { status: 'encerrado' }), P('d', 'a')], setores)
    expect(h.pendencias.map((p) => p.tipo)).toContain('gestor_inexistente')
    expect(h.pendencias.map((p) => p.tipo)).toContain('gestor_inativo')
    expect(h.orfas.sort()).toEqual(['b', 'c'])
    expect(h.nos.has('b')).toBe(true)
    expect(h.pessoas.has('enc')).toBe(false) // encerrados fora do mapa
  })
  it('detecta ciclos (inclusive autorreferência) e os tira da árvore', () => {
    const h = construirHierarquia([P('a', 'b'), P('b', 'c'), P('c', 'a'), P('z', 'z'), P('r'), P('s', 'r')], setores)
    expect(h.ciclos).toHaveLength(1)
    expect(h.ciclos[0].sort()).toEqual(['a', 'b', 'c'])
    expect(h.foraDaArvore.sort()).toEqual(['a', 'b', 'c'])
    expect(h.pendencias.map((p) => p.tipo)).toContain('auto_gestor')
    expect(h.raizes).toEqual(['r'])
  })
  it('área sem gestor e cadastros incompletos', () => {
    const h = construirHierarquia([P('a'), P('b', 'a', { setorId: undefined, cargoId: '' }), P('c', 'a', { setorId: 'nada' })], setores)
    const tipos = h.pendencias.map((p) => p.tipo)
    expect(tipos).toEqual(expect.arrayContaining(['setor_sem_gestor', 'sem_setor', 'sem_cargo', 'setor_inexistente']))
    expect(h.pendencias.find((p) => p.tipo === 'setor_sem_gestor')!.setorId).toBe('s2')
  })
})

describe('validação de mudança de gestor', () => {
  it('impede auto-gestão, gestor inexistente/inativo e ciclos', () => {
    expect(validarMudancaGestor(base, 'b', 'b').erros[0]).toMatch(/si mesma/)
    expect(validarMudancaGestor(base, 'b', 'zzz').erros[0]).toMatch(/não existe/)
    expect(validarMudancaGestor([...base, P('f', null, { status: 'encerrado' })], 'b', 'f').erros[0]).toMatch(/encerrada/)
    expect(validarMudancaGestor(base, 'a', 'd').erros[0]).toMatch(/ciclo/) // d é neto de a
    expect(validarMudancaGestor(base, 'a', 'b').erros[0]).toMatch(/ciclo/)
  })
  it('permite trocas válidas, com aviso quando sai de uma área ou fica sem gestor', () => {
    expect(validarMudancaGestor(base, 'd', 'c').erros).toEqual([])
    const outra = [...base, P('o', null, { setorId: 's2' })]
    expect(validarMudancaGestor(outra, 'd', 'o').avisos[0]).toMatch(/outra área/)
    expect(validarMudancaGestor(base, 'd', null).avisos[0]).toMatch(/sem gestor/)
  })
})

describe('posições vagas e recortes', () => {
  const h = construirHierarquia(base, setores)
  it('só aparecem vagas abertas/aprovadas com posições a preencher, ancoradas no gestor previsto', () => {
    const v = posicoesVagas([
      { id: '1', titulo: 'Advogado', status: 'publicada', setorId: 's1', gestorImediatoId: 'b', qtdPosicoes: 3, posicoesPreenchidas: 1 },
      { id: '2', titulo: 'Rascunho', status: 'rascunho', setorId: 's1', qtdPosicoes: 1, posicoesPreenchidas: 0 },
      { id: '3', titulo: 'Cheia', status: 'publicada', setorId: 's1', qtdPosicoes: 1, posicoesPreenchidas: 1 },
      { id: '4', titulo: 'Sem gestor imediato', status: 'aprovada', setorId: 's1', qtdPosicoes: 1, posicoesPreenchidas: 0 },
      { id: '5', titulo: 'Sem âncora', status: 'pausada', setorId: 's2', qtdPosicoes: 1, posicoesPreenchidas: 0 },
    ], h.pessoas, setores)
    expect(v.map((x) => [x.vagaId, x.gestorId, x.abertas])).toEqual([['1', 'b', 2], ['4', 'a', 1], ['5', null, 1]])
    expect(posicoesVagas([], h.pessoas, setores)).toEqual([])
  })
  it('filtra por área e por equipe do gestor', () => {
    const gente = [...base, P('o', null, { setorId: 's2' })]
    expect(filtrarPessoas(gente, { setorId: 's2' }).map((p) => p.id)).toEqual(['o'])
    expect(filtrarPessoas(gente, { gestorId: 'b' }).map((p) => p.id).sort()).toEqual(['b', 'd'])
  })
})

describe('indicadores de estrutura', () => {
  it('conta pessoas, níveis, equipes e pendências sem julgar a estrutura', () => {
    const i = indicadoresEstrutura(base, setores, [{ id: 'g1', nome: 'Advogado', nivel: 'Pleno' }], [], [])
    expect(i.totalAtivos).toBe(5)
    expect(i.niveisHierarquicos).toBe(3)
    expect(i.gestores).toBe(2)
    expect(i.equipes[0]).toMatchObject({ id: 'a', diretos: 2, totais: 3 })
    expect(i.tamanhoMedioEquipe).toBe(1.5)
    expect(i.porSetor[0]).toMatchObject({ nome: 'Jurídico', qtd: 5 })
    expect(i.porSenioridade[0]).toMatchObject({ nome: 'Pleno', qtd: 5 })
    expect(i.setoresSemGestor).toEqual(['s2'])
    expect(i.posicoesVagas.total).toBe(0)
    expect(i.indisponiveis.length).toBeGreaterThan(0)
    expect(JSON.stringify(i)).not.toMatch(/inadequad/i)
  })
  it('evolução só existe com histórico suficiente', () => {
    expect(evolucaoDisponivel([])).toBe(false)
    expect(evolucaoDisponivel([{ mes: '2026-01-01', dados: { ativos: 1, gestores: 0, niveis: 1, pendencias: 0, porSetor: [] } }])).toBe(false)
  })
})
