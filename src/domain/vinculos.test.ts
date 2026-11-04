import { describe, it, expect } from 'vitest'
import type { Colaborador } from '@/lib/types'
import { movimentacaoDoMes, movimentacaoDoPeriodo, validarVinculos, historicoSoAcrescenta, vinculosDe, retencao, permanenciaMedia } from './vinculos'

let n = 0
const p = (inicio: string, fim?: string, iniciativa?: Colaborador['encerramento'] extends infer E ? E extends { iniciativa?: infer I } ? I : never : never, extra: Partial<Colaborador> = {}): Colaborador => ({
  id: `p${++n}`, nome: `P${n}`, email: `p${n}@x`, telefone: '', avatarCor: '#000', papel: 'colaborador', setorId: 's1', cargoId: 'g1',
  status: fim ? 'encerrado' : 'ativo', dataEntrada: inicio, cidade: '', uf: '', regime: 'PJ', razaoSocial: '', cnpj: '',
  privacidade: { mostrarAniversario: false, mostrarMarcos: false, aparecerEmDestaques: false },
  ...(fim ? { encerramento: { data: fim, motivoId: 'm', iniciativa } } : {}), ...extra,
})

describe('movimentação mensal — fórmulas do RH', () => {
  // 10 pessoas antes de agosto; em agosto: 8 admissões, 3 desligamentos (2 involuntários, 1 sem classificação).
  const base = Array.from({ length: 10 }, () => p('2026-01-10'))
  base[0] = p('2026-01-10', '2026-08-05', 'empresa')
  base[1] = p('2026-01-10', '2026-08-20', 'empresa')
  base[2] = p('2026-01-10', '2026-08-31')
  const adm = Array.from({ length: 8 }, (_, i) => p(`2026-08-${String(i + 2).padStart(2, '0')}`))
  const todos = [...base, ...adm]
  const m = movimentacaoDoMes(todos, '2026-08', '2026-11-04')

  it('headcount inicial/final e identidade final = inicial + admissões − desligamentos', () => {
    expect(m.headcountInicial).toBe(10)
    expect(m.admissoes).toBe(8)
    expect(m.desligamentos).toBe(3)
    expect(m.headcountFinal).toBe(15)
    expect(m.headcountFinal).toBe(m.headcountInicial + m.admissoes - m.desligamentos)
  })
  it('saldo = admissões − desligamentos', () => { expect(m.saldo).toBe(5) })
  it('headcount médio = (inicial + final) ÷ 2', () => { expect(m.headcountMedio).toBe(12.5) })
  it('turnover geral = ((adm + desl) ÷ 2) ÷ HC médio × 100', () => { expect(m.turnover).toBe(Math.round(((8 + 3) / 2 / 12.5) * 1000) / 10) }) // 44
  it('turnover involuntário = involuntários ÷ HC médio × 100, sem contar os não classificados', () => {
    expect(m.involuntarios).toBe(2)
    expect(m.naoClassificados).toBe(1)
    expect(m.turnoverInvoluntario).toBe(16)
  })
  it('detalhamento: quem estava, entrou, saiu e permaneceu', () => {
    expect(m.pessoas.iniciais).toHaveLength(10)
    expect(m.pessoas.admitidas).toHaveLength(8)
    expect(m.pessoas.desligadas.map((x) => x.pessoaId)).toEqual([base[0].id, base[1].id, base[2].id])
    expect(m.pessoas.finais).toHaveLength(15)
  })
  it('saldo negativo quando há mais desligamentos', () => {
    const neg = movimentacaoDoMes([p('2026-01-01', '2026-09-03', 'prestador'), p('2026-01-01', '2026-09-04', 'empresa'), p('2026-09-10')], '2026-09', '2026-11-04')
    expect(neg.saldo).toBe(-1)
  })
  it('não depende do status atual: quem saiu depois ainda conta no mês em que estava', () => {
    const x = p('2026-01-01', '2026-10-15', 'empresa')
    expect(movimentacaoDoMes([x], '2026-08', '2026-11-04').headcountFinal).toBe(1)
    expect(movimentacaoDoMes([x], '2026-10', '2026-11-04').headcountFinal).toBe(0)
  })
  it('quadro médio zero → turnover indisponível (null), nunca divisão por zero', () => {
    expect(movimentacaoDoMes([], '2026-08', '2026-11-04').turnover).toBeNull()
  })
  it('critério diário é aplicado a todo o período, sem misturar', () => {
    const d = movimentacaoDoPeriodo(todos, '2026-07-01', '2026-09-30', '2026-11-04', {}, 'diario')
    expect(d.meses.every((x) => x.headcountMedio > 0)).toBe(true)
    const pad = movimentacaoDoPeriodo(todos, '2026-07-01', '2026-09-30', '2026-11-04')
    expect(pad.admissoes).toBe(8)
    expect(pad.headcountMedio).toBe(Math.round(((10 + 10) / 2 + 12.5 + (15 + 15) / 2) / 3 * 100) / 100)
  })
  it('filtros por área e forma de contratação', () => {
    const outra = p('2026-08-10', undefined, undefined, { setorId: 's2', regime: 'MEI' })
    expect(movimentacaoDoMes([...todos, outra], '2026-08', '2026-11-04', { setorId: 's2' }).admissoes).toBe(1)
    expect(movimentacaoDoMes([...todos, outra], '2026-08', '2026-11-04', { regime: 'MEI' }).admissoes).toBe(1)
  })
  it('vínculos múltiplos: uma pessoa, dois períodos', () => {
    const x = p('2026-01-01', undefined, undefined, { vinculos: [{ id: 'v1', inicio: '2026-01-01', fim: '2026-03-10', iniciativa: 'prestador' }, { id: 'v2', inicio: '2026-06-01' }] })
    expect(movimentacaoDoMes([x], '2026-04', '2026-11-04').headcountFinal).toBe(0)
    expect(movimentacaoDoMes([x], '2026-06', '2026-11-04').admissoes).toBe(1)
    expect(permanenciaMedia([x], '2026-01-01', '2026-12-31')).toBe(68)
    expect(retencao([x], '2026-01-01', '2026-12-31', '2026-11-04', 90)).toEqual({ base: 2, retidos: 1, taxa: 50 })
  })
})

describe('integridade dos vínculos', () => {
  it('deriva o período de cadastros antigos', () => {
    expect(vinculosDe(p('2026-01-01', '2026-02-01'))).toMatchObject([{ inicio: '2026-01-01', fim: '2026-02-01' }])
  })
  it('recusa sobreposição, período aberto no meio e status incoerente', () => {
    expect(validarVinculos({ status: 'ativo', vinculos: [{ id: 'a', inicio: '2026-01-01', fim: '2026-05-01' }, { id: 'b', inicio: '2026-04-01' }] })).toMatch(/sobrepor/)
    expect(validarVinculos({ status: 'ativo', vinculos: [{ id: 'a', inicio: '2026-01-01' }, { id: 'b', inicio: '2026-04-01' }] })).toMatch(/aberto/)
    expect(validarVinculos({ status: 'ativo', vinculos: [{ id: 'a', inicio: '2026-01-01', fim: '2026-02-01' }] })).toMatch(/encerrada/)
    expect(validarVinculos({ status: 'encerrado', encerramento: { data: '2026-02-02', motivoId: 'm' }, vinculos: [{ id: 'a', inicio: '2026-01-01', fim: '2026-02-01' }] })).toMatch(/diverge/)
  })
  it('histórico só acrescenta', () => {
    const m1 = { id: '1', tipo: 'encerramento' as const, em: 'x', vinculoId: 'v', dataEfetiva: '2026-01-01' }
    expect(historicoSoAcrescenta([m1], [m1, { ...m1, id: '2' }])).toBe(true)
    expect(historicoSoAcrescenta([m1], [])).toBe(false)
    expect(historicoSoAcrescenta([m1], [{ ...m1, dataEfetiva: '2026-02-02' }])).toBe(false)
  })
})

describe('área e função na data (histórico com data efetiva)', () => {
  it('quem mudou do Comercial para o Jurídico em agosto conta no Comercial em julho e no Jurídico em setembro', async () => {
    const { organizacaoEm, movimentacaoDoMes: mov } = await import('./vinculos')
    const x = p('2026-01-10', undefined, undefined, { setorId: 'juridico', cargoId: 'adv' })
    const hist = [{ id: 'h1', colaboradorId: x.id, em: '2026-08-20T10:00:00Z', porId: 'rh', dataEfetiva: '2026-08-15', setorAnteriorId: 'comercial', setorNovoId: 'juridico', cargoAnteriorId: 'sdr', cargoNovoId: 'adv' }]
    expect(organizacaoEm(x, hist, '2026-07-31')).toMatchObject({ setorId: 'comercial', cargoId: 'sdr' })
    expect(organizacaoEm(x, hist, '2026-08-15')).toMatchObject({ setorId: 'juridico', cargoId: 'adv' })
    expect(mov([x], '2026-07', '2026-11-04', { setorId: 'comercial', historico: hist }).headcountFinal).toBe(1)
    expect(mov([x], '2026-07', '2026-11-04', { setorId: 'juridico', historico: hist }).headcountFinal).toBe(0)
    expect(mov([x], '2026-09', '2026-11-04', { setorId: 'juridico', historico: hist }).headcountFinal).toBe(1)
    // Sem histórico, cai no cadastro atual (comportamento anterior).
    expect(mov([x], '2026-07', '2026-11-04', { setorId: 'juridico' }).headcountFinal).toBe(1)
  })
  it('desligamento é contado na área em que a pessoa estava ao sair', async () => {
    const { movimentacaoDoMes: mov } = await import('./vinculos')
    const x = p('2026-01-10', '2026-09-10', 'empresa', { setorId: 'juridico' })
    const hist = [{ id: 'h1', colaboradorId: x.id, em: '2026-03-01T00:00:00Z', porId: 'rh', dataEfetiva: '2026-03-01', setorAnteriorId: 'comercial', setorNovoId: 'juridico' }]
    expect(mov([x], '2026-09', '2026-11-04', { setorId: 'juridico', historico: hist }).desligamentos).toBe(1)
    expect(mov([x], '2026-09', '2026-11-04', { setorId: 'comercial', historico: hist }).desligamentos).toBe(0)
  })
})
