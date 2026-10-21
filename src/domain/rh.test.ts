import { describe, it, expect, beforeEach } from 'vitest'
import type { CicloAvaliativo, Colaborador, Competencia, Setor } from '@/lib/types'
import { aderenciaDisc, aderenciaIndicador, compatibilidadeFuncao, ranquear, tracosPadrao, discDominante } from './perfil'
import { gerarParticipantes, notaPonderada, gerarAvaliacoesInicio, responsaveisDe, CONFIG_INICIO_PADRAO } from './avaliacoes'
import { rotatividade, metricasPessoas, MIN_GRUPO, idade } from './metricas'
import { useStore } from '@/lib/store'
import { hojeISO, somarDias } from './datas'

const pessoa = (id: string, p: Partial<Colaborador> = {}): Colaborador => ({
  id, nome: id, email: `${id}@x.com`, telefone: '', avatarCor: '', papel: 'colaborador', setorId: 's1', cargoId: 'g1', status: 'ativo', dataEntrada: '2024-01-01',
  cidade: '', uf: '', regime: 'PJ', razaoSocial: '', cnpj: '', privacidade: { mostrarAniversario: false, mostrarMarcos: false, aparecerEmDestaques: false }, ...p,
})
const setores: Setor[] = [{ id: 's1', nome: 'A', descricao: '', cor: '', icon: '', gestorId: 'L', liderancaIds: ['L'], reembolsoApenasLideranca: false }]
const ciclo = (p: Partial<CicloAvaliativo>): CicloAvaliativo => ({
  id: 'cv', nome: 'x', abertura: '2026-01-01', encerramento: '2026-12-31', niveisEscala: 5, rotuloEscala: 'desempenho', comentarioCompetenciaMostrar: false,
  comentarioCompetenciaObrigatorio: false, comentarioGeralObrigatorio: false, tipoRelacao: 'direta_90', autoavaliacao: false, regimes: [], status: 'rascunho', etapa: 1, criadoEm: '', ...p,
})
let n = 0
const id = () => `id${++n}`

describe('perfil comportamental e busca', () => {
  it('calcula aderência DISC, por indicador e compatibilidade com função', () => {
    expect(aderenciaDisc({ executor: 80 }, { executor: 70, comunicador: 0, planejador: 0, analista: 0 })).toBe(90)
    expect(aderenciaIndicador(55, 40, 70)).toBe(100)
    expect(aderenciaIndicador(30, 40, 70)).toBe(90)
    const t = tracosPadrao()
    expect(compatibilidadeFuncao({ disc: { executor: 50, comunicador: 50, planejador: 50, analista: 50 }, tracos: t }, { disc: { executor: 50, comunicador: 50, planejador: 50, analista: 50 }, tracos: t })).toBe(100)
    expect(discDominante({ executor: 10, comunicador: 90, planejador: 20, analista: 30 })?.chave).toBe('comunicador')
  })
  it('só ranqueia quem consentiu e tem parceria vigente', () => {
    const perfil = { consentimento: true, fonte: 'autodeclarado' as const, atualizadoEm: '', disc: { executor: 50, comunicador: 50, planejador: 50, analista: 50 }, tracos: {} }
    const lista = [pessoa('a', { perfil }), pessoa('b', { perfil: { ...perfil, consentimento: false } }), pessoa('c', { perfil, status: 'encerrado' }), pessoa('d')]
    expect(ranquear(lista, () => 1).map((r) => r.pessoa.id)).toEqual(['a'])
  })
})

describe('ciclos de avaliação', () => {
  const pessoas = [pessoa('L', { cargoId: 'g0' }), pessoa('a'), pessoa('b'), pessoa('c', { responsavelId: 'a' })]
  it('90°: responsável avalia; respeita responsável direto', () => {
    const ps = gerarParticipantes(ciclo({ tipoRelacao: 'direta_90' }), pessoas, setores, id)
    expect(ps.some((p) => p.avaliadorId === 'L' && p.avaliadoId === 'a')).toBe(true)
    expect(ps.some((p) => p.avaliadorId === 'a' && p.avaliadoId === 'c')).toBe(true)
    expect(ps.some((p) => p.avaliadorId === 'L' && p.avaliadoId === 'c')).toBe(false)
    expect(ps.some((p) => p.avaliadorId === p.avaliadoId)).toBe(false)
  })
  it('180° inclui a avaliação reversa; 360° inclui pares; autoavaliação opcional', () => {
    const c180 = gerarParticipantes(ciclo({ tipoRelacao: 'conjunta_180' }), pessoas, setores, id)
    expect(c180.some((p) => p.avaliadorId === 'a' && p.avaliadoId === 'L')).toBe(true)
    const c360 = gerarParticipantes(ciclo({ tipoRelacao: 'trezentos_sessenta', autoavaliacao: true }), pessoas, setores, id)
    expect(c360.some((p) => p.avaliadorId === 'b' && p.avaliadoId === 'a')).toBe(true) // pares: mesma função e responsável
    expect(c360.filter((p) => p.avaliadorId === p.avaliadoId)).toHaveLength(4)
    expect(new Set(c360.map((p) => `${p.avaliadorId}>${p.avaliadoId}`)).size).toBe(c360.length) // sem duplicados
  })
  it('respeita filtros de estrutura e data de início', () => {
    const ps = gerarParticipantes(ciclo({ iniciadosAte: '2023-12-31' }), pessoas, setores, id)
    expect(ps).toHaveLength(0)
    expect(responsaveisDe(pessoa('L'), pessoas, setores)).toEqual([])
  })
  it('nota ponderada pelos pesos, normalizada 0–100', () => {
    const comps = [{ id: 'x', peso: 3 }, { id: 'y', peso: 1 }] as Competencia[]
    expect(notaPonderada({ x: 5, y: 1 }, comps, 5)).toBe(75)
    expect(notaPonderada({}, comps, 5)).toBeNull()
  })
})

describe('avaliação de início de parceria', () => {
  it('gera nos marcos com antecedência, sem duplicar, e expira as vencidas', () => {
    const hoje = '2026-10-21'
    const novo = pessoa('n', { dataEntrada: somarDias(hoje, -26) }) // marco de 30 dias em 4 dias
    const antigo = pessoa('v', { dataEntrada: '2020-01-01' })
    const r = gerarAvaliacoesInicio(CONFIG_INICIO_PADRAO, [novo, antigo, pessoa('L')], setores, [], hoje, id)
    expect(r.novas.map((a) => [a.avaliadoId, a.marcoDias])).toEqual([['n', 30]])
    expect(r.novas[0].avaliadorId).toBe('L')
    const de2 = gerarAvaliacoesInicio(CONFIG_INICIO_PADRAO, [novo], setores, r.novas, hoje, id)
    expect(de2.novas).toHaveLength(0)
    const exp = gerarAvaliacoesInicio(CONFIG_INICIO_PADRAO, [], setores, [{ ...r.novas[0], expiraEm: '2026-10-01' }], hoje, id)
    expect(exp.expiradasIds).toHaveLength(1)
    expect(gerarAvaliacoesInicio({ ...CONFIG_INICIO_PADRAO, habilitado: false }, [novo], setores, [], hoje, id).novas).toHaveLength(0)
  })
})

describe('métricas', () => {
  it('rotatividade usa a média de ativas na janela', () => {
    const hoje = '2026-10-21'
    const ps = [pessoa('a', { dataEntrada: '2020-01-01' }), pessoa('b', { dataEntrada: '2020-01-01', status: 'encerrado', encerramento: { data: '2026-10-10', motivoId: 'm' } })]
    const j = rotatividade(ps, hoje, 30)
    expect(j.encerramentos).toBe(1)
    expect(j.mediaAtivos).toBe(1.5)
    expect(j.taxa).toBe(66.7)
  })
  it('diversidade é suprimida abaixo do mínimo de consentimentos', () => {
    useStore.getState().reset()
    const db = useStore.getState()
    const poucas = db.colaboradores.slice(0, MIN_GRUPO - 1).map((c) => ({ ...c, diversidade: { consentimento: true, genero: 'feminino' as const } }))
    expect(metricasPessoas(db, poucas, hojeISO()).diversidade.suprimido).toBe(true)
    const m = metricasPessoas(db, db.colaboradores, hojeISO())
    expect(m.diversidade.suprimido).toBe(false)
    expect(m.diversidade.genero.reduce((a, f) => a + f.valor, 0)).toBe(m.diversidade.consentidos)
  })
  it('calcula idade corretamente antes e depois do aniversário', () => {
    expect(idade('1990-10-22', '2026-10-21')).toBe(35)
    expect(idade('1990-10-21', '2026-10-21')).toBe(36)
  })
})

describe('ações de RH na camada de dados', () => {
  const st = () => useStore.getState()
  beforeEach(() => { st().reset(); st().entrar('c9') })

  it('vincular beneficiários em lote ignora duplicados e só aceita dependentes do titular', () => {
    const r = st().vincularBeneficiarios('v6', ['c4', 'c5', 'c2'], { c5: ['dp1'] })
    expect(r.ok && r.info).toMatch(/2 vínculo\(s\) criado\(s\), 1 já existia/)
    expect(st().beneficiarios.find((b) => b.colaboradorId === 'c5' && b.beneficioId === 'v6')!.dependentesIds).toEqual([])
  })

  it('revogar consentimento de diversidade apaga os dados', () => {
    st().entrar('c2')
    expect(st().salvarDiversidade({ consentimento: false }).ok).toBe(true)
    expect(st().pessoa('c2')!.diversidade).toEqual({ consentimento: false })
  })

  it('perfil comportamental exige consentimento', () => {
    const r = st().salvarPerfilComportamental('c6', { consentimento: false, fonte: 'assessment', atualizadoEm: '', disc: { executor: 1, comunicador: 1, planejador: 1, analista: 1 }, tracos: {} })
    expect(r.ok).toBe(false)
  })

  it('ciclo: só inicia com participantes; só o avaliador responde; notas válidas', () => {
    const r = st().salvarCiclo({ nome: 'Teste', abertura: hojeISO(), encerramento: somarDias(hojeISO(), 10), tipoRelacao: 'direta_90' })
    const id = r.ok ? r.id! : ''
    expect(st().finalizarCiclo(id).ok).toBe(false)
    st().gerarParticipantesCiclo(id)
    expect(st().finalizarCiclo(id).ok).toBe(true)
    const par = st().participantesCiclo.find((p) => p.cicloId === id)!
    expect(st().responderAvaliacao(par.id, {}, {}).ok).toBe(false) // RH não é o avaliador
    st().entrar(par.avaliadorId)
    expect(st().responderAvaliacao(par.id, { cp1: 9 }, {}).ok).toBe(false)
    const notas = Object.fromEntries(['cp1', 'cp2', 'cp3', 'cp4', 'cp5'].map((c) => [c, 4]))
    expect(st().responderAvaliacao(par.id, notas, {}).ok).toBe(true)
    expect(st().responderAvaliacao(par.id, notas, {}).ok).toBe(false)
  })

  it('feedback: liderança só registra para a própria área', () => {
    st().entrar('c4') // liderança de Tecnologia
    expect(st().salvarFeedback({ colaboradorId: 'c3', data: hojeISO(), classificacao: 'positivo', comentario: 'Bom trabalho', visivelParaPessoa: true }).ok).toBe(false)
    expect(st().salvarFeedback({ colaboradorId: 'c5', data: hojeISO(), classificacao: 'positivo', comentario: 'Bom trabalho', visivelParaPessoa: true }).ok).toBe(true)
  })

  it('mudança de função e de valor de contrato gera histórico', () => {
    const antes = st().historicoFuncao.length
    const c = st().pessoa('c3')!
    st().salvarPessoa({ ...c, cargoId: 'g3', nome: c.nome, email: c.email, papel: c.papel, setorId: c.setorId, status: c.status, dataEntrada: c.dataEntrada, regime: c.regime, cnpj: '11.222.333/0001-81', razaoSocial: c.razaoSocial }, 'c3')
    const k = st().contratos.find((x) => x.colaboradorId === 'c3')!
    st().salvarContrato({ ...k, valorMensal: k.valorMensal + 500 }, k.id)
    expect(st().historicoFuncao.length).toBe(antes + 2)
  })

  it('engenharia de função valida CBO e faixa de valor', () => {
    expect(st().salvarCargo({ nome: 'X', setorId: 's1', nivel: 'Pleno', codigoCBO: 'abc' }).ok).toBe(false)
    expect(st().salvarCargo({ nome: 'X', setorId: 's1', nivel: 'Pleno', faixaValor: { min: 10, max: 5, visivel: false } }).ok).toBe(false)
    expect(st().salvarCargo({ nome: 'X', setorId: 's1', nivel: 'Pleno', codigoCBO: '2124-05' }).ok).toBe(true)
  })

  it('reconhecimento aceita só valores da cultura configurada', () => {
    st().entrar('c2')
    expect(st().reconhecer('c5', 'Inexistente', 'Mensagem longa o bastante', true).ok).toBe(false)
    expect(st().reconhecer('c5', 'Cuidado', 'Mensagem longa o bastante', true).ok).toBe(true)
  })
})
