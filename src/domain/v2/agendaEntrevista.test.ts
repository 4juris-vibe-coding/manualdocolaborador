import { describe, it, expect } from 'vitest'
import { dataUtc, dobrarLinha, escaparTexto, eventoDaEntrevista, fimDoEvento, gerarIcs, uidEntrevista, urlGoogleAgenda } from './agendaEntrevista'

const ENT = { id: '11111111-2222-3333-4444-555555555555', tipo: 'gestor', inicio: '2026-11-10T13:30:00-03:00', fim: '2026-11-10T14:15:00-03:00', modalidade: 'online', localOuLink: 'https://meet.example.com/abc', status: 'agendada', reagendamentos: [{}] }
const bytes = (s: string) => new TextEncoder().encode(s).length
/** Desfaz a dobra de linhas (CRLF + espaço). */
const desdobrar = (ics: string) => ics.replace(/\r\n /g, '')

describe('agenda de entrevistas · .ics', () => {
  it('datas em UTC no formato básico e fim padrão de 60 min', () => {
    expect(dataUtc('2026-11-10T13:30:00-03:00')).toBe('20261110T163000Z')
    expect(dataUtc(new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 678)))).toBe('20260102T030405Z')
    expect(fimDoEvento({ inicio: '2026-11-10T10:00:00Z' }).toISOString()).toBe('2026-11-10T11:00:00.000Z')
    expect(fimDoEvento({ inicio: '2026-11-10T10:00:00Z', fim: '2026-11-10T09:00:00Z' }).toISOString()).toBe('2026-11-10T11:00:00.000Z') // fim inválido
    expect(() => dataUtc('nada')).toThrow()
  })

  it('escapa barra invertida, ponto e vírgula, vírgula e quebras de linha', () => {
    expect(escaparTexto('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf')
  })

  it('dobra linhas em 75 octetos sem partir caracteres UTF-8', () => {
    const longa = 'DESCRIPTION:' + 'ação '.repeat(40)
    const dobrada = dobrarLinha(longa)
    const partes = dobrada.split('\r\n')
    expect(partes.length).toBeGreaterThan(1)
    for (const p of partes) expect(bytes(p)).toBeLessThanOrEqual(75)
    for (const p of partes.slice(1)) expect(p.startsWith(' ')).toBe(true)
    expect(partes.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(longa) // desdobrar devolve o original
    expect(dobrarLinha('curta')).toBe('curta')
  })

  it('gera VEVENT com UID estável, DTSTAMP, DTSTART/DTEND em UTC e CRLF', () => {
    const ev = eventoDaEntrevista(ENT, { vagaTitulo: 'Advogado(a), Pleno; Cível' }, 'candidato')
    const agora = new Date('2026-11-04T12:00:00Z')
    const ics = gerarIcs(ev, agora)
    expect(ics).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')
    expect(ics).toContain(`UID:${uidEntrevista(ENT.id)}\r\n`)
    expect(ics).toContain('DTSTAMP:20261104T120000Z\r\n')
    expect(ics).toContain('DTSTART:20261110T163000Z\r\n')
    expect(ics).toContain('DTEND:20261110T171500Z\r\n')
    expect(ics).toContain('SEQUENCE:1\r\n')
    expect(desdobrar(ics)).toContain('SUMMARY:Entrevista com a liderança · Advogado(a)\\, Pleno\\; Cível · 4JURIS')
    expect(ics).toContain('LOCATION:https://meet.example.com/abc')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/) // só CRLF
    // o mesmo evento gerado de novo tem o mesmo UID
    expect(gerarIcs(eventoDaEntrevista(ENT, { vagaTitulo: 'x' }, 'candidato'))).toContain(`UID:${uidEntrevista(ENT.id)}`)
  })

  it('evento do candidato não leva parecer, resultado, nomes da equipe nem notas', () => {
    const comNotas = { ...ENT, parecer: 'PARECER-SECRETO', resultado: 'reprovado' }
    const ev = eventoDaEntrevista(comNotas as typeof ENT, { vagaTitulo: 'Vaga X', candidatoNome: 'Maria Candidata', entrevistadores: ['Gil Gestor'] }, 'candidato')
    const ics = gerarIcs(ev)
    expect(desdobrar(ics)).not.toMatch(/PARECER-SECRETO|reprovado|Gil Gestor|Maria Candidata/)
    const equipe = eventoDaEntrevista(ENT, { vagaTitulo: 'Vaga X', candidatoNome: 'Maria Candidata', entrevistadores: ['Gil Gestor'] }, 'equipe')
    expect(equipe.descricao).toContain('Maria Candidata')
    expect(equipe.descricao).toContain('Gil Gestor')
  })

  it('entrevista cancelada gera METHOD:CANCEL/STATUS:CANCELLED', () => {
    const ics = gerarIcs(eventoDaEntrevista({ ...ENT, status: 'cancelada' }, { vagaTitulo: 'V' }, 'candidato'))
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('STATUS:CANCELLED')
  })
})

describe('agenda de entrevistas · Google Agenda', () => {
  it('monta o link de modelo com datas em UTC e textos codificados', () => {
    const ev = eventoDaEntrevista(ENT, { vagaTitulo: 'Dev & QA' }, 'candidato')
    const url = urlGoogleAgenda(ev)
    expect(url.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&text=')).toBe(true)
    expect(url).toContain('&dates=20261110T163000Z/20261110T171500Z')
    expect(url).toContain(encodeURIComponent('Dev & QA'))
    expect(url).toContain(`&location=${encodeURIComponent('https://meet.example.com/abc')}`)
    expect(url).toContain('&details=')
    const u = new URL(url)
    expect(u.searchParams.get('text')).toBe(ev.titulo)
    expect(u.searchParams.get('details')).toBe(ev.descricao)
  })
})
