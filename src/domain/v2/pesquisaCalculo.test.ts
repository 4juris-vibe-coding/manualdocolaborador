import { describe, it, expect } from 'vitest'
import { avaliarFiltro, calcularNps, calcularResultados, resultadosParaCsv, resumoExecutivo, suprimirGrupos, type RespostaBruta } from './pesquisaCalculo'
import { assinaturaPergunta, condicaoVerdadeira, perguntasVisiveis, resolverPublico, validarEstrutura, validarRespostas, validarValor, type PerguntaPesquisa } from './pesquisaTipos'
import { MODELOS } from './pesquisaModelos'

const P = (o: Partial<PerguntaPesquisa> & Pick<PerguntaPesquisa, 'id' | 'tipo'>): PerguntaPesquisa => ({ texto: `Pergunta ${o.id}`, obrigatoria: true, ...o })

describe('eNPS', () => {
  it('classifica 9–10 promotores, 7–8 neutros, 0–6 detratores e calcula %prom − %det', () => {
    const r = calcularNps([10, 9, 9, 8, 7, 6, 3, 0, 10, 9])
    expect(r).toMatchObject({ n: 10, promotores: 5, neutros: 2, detratores: 3, pctPromotores: 50, pctDetratores: 30, enps: 20 })
  })
  it('sem respostas não inventa número', () => expect(calcularNps([]).enps).toBeNull())
  it('ignora valores fora de 0–10', () => expect(calcularNps([11, -1, 5.5, 10]).n).toBe(1))
})

describe('supressão de grupos', () => {
  const g = (...n: number[]) => n.map((x, i) => ({ chave: 'g' + i, n: x }))
  it('oculta grupos abaixo do mínimo', () => {
    const o = suprimirGrupos(g(10, 2, 8), 5)
    expect(o.get('g1')).toBe(true)
  })
  it('complementar: com um só grupo pequeno, oculta também o menor visível', () => {
    const o = suprimirGrupos(g(12, 2, 8), 5) // 2 oculto; 2 < 5 → esconde o 8 também (2+8=10 ≥ 5)
    expect(o.get('g1')).toBe(true)
    expect(o.get('g2')).toBe(true)
    expect(o.get('g0')).toBe(false)
  })
  it('se os pequenos somados já atingem o mínimo, não oculta mais ninguém', () => {
    const o = suprimirGrupos(g(12, 3, 3), 5)
    expect(o.get('g0')).toBe(false)
  })
  it('grupos vazios não disparam a regra complementar', () => {
    expect(suprimirGrupos(g(10, 0, 8), 5).get('g2')).toBe(false)
  })
  it('todos pequenos: tudo oculto', () => {
    const o = suprimirGrupos(g(2, 3), 5)
    expect([...o.values()].every(Boolean)).toBe(true)
  })
})

describe('filtros seguros', () => {
  it('bloqueia recorte pequeno e recorte que deixa um resto pequeno', () => {
    expect(avaliarFiltro(3, 20, 5).permitido).toBe(false)
    expect(avaliarFiltro(17, 20, 5).permitido).toBe(false)
    expect(avaliarFiltro(10, 20, 5).permitido).toBe(true)
    expect(avaliarFiltro(20, 20, 5).permitido).toBe(true)
  })
})

function resp(n: number, setor: string, valor: (i: number) => number, dia = '2026-03-01', versao = 1): RespostaBruta[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${setor}-${i}-${versao}`, versao, enviadaEm: dia, grupo: { setorId: setor, unidadeId: 'u1' }, itens: { q1: valor(i), q2: 4, t: `texto ${setor}${i}` } }))
}
const perguntas: PerguntaPesquisa[] = [
  P({ id: 'q1', tipo: 'enps', texto: 'Recomendaria?' }),
  P({ id: 'q2', tipo: 'likert', texto: 'Confio na liderança', dimensao: 'Liderança' }),
  P({ id: 't', tipo: 'texto_longo', obrigatoria: false }),
]

describe('calcularResultados', () => {
  it('total abaixo do mínimo não mostra nada', () => {
    const r = calcularResultados({ versoes: [{ versao: 1, perguntas }], respostas: resp(3, 'a', () => 10), elegiveis: 10, convidados: 10, minGrupo: 5 })
    expect(r.suprimido).toBe(true)
    expect(r.perguntas).toHaveLength(0)
  })
  it('taxa de resposta, eNPS, médias e segmentos com supressão complementar', () => {
    const rs = [...resp(10, 'a', (i) => (i < 5 ? 10 : 3)), ...resp(2, 'b', () => 0), ...resp(8, 'c', () => 9)]
    const r = calcularResultados({ versoes: [{ versao: 1, perguntas }], respostas: rs, elegiveis: 40, convidados: 40, minGrupo: 5, incluirTextos: true })
    expect(r.total).toBe(20)
    expect(r.taxaResposta).toBe(50)
    const q1 = r.perguntas.find((p) => p.id === 'q1')!
    expect(q1.resultado).toMatchObject({ tipo: 'nps', n: 20, promotores: 13, detratores: 7 })
    const seg = q1.porSetor!
    const b = seg.find((s) => s.chave === 'b')!, c = seg.find((s) => s.chave === 'c')!, a = seg.find((s) => s.chave === 'a')!
    expect(b.suprimido).toBe(true)
    expect(b.resultado).toBeNull()
    expect(c.suprimido).toBe(true) // complementar: o menor visível some junto
    expect(a.suprimido).toBe(false)
    expect(r.dimensoes[0]).toMatchObject({ dimensao: 'Liderança', media: 4 })
    expect(r.perguntas.find((p) => p.id === 't')!.textos).toHaveLength(20)
  })
  it('filtro que isolaria grupo pequeno é bloqueado e não vaza números', () => {
    const rs = [...resp(10, 'a', () => 9), ...resp(3, 'b', () => 1)]
    const r = calcularResultados({ versoes: [{ versao: 1, perguntas }], respostas: rs, elegiveis: 20, convidados: 20, minGrupo: 5, filtro: { setorId: 'b' } })
    expect(r.filtroBloqueado).toMatch(/menos de 5/)
    expect(r.perguntas).toHaveLength(0)
    const r2 = calcularResultados({ versoes: [{ versao: 1, perguntas }], respostas: rs, elegiveis: 20, convidados: 20, minGrupo: 5, filtro: { setorId: 'a' } })
    expect(r2.filtroBloqueado).toMatch(/subtração/)
  })
  it('texto livre não aparece com filtro ativo nem por segmento', () => {
    const rs = [...resp(10, 'a', () => 9), ...resp(10, 'b', () => 9)]
    const r = calcularResultados({ versoes: [{ versao: 1, perguntas }], respostas: rs, elegiveis: 20, convidados: 20, minGrupo: 5, filtro: { setorId: 'a' }, incluirTextos: true })
    expect(r.perguntas.find((p) => p.id === 't')!.textos).toBeUndefined()
    expect(r.perguntas.find((p) => p.id === 't')!.porSetor).toBeUndefined()
  })
  it('versão antiga continua interpretável: pergunta alterada não é somada', () => {
    const v2 = perguntas.map((p) => (p.id === 'q2' ? { ...p, texto: 'Confio muito na liderança' } : p))
    const rs = [...resp(6, 'a', () => 9, '2026-03-01', 1), ...resp(7, 'a', () => 9, '2026-04-01', 2)]
    const r = calcularResultados({ versoes: [{ versao: 1, perguntas }, { versao: 2, perguntas: v2 }], respostas: rs, elegiveis: 20, convidados: 20, minGrupo: 5 })
    const q2 = r.perguntas.find((p) => p.id === 'q2')!
    expect(q2.versoes).toEqual([2])
    expect(q2.versoesNaoComparaveis).toEqual([1])
    expect(q2.n).toBe(7)
    const q1 = r.perguntas.find((p) => p.id === 'q1')!
    expect(q1.versoes).toEqual([1, 2])
    expect(q1.n).toBe(13)
    expect(r.porVersao).toEqual([{ versao: 1, n: 6 }, { versao: 2, n: 7 }])
  })
  it('resumo executivo é determinístico e CSV só leva agregados visíveis', () => {
    const rs = [...resp(10, 'a', (i) => (i < 5 ? 10 : 3)), ...resp(2, 'b', () => 0), ...resp(8, 'c', () => 9)]
    const r = calcularResultados({ versoes: [{ versao: 1, perguntas }], respostas: rs, elegiveis: 40, convidados: 40, minGrupo: 5 })
    const txt = resumoExecutivo(r, 'Clima').join(' ')
    expect(txt).toMatch(/taxa de resposta de 50%/)
    expect(txt).toMatch(/não é satisfação|não satisfação|participação, não satisfação/)
    const csv = resultadosParaCsv(r)
    expect(csv).toContain('Área: a')
    expect(csv).not.toContain('Área: b')
    expect(csv).not.toContain('Área: c')
  })
  it('CSV neutraliza fórmulas', () => {
    const p = [P({ id: 'x', tipo: 'texto_curto', texto: '=SOMA(A1)', obrigatoria: false })]
    const rs: RespostaBruta[] = Array.from({ length: 6 }, (_, i) => ({ id: String(i), versao: 1, enviadaEm: '2026-01-01', grupo: {}, itens: { x: '=cmd' } }))
    const csv = resultadosParaCsv(calcularResultados({ versoes: [{ versao: 1, perguntas: p }], respostas: rs, elegiveis: 6, convidados: 6, minGrupo: 5, incluirTextos: true }))
    expect(csv).toContain("'=cmd")
    expect(csv).toContain("'=SOMA(A1)")
  })
})

describe('perguntas: validação e lógica condicional', () => {
  it('valida por tipo', () => {
    expect(validarValor(P({ id: 'a', tipo: 'nps' }), 10)).toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'nps' }), 11)).not.toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'likert' }), 0)).not.toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'escala', escala: { min: 0, max: 5 } }), 5)).toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'unica', opcoes: ['x', 'y'] }), 'z')).not.toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'multipla', opcoes: ['x', 'y'] }), ['x', 'y'])).toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'ordenacao', opcoes: ['x', 'y'] }), ['y'])).not.toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'sim_nao' }), 'talvez')).not.toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'data' }), '2026-02-30x')).not.toBeNull()
    expect(validarValor(P({ id: 'a', tipo: 'texto_curto' }), 'x'.repeat(201))).not.toBeNull()
  })
  it('valida a configuração da estrutura', () => {
    expect(validarEstrutura([])).toMatch(/ao menos uma/)
    expect(validarEstrutura([P({ id: 'a', tipo: 'unica', opcoes: ['só uma'] })])).toMatch(/2 alternativas/)
    expect(validarEstrutura([P({ id: 'a', tipo: 'escala', escala: { min: 5, max: 1 } })])).toMatch(/fim da escala/)
    expect(validarEstrutura([P({ id: 'a', tipo: 'sim_nao' }), P({ id: 'a', tipo: 'sim_nao' })])).toMatch(/mesmo identificador/)
    expect(validarEstrutura([P({ id: 'b', tipo: 'sim_nao', condicao: { perguntaId: 'a', operador: 'igual', valor: 'sim' } }), P({ id: 'a', tipo: 'sim_nao' })])).toMatch(/anterior/)
  })
  it('pergunta condicional: oculta não é exigida e sua resposta é descartada', () => {
    const qs = [
      P({ id: 'a', tipo: 'sim_nao' }),
      P({ id: 'b', tipo: 'texto_curto', condicao: { perguntaId: 'a', operador: 'igual', valor: 'sim' } }),
      P({ id: 'c', tipo: 'texto_curto', obrigatoria: false, condicao: { perguntaId: 'b', operador: 'respondida' } }),
    ]
    expect(perguntasVisiveis(qs, { a: 'nao' }).map((p) => p.id)).toEqual(['a'])
    const v = validarRespostas(qs, { a: 'nao', b: 'sobrou' })
    expect(v.erros).toEqual({})
    expect(v.limpas).toEqual({ a: 'nao' })
    expect(validarRespostas(qs, { a: 'sim' }).erros.b).toBe('Resposta obrigatória.')
    expect(condicaoVerdadeira({ perguntaId: 'a', operador: 'maior_igual', valor: 7 }, { a: 8 })).toBe(true)
  })
  it('assinatura muda com enunciado, escala ou opções', () => {
    const a = P({ id: 'a', tipo: 'escala', escala: { min: 1, max: 5 } })
    expect(assinaturaPergunta(a)).not.toBe(assinaturaPergunta({ ...a, escala: { min: 1, max: 10 } }))
    expect(assinaturaPergunta(a)).toBe(assinaturaPergunta({ ...a, texto: '  PERGUNTA a ' }))
  })
})

describe('público elegível', () => {
  const gente = [
    { id: '1', setorId: 's1', unidadeId: 'u1', cargoId: 'c1', responsavelId: 'g1' },
    { id: '2', setorId: 's1', unidadeId: 'u2', cargoId: 'c2', responsavelId: 'g1' },
    { id: '3', setorId: 's2', unidadeId: 'u1', cargoId: 'c1', responsavelId: 'g2' },
    { id: '4', setorId: 's2', status: 'encerrado' },
  ]
  it('todos exclui encerrados', () => expect(resolverPublico({ todos: true }, gente).sort()).toEqual(['1', '2', '3']))
  it('critérios combinam com E entre tipos e OU dentro', () => {
    expect(resolverPublico({ setorIds: ['s1'], unidadeIds: ['u1'] }, gente)).toEqual(['1'])
    expect(resolverPublico({ setorIds: ['s1', 's2'] }, gente).sort()).toEqual(['1', '2', '3'])
    expect(resolverPublico({ gestorIds: ['g1'] }, gente).sort()).toEqual(['1', '2'])
  })
  it('pessoas avulsas somam e exclusões tiram; sem critério ninguém', () => {
    expect(resolverPublico({ setorIds: ['s1'], pessoaIds: ['3'], excluirIds: ['1'] }, gente).sort()).toEqual(['2', '3'])
    expect(resolverPublico({}, gente)).toEqual([])
  })
})

describe('biblioteca de modelos', () => {
  const nomes = [
    'eNPS', 'satisfação', 'clima', 'engajamento', 'experiência do colaborador', 'liderança', 'feedback sobre o gestor', 'confiança na liderança',
    'comunicação e transparência', 'desenvolvimento profissional', 'necessidades de treinamento', 'expectativas de carreira', 'eficácia de treinamentos',
    'integração de novos', 'onboarding', 'benefícios', 'ferramentas e condições', 'bem-estar', 'comunicação interna', 'desligamento',
    'mudança organizacional', 'eventos internos', 'pulso', 'iniciativas de RH', 'personalizada',
  ]
  it('contém todos os modelos pedidos', () => {
    const titulos = MODELOS.map((m) => m.titulo.toLowerCase())
    for (const n of nomes) expect(titulos.some((t) => t.includes(n.toLowerCase())), n).toBe(true)
  })
  it('cada modelo tem estrutura válida, objetivo, categoria e tempo', () => {
    for (const m of MODELOS) {
      expect(m.objetivo.length, m.chave).toBeGreaterThan(20)
      expect(m.tempoMin, m.chave).toBeGreaterThan(0)
      if (m.chave !== 'personalizada') expect(m.perguntas.length, m.chave).toBeGreaterThanOrEqual(6)
      else expect(m.perguntas.length).toBe(0)
      if (m.perguntas.length) expect(validarEstrutura(m.perguntas), m.chave).toBeNull()
    }
    expect(new Set(MODELOS.map((m) => m.chave)).size).toBe(MODELOS.length)
  })
  it('eNPS traz a pergunta 0–10 e o motivo aberto', () => {
    const m = MODELOS.find((x) => x.chave === 'enps')!
    expect(m.perguntas[0].tipo).toBe('enps')
    expect(m.perguntas.some((p) => p.tipo === 'texto_longo')).toBe(true)
  })
})
