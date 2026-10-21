import { afterEach, describe, expect, it } from 'vitest'
import { capacidadesDe, definirExtrasDaSessao } from '@/domain/permissions'
import { itemDaRota, podeAbrir, ultimosVisiveis } from './nav'

afterEach(() => definirExtrasDaSessao([]))

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
})
