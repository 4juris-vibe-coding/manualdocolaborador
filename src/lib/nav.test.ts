import { afterEach, describe, expect, it } from 'vitest'
import { capacidadesDe, definirExtrasDaSessao, definirVisaoColaborador } from '@/domain/permissions'
import { NAV, itemDaRota, podeAbrir, ultimosVisiveis } from './nav'

afterEach(() => { definirExtrasDaSessao([]); definirVisaoColaborador(false) })

describe('guarda de rota', () => {
  it('diretoria abre vagas (para aprovar) e resultados de pesquisa, mas não o painel de pesquisas', () => {
    expect(podeAbrir('diretoria', '/recrutamento/vagas')).toBe(true)
    expect(podeAbrir('diretoria', '/recrutamento/vagas/abc')).toBe(true)
    expect(podeAbrir('diretoria', '/pesquisas-rh/abc/resultados')).toBe(true)
    expect(podeAbrir('diretoria', '/pesquisas-rh/lista')).toBe(true)
    expect(podeAbrir('diretoria', '/pesquisas-rh')).toBe(false)
    expect(podeAbrir('diretoria', '/pesquisas-rh/abc')).toBe(false) // construtor
    expect(podeAbrir('diretoria', '/recrutamento/config')).toBe(false)
  })
  it('aprovação financeira (função adicional) abre a vaga que precisa aprovar', () => {
    expect(podeAbrir('colaborador', '/recrutamento/vagas/abc')).toBe(false)
    definirExtrasDaSessao([...capacidadesDe('colaborador', ['aprovador_financeiro'])])
    expect(podeAbrir('colaborador', '/recrutamento/vagas/abc')).toBe(true)
  })
  it('entrevistador(a) sem ATS chega à agenda de entrevistas; o resto do ATS segue fechado', () => {
    expect(podeAbrir('colaborador', '/recrutamento/entrevistas')).toBe(true)
    expect(podeAbrir('colaborador', '/recrutamento/candidatos')).toBe(false)
  })
  it('rotas comuns continuam como antes', () => {
    expect(podeAbrir('colaborador', '/')).toBe(true)
    expect(podeAbrir('colaborador', '/rh/pessoas/123')).toBe(false)
    expect(podeAbrir('rh', '/rh/pessoas/123')).toBe(true)
    expect(itemDaRota('/rh/pessoas/123')?.to).toBe('/rh/pessoas')
  })
  it('RH vê "Vagas" uma vez só, no grupo do RH', () => {
    expect(ultimosVisiveis('rh').get('/recrutamento/vagas')?.label).toBe('Vagas')
    expect(ultimosVisiveis('gestor').get('/recrutamento/vagas')?.label).toBe('Vagas e aprovações')
    expect(itemDaRota('/recrutamento/vagas', 'rh')?.label).toBe('Vagas')
  })
  it('na visão de colaborador, as capacidades extras da sessão não valem', () => {
    definirExtrasDaSessao([...capacidadesDe('admin', ['recrutador'])])
    expect(podeAbrir('colaborador', '/rh/pessoas')).toBe(true)
    definirVisaoColaborador(true)
    expect(podeAbrir('colaborador', '/rh/pessoas')).toBe(false)
    expect(podeAbrir('colaborador', '/recrutamento/candidatos')).toBe(false)
    expect(podeAbrir('colaborador', '/financeiro')).toBe(false)
    expect(podeAbrir('colaborador', '/perfil')).toBe(true)
  })
})

describe('organização do menu', () => {
  it('primeiro o espaço pessoal, depois as áreas de função, sem misturar', () => {
    const ordem = ['pessoal', 'lideranca', 'financeiro', 'rh', 'admin']
    const areas = NAV.map((g) => g.area)
    expect(areas).toEqual([...areas].sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)))
    expect(new Set(areas)).toEqual(new Set(ordem))
  })
  it('uma tela aparece uma vez por área (sem item duplicado dentro da mesma área)', () => {
    for (const area of new Set(NAV.map((g) => g.area))) {
      const tos = NAV.filter((g) => g.area === area).flatMap((g) => g.items.filter((i) => !i.soDemo && !i.soApi).map((i) => i.to))
      expect(new Set(tos).size, area).toBe(tos.length)
    }
  })
  it('quem é do financeiro também tem o próprio espaço (envia a própria nota)', () => {
    expect(ultimosVisiveis('financeiro').get('/notas')?.label).toBe('Minhas notas fiscais')
    expect(podeAbrir('financeiro', '/notas')).toBe(true)
    expect(podeAbrir('financeiro', '/rh/pessoas')).toBe(false)
  })
  it('relatórios de pessoas unidos numa tela; links antigos continuam abrindo', () => {
    expect(ultimosVisiveis('rh').has('/rh/relatorios')).toBe(true)
    expect(ultimosVisiveis('rh').has('/rh/metricas')).toBe(false)
    expect(podeAbrir('rh', '/rh/metricas')).toBe(true)
    expect(podeAbrir('colaborador', '/rh/relatorios')).toBe(false)
  })
})
