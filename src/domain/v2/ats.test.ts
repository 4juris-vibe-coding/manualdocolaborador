import { describe, it, expect } from 'vitest'
import { analisarCsvCandidatos, campoCsv, mediaPonderada, statusPublico, somarMeses, vagaAceitaCandidaturas, validarMovimento } from './ats'

const etapas = [{ id: 'e1', tipo: 'nova', ordem: 1 }, { id: 'e2', tipo: 'triagem', ordem: 2 }, { id: 'e9', tipo: 'contratado', ordem: 9 }]

describe('validarMovimento', () => {
  it('move de etapa, recusa etapa de fora e mesma etapa', () => {
    expect(validarMovimento({ status: 'ativa', etapaId: 'e1' }, { etapaId: 'e2' }, etapas)).toMatchObject({ ok: true, etapaId: 'e2', contratar: false })
    expect(validarMovimento({ status: 'ativa', etapaId: 'e1' }, { etapaId: 'zz' }, etapas)).toMatchObject({ ok: false })
    expect(validarMovimento({ status: 'ativa', etapaId: 'e1' }, { etapaId: 'e1' }, etapas)).toMatchObject({ ok: false })
  })
  it('saídas exigem motivo e só partem de "ativa"', () => {
    expect(validarMovimento({ status: 'ativa', etapaId: 'e1' }, { status: 'reprovado' }, etapas)).toMatchObject({ ok: false })
    expect(validarMovimento({ status: 'ativa', etapaId: 'e1' }, { status: 'reprovado', motivo: 'x' }, etapas)).toMatchObject({ ok: true, status: 'reprovado', etapaId: 'e1' })
    expect(validarMovimento({ status: 'reprovado', etapaId: 'e1' }, { status: 'desistiu', motivo: 'x' }, etapas)).toMatchObject({ ok: false })
  })
  it('reativa e bloqueia contratado', () => {
    expect(validarMovimento({ status: 'reprovado', etapaId: 'e1' }, { status: 'ativa', etapaId: 'e2' }, etapas)).toMatchObject({ ok: true, status: 'ativa', etapaId: 'e2' })
    expect(validarMovimento({ status: 'contratado', etapaId: 'e9' }, { etapaId: 'e1' }, etapas)).toMatchObject({ ok: false })
    expect(validarMovimento({ status: 'ativa', etapaId: 'e1' }, { status: 'contratado' }, etapas)).toMatchObject({ ok: false })
  })
  it('mover para a etapa "contratado" sinaliza contratação', () => {
    expect(validarMovimento({ status: 'ativa', etapaId: 'e2' }, { etapaId: 'e9' }, etapas)).toMatchObject({ ok: true, contratar: true })
  })
})

describe('vagaAceitaCandidaturas', () => {
  it('só publicada e dentro do prazo', () => {
    expect(vagaAceitaCandidaturas({ status: 'publicada' }, '2026-05-01')).toEqual({ ok: true })
    expect(vagaAceitaCandidaturas({ status: 'pausada' }, '2026-05-01')).toMatchObject({ ok: false })
    expect(vagaAceitaCandidaturas({ status: 'publicada', encerra_candidaturas_em: '2026-04-30' }, '2026-05-01')).toMatchObject({ ok: false })
    expect(vagaAceitaCandidaturas({ status: 'publicada', publicar_em: '2026-06-01' }, '2026-05-01')).toMatchObject({ ok: false })
    expect(vagaAceitaCandidaturas({ status: 'aprovada' }, '2026-05-01')).toMatchObject({ ok: false })
  })
})

describe('CSV de candidatos', () => {
  it('lê ; e , e aspas, valida e reporta linha a linha', () => {
    const r = analisarCsvCandidatos('Nome,E-mail,Cidade\n"Silva, Ana",ana@x.com,SP\nBeto,beto@x.com,\n,sem@x.com,\nCaio,ruim,\nDani,ana@x.com,')
    expect(r.validas.map((v) => v.nome)).toEqual(['Silva, Ana', 'Beto'])
    expect(r.erros.map((e) => e.linha)).toEqual([4, 5, 6])
  })
  it('exige colunas mínimas e limita o tamanho', () => {
    expect(analisarCsvCandidatos('a,b\n1,2').erros[0].mensagem).toMatch(/cabeçalho/)
    expect(analisarCsvCandidatos('').validas).toEqual([])
    const grande = 'nome,email\n' + Array.from({ length: 600 }, (_, i) => `N${i},n${i}@x.com`).join('\n')
    expect(analisarCsvCandidatos(grande).erros[0].mensagem).toMatch(/Máximo/)
  })
  it('campoCsv neutraliza fórmulas e escapa', () => {
    expect(campoCsv('=1+1')).toBe("'=1+1")
    expect(campoCsv('a;b')).toBe('"a;b"')
    expect(campoCsv('diz "oi"')).toBe('"diz ""oi"""')
    expect(campoCsv(null)).toBe('')
  })
})

describe('avaliação e status público', () => {
  it('média ponderada ignora notas inválidas', () => {
    expect(mediaPonderada({ a: 5, b: 3 }, [{ id: 'a', nome: 'A', peso: 2 }, { id: 'b', nome: 'B', peso: 1 }])).toBe(4.33)
    expect(mediaPonderada({ a: 9 })).toBeNull()
  })
  it('status público não vaza nomes internos', () => {
    expect(statusPublico('ativa', 'entrevista_gestor').rotulo).toBe('Fase de entrevistas')
    expect(statusPublico('reprovado').descricao).not.toMatch(/reprov/i)
  })
  it('somarMeses', () => { expect(somarMeses('2026-01-31', 12)).toBe('2027-01-31') })
})
