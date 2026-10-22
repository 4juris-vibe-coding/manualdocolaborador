import { describe, expect, it } from 'vitest'
import { diasDaSemana, diasDoEvento, eventosDoDia, gradeMes, layoutDia, moverRef, tituloPeriodo, type EventoCal } from './logica'

const ev = (id: string, inicio: string, fim?: string, extra: Partial<EventoCal> = {}): EventoCal => ({ id, titulo: id, inicio, fim, cor: '#000', ...extra })

describe('grade do mês', () => {
  it('semanas completas a partir do domingo, com dias vizinhos', () => {
    const g = gradeMes(2026, 10) // outubro/2026 começa numa quinta
    expect(g.length % 7).toBe(0)
    expect(g[0]).toBe('2026-09-27')
    expect(g).toContain('2026-10-31')
    expect(g[g.length - 1]).toBe('2026-10-31')
    expect(gradeMes(2026, 2).length).toBe(28) // fevereiro/2026 começa num domingo: 4 semanas exatas
  })
  it('semana e navegação', () => {
    expect(diasDaSemana('2026-10-22')).toEqual(['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'])
    expect(moverRef('2026-10-22', 'semana', 1)).toBe('2026-10-29')
    expect(moverRef('2026-10-22', 'dia', -1)).toBe('2026-10-21')
    expect(moverRef('2026-01-31', 'mes', 1)).toBe('2026-02-01')
    expect(tituloPeriodo('2026-10-22', 'mes')).toMatch(/^Outubro de 2026$/i)
  })
})

describe('eventos por dia', () => {
  it('dia inteiro de vários dias aparece em todos; meia-noite não invade o dia seguinte', () => {
    const ferias = ev('f', '2026-10-20', '2026-10-23', { diaInteiro: true })
    expect(diasDoEvento(ferias)).toEqual(['2026-10-20', '2026-10-23'])
    const ate0h = ev('a', '2026-10-20T22:00:00', '2026-10-21T00:00:00')
    expect(diasDoEvento(ate0h)).toEqual(['2026-10-20', '2026-10-20'])
    const lista = [ev('r', '2026-10-21T09:00:00'), ferias, ate0h]
    expect(eventosDoDia(lista, '2026-10-21').map((e) => e.id)).toEqual(['f', 'r'])
  })
})

describe('posicionamento por horário', () => {
  it('sem sobreposição: uma coluna; duração padrão de 60 min', () => {
    const [a] = layoutDia([ev('a', '2026-10-22T09:30:00')], '2026-10-22')
    expect(a).toMatchObject({ inicioMin: 570, fimMin: 630, coluna: 0, colunas: 1 })
  })
  it('sobrepostos dividem a largura; grupo seguinte volta a ocupar tudo', () => {
    const r = layoutDia([
      ev('a', '2026-10-22T09:00:00', '2026-10-22T10:30:00'),
      ev('b', '2026-10-22T09:30:00', '2026-10-22T10:00:00'),
      ev('c', '2026-10-22T10:00:00', '2026-10-22T11:00:00'),
      ev('d', '2026-10-22T14:00:00', '2026-10-22T15:00:00'),
    ], '2026-10-22')
    const m = Object.fromEntries(r.map((x) => [x.evento.id, x]))
    expect(m.a).toMatchObject({ coluna: 0, colunas: 2 })
    expect(m.b).toMatchObject({ coluna: 1, colunas: 2 })
    expect(m.c).toMatchObject({ coluna: 1, colunas: 2 }) // reaproveita a coluna livre de b
    expect(m.d).toMatchObject({ coluna: 0, colunas: 1 })
  })
  it('evento que atravessa a meia-noite é recortado ao dia', () => {
    const e = ev('n', '2026-10-21T22:00:00', '2026-10-22T02:00:00')
    expect(layoutDia([e], '2026-10-21')[0]).toMatchObject({ inicioMin: 1320, fimMin: 1440 })
    expect(layoutDia([e], '2026-10-22')[0]).toMatchObject({ inicioMin: 0, fimMin: 120 })
  })
})
