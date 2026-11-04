import { describe, it, expect } from 'vitest'
import {
  compatibilidadeDisc, faixaCompat, faixaDe, itensPublicos, perguntasPublicas, pontuarDisc, pontuarFit, validarItensDisc, validarPerguntasFit,
  validarRespostasDisc, validarRespostasFit, type ItemDisc, type PerguntaFit,
} from './avaliacoesEtapa'

const PERGUNTAS: PerguntaFit[] = [
  { id: 'p1', tipo: 'escolha', texto: 'Como prefere receber feedback?', obrigatoria: true, competencia: 'Colaboração', peso: 2, criterio: 'Abertura a feedback',
    alternativas: [{ id: 'a', texto: 'Na hora', pontos: 10 }, { id: 'b', texto: 'Por escrito', pontos: 5 }, { id: 'c', texto: 'Prefiro não receber', pontos: 0 }] },
  { id: 'p2', tipo: 'escala', texto: 'Gosto de trabalhar em equipe', obrigatoria: true, competencia: 'Colaboração', peso: 1 },
  { id: 'p3', tipo: 'escala', texto: 'Organizo minhas tarefas', obrigatoria: false, competencia: 'Organização' },
  { id: 'p4', tipo: 'aberta', texto: 'Conte uma situação difícil', obrigatoria: true },
  { id: 'p5', tipo: 'escolha', texto: 'Sem nota', obrigatoria: false, alternativas: [{ id: 'x', texto: 'X' }, { id: 'y', texto: 'Y' }] },
]

const item = (id: string): ItemDisc => ({ id, afirmacoes: [
  { id: `${id}d`, texto: 'Decido rápido', dimensao: 'D' }, { id: `${id}i`, texto: 'Animo o grupo', dimensao: 'I' },
  { id: `${id}s`, texto: 'Sou paciente', dimensao: 'S' }, { id: `${id}c`, texto: 'Sigo regras', dimensao: 'C' },
] })

describe('fit cultural · pontuação', () => {
  it('média ponderada por competência normalizada em 0–100; aberta e sem pontos não entram', () => {
    const r = pontuarFit(PERGUNTAS, { p1: 'b', p2: 5, p3: 1, p4: 'texto', p5: 'x' })
    // Colaboração: p1 = 0,5 (peso 2), p2 = 1 (peso 1) → (1 + 1) / 3 = 66,7
    expect(r.competencias.find((c) => c.competencia === 'Colaboração')).toMatchObject({ nota: 67, perguntas: 2 })
    expect(r.competencias.find((c) => c.competencia === 'Organização')).toMatchObject({ nota: 0 })
    // geral: (2*0,5 + 1*1 + 1*0) / 4 = 50
    expect(r.geral).toBe(50)
    expect(r.pontuadas).toBe(3)
    expect(r.naoPontuadas).toBe(2)
    expect(r.faixa).toBeNull()
  })

  it('pergunta opcional sem resposta não pesa; sem perguntas pontuadas → null', () => {
    expect(pontuarFit(PERGUNTAS, { p1: 'a', p2: 1 }).geral).toBe(67)
    expect(pontuarFit([PERGUNTAS[3]], { p4: 'ok' }).geral).toBeNull()
  })

  it('faixa de interpretação só quando há critérios', () => {
    const faixas = [{ min: 0, rotulo: 'Baixa aderência' }, { min: 70, rotulo: 'Alta aderência' }, { min: 40, rotulo: 'Média' }]
    expect(faixaDe(80, faixas)?.rotulo).toBe('Alta aderência')
    expect(faixaDe(40, faixas)?.rotulo).toBe('Média')
    expect(faixaDe(10, faixas)?.rotulo).toBe('Baixa aderência')
    expect(faixaDe(80, [])).toBeNull()
    expect(faixaDe(null, faixas)).toBeNull()
    expect(pontuarFit(PERGUNTAS, { p1: 'a', p2: 5 }, faixas).faixa?.rotulo).toBe('Alta aderência')
  })

  it('valida respostas obrigatórias e alternativas', () => {
    const { erros } = validarRespostasFit(PERGUNTAS, { p1: 'zzz', p2: 9 })
    expect(Object.keys(erros).sort()).toEqual(['p1', 'p2', 'p4'])
    const ok = validarRespostasFit(PERGUNTAS, { p1: 'a', p2: '4', p4: '  oi  ' })
    expect(ok.erros).toEqual({})
    expect(ok.limpas).toEqual({ p1: 'a', p2: 4, p4: 'oi' })
  })

  it('valida a configuração', () => {
    expect(validarPerguntasFit(PERGUNTAS, ['Colaboração', 'Organização'])).toEqual({})
    expect(validarPerguntasFit(PERGUNTAS, ['Colaboração'])).toHaveProperty('pergunta_3')
    expect(validarPerguntasFit([{ id: 'a', tipo: 'escolha', texto: 'x', obrigatoria: true, alternativas: [{ id: '1', texto: 'só uma' }] }], [])).toHaveProperty('pergunta_1')
    expect(validarPerguntasFit([], [])).toHaveProperty('perguntas')
  })

  it('versão pública não tem pontos, pesos, competências nem critérios', () => {
    const pub = JSON.stringify(perguntasPublicas(PERGUNTAS))
    expect(pub).not.toMatch(/pontos|peso|competencia|criterio|Colabora/)
    expect(pub).toContain('Por escrito')
  })
})

describe('DISC · escolha forçada', () => {
  const itens = [item('1'), item('2'), item('3'), item('4')]

  it('(mais − menos) normalizado em 0–100', () => {
    const r = pontuarDisc(itens, { 1: { mais: '1d', menos: '1s' }, 2: { mais: '2d', menos: '2c' }, 3: { mais: '3i', menos: '3s' }, 4: { mais: '4d', menos: '4s' } })
    // n = 4. D: 3 mais → (3 + 4) / 8 = 87,5; I: 1 → 62,5; S: −3 → 12,5; C: −1 → 37,5
    expect(r.pontuacao).toEqual({ D: 88, I: 63, S: 13, C: 38 })
    expect(r.itens).toBe(4)
  })

  it('sem respostas fica tudo em 0 e respostas inválidas são ignoradas', () => {
    expect(pontuarDisc(itens, {}).pontuacao).toEqual({ D: 0, I: 0, S: 0, C: 0 })
    expect(pontuarDisc(itens, { 1: { mais: '1d', menos: '1d' } }).itens).toBe(0)
  })

  it('valida respostas e configuração', () => {
    const { erros } = validarRespostasDisc(itens, { 1: { mais: '1d', menos: '1d' }, 2: { mais: '2d', menos: 'zz' } })
    expect(Object.keys(erros).sort()).toEqual(['1', '2', '3', '4'])
    expect(validarItensDisc(itens)).toEqual({})
    const ruim = { id: 'r', afirmacoes: [...item('r').afirmacoes.slice(0, 3), { id: 'rx', texto: 'Outra', dimensao: 'D' as const }] }
    expect(validarItensDisc([item('a'), ruim])).toHaveProperty('item_2')
  })

  it('compatibilidade = 100 − média das diferenças absolutas, com faixas', () => {
    const c = compatibilidadeDisc({ D: 80, I: 60, S: 30, C: 50 }, { D: 70, I: 60, S: 50, C: 40 })
    // |10| + 0 + |−20| + |10| = 40 / 4 = 10 → 90
    expect(c.indice).toBe(90)
    expect(c.faixa).toBe('alta')
    expect(c.diferencas.find((d) => d.dimensao === 'S')?.diferenca).toBe(-20)
    expect(c.justificativa[2]).toMatch(/20 pontos abaixo/)
    expect(faixaCompat(75)).toBe('alta')
    expect(faixaCompat(74)).toBe('moderada')
    expect(faixaCompat(50)).toBe('moderada')
    expect(faixaCompat(49)).toBe('baixa')
    expect(compatibilidadeDisc({ D: 100, I: 100, S: 0, C: 0 }, { D: 0, I: 0, S: 100, C: 100 }).indice).toBe(0)
  })

  it('itens públicos não revelam a dimensão', () => {
    expect(JSON.stringify(itensPublicos(itens))).not.toMatch(/dimensao|"D"|"I"|"S"|"C"/)
  })
})
