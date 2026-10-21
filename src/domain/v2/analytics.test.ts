import { describe, it, expect } from 'vitest'
import {
  CacheCurto, celulaCsv, conversaoProposta, diasDoPeriodo, indicador, INDISPONIVEIS_PADRAO, mesesDoPeriodo, paraCsv, periodoAnterior,
  periodoDosFiltros, taxaConclusaoProcessos, variacao,
} from './analytics'

describe('períodos', () => {
  it('padrão = 6 meses corridos até hoje', () => {
    expect(periodoDosFiltros(undefined, undefined, '2026-10-21')).toEqual({ de: '2026-05-01', ate: '2026-10-21' })
  })
  it('respeita datas válidas e ignora inválidas/invertidas', () => {
    expect(periodoDosFiltros('2026-01-10', '2026-02-20', '2026-10-21')).toEqual({ de: '2026-01-10', ate: '2026-02-20' })
    expect(periodoDosFiltros('lixo', '2026-03-31', '2026-10-21')).toEqual({ de: '2025-10-01', ate: '2026-03-31' })
    expect(periodoDosFiltros('2026-05-01', '2026-04-01', '2026-10-21').de).toBe('2025-11-01')
  })
  it('período anterior tem o mesmo tamanho e termina na véspera', () => {
    const p = { de: '2026-05-01', ate: '2026-05-31' }
    const a = periodoAnterior(p)
    expect(a).toEqual({ de: '2026-03-31', ate: '2026-04-30' })
    expect(diasDoPeriodo(a)).toBe(diasDoPeriodo(p))
  })
  it('lista os meses cobertos, atravessando a virada de ano', () => {
    expect(mesesDoPeriodo({ de: '2025-11-15', ate: '2026-02-01' })).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
})

describe('variação e indicadores', () => {
  it('só compara quando há base nos dois lados', () => {
    expect(variacao(10, null)).toBeNull()
    expect(variacao(null, 10)).toBeNull()
    expect(variacao(12, 10)).toEqual({ absoluta: 2, percentual: 20, sentido: 'subiu' })
    expect(variacao(5, 0)).toEqual({ absoluta: 5, percentual: null, sentido: 'subiu' })
    expect(variacao(3, 3)?.sentido).toBe('igual')
  })
  it('conversão de proposta = aceitas ÷ (aceitas + recusadas)', () => {
    expect(conversaoProposta(3, 1)).toBe(75)
    expect(conversaoProposta(0, 0)).toBeNull()
  })
  it('taxa de conclusão considera só vagas finalizadas', () => {
    const v = (status: string, q: number, p: number) => ({ status, qtdPosicoes: q, posicoesPreenchidas: p })
    expect(taxaConclusaoProcessos([v('publicada', 1, 0)])).toBeNull()
    expect(taxaConclusaoProcessos([v('encerrada', 2, 2), v('encerrada', 1, 0), v('cancelada', 1, 0), v('publicada', 1, 0)])).toBe(33.3)
  })
  it('indicador sem valor fica indisponível; com valor calcula a variação', () => {
    const sem = indicador({ chave: 'x', rotulo: 'X', valor: null, unidade: 'dias', definicao: '', fonte: '', periodo: '' })
    expect(sem.disponivel).toBe(false)
    const com = indicador({ chave: 'x', rotulo: 'X', valor: 8, anterior: 10, unidade: 'dias', definicao: '', fonte: '', periodo: '' })
    expect(com.disponivel).toBe(true)
    expect(com.variacao?.sentido).toBe('caiu')
  })
  it('indicadores sem base são declarados indisponíveis com dependência', () => {
    expect(INDISPONIVEIS_PADRAO.every((i) => !i.disponivel && i.valor === null && !!i.dependencia)).toBe(true)
  })
})

describe('CSV e cache', () => {
  it('escapa separador/aspas e neutraliza fórmulas', () => {
    expect(celulaCsv('a;b')).toBe('"a;b"')
    expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""')
    expect(celulaCsv('=SOMA(A1)')).toBe("'=SOMA(A1)")
    expect(paraCsv([['a', 1], ['b', null]])).toBe('﻿a;1\r\nb;')
  })
  it('cache expira em 60 s', () => {
    const c = new CacheCurto<number>()
    c.guardar('k', 7, 1000)
    expect(c.obter('k', 30_000)).toBe(7)
    expect(c.obter('k', 61_001)).toBeUndefined()
  })
})
