import { describe, it, expect } from 'vitest'
import {
  acoesPossiveis, camposFaltantes, celulaCsv, escolherFluxo, ETAPAS_PADRAO, FLUXOS_PADRAO, passoAtual, podeDecidirPasso,
  proximoStatus, quemEdita, semMovimentacao, situacaoPrazo, slugificar, somarDias, validarEtapas,
} from './vagas'
import {
  dataFechamento, funilPorTipo, taxaConversao, tempoAtePrimeiraCandidaturaDias, tempoPorEtapa, tempoPreenchimentoDias, vagaNoPrazo,
  type VagaIndicador,
} from './indicadoresRecrutamento'

describe('máquina de estados da vaga', () => {
  it('só publica a partir de aprovada', () => {
    for (const s of ['rascunho', 'em_aprovacao', 'ajustes', 'pausada', 'encerrada', 'cancelada'] as const) expect(proximoStatus(s, 'publicar')).toBeNull()
    expect(proximoStatus('aprovada', 'publicar')).toBe('publicada')
  })
  it('fluxo feliz e reabertura', () => {
    expect(proximoStatus('rascunho', 'solicitar')).toBe('em_aprovacao')
    expect(proximoStatus('ajustes', 'solicitar')).toBe('em_aprovacao')
    expect(proximoStatus('publicada', 'pausar')).toBe('pausada')
    expect(proximoStatus('pausada', 'retomar')).toBe('publicada')
    expect(proximoStatus('publicada', 'encerrar')).toBe('encerrada')
    expect(proximoStatus('encerrada', 'reabrir')).toBe('aprovada')
    expect(proximoStatus('cancelada', 'reabrir')).toBe('rascunho')
    expect(proximoStatus('encerrada', 'cancelar')).toBeNull()
  })
  it('lista ações e quem edita', () => {
    expect(acoesPossiveis('publicada').sort()).toEqual(['cancelar', 'encerrar', 'pausar'])
    expect(quemEdita('rascunho')).toBe('solicitante')
    expect(quemEdita('em_aprovacao')).toBe('ninguem')
    expect(quemEdita('publicada')).toBe('gestao')
  })
})

describe('requisitos de preenchimento', () => {
  const base = { titulo: 'Advogado', setorId: 's1', qtdPosicoes: 1, responsabilidades: 'x', modalidade: 'remoto' }
  it('solicitar exige o básico', () => {
    expect(Object.keys(camposFaltantes({}, 'solicitar', '2026-01-01')).sort()).toEqual(['modalidade', 'qtdPosicoes', 'responsabilidades', 'setorId', 'titulo'])
    expect(camposFaltantes(base, 'solicitar', '2026-01-01')).toEqual({})
  })
  it('publicar exige texto, canais e encerramento futuro; cidade só se não for remota', () => {
    const f = camposFaltantes({ ...base, resumo: 'r', canais: ['portal'], encerraCandidaturasEm: '2025-12-31' }, 'publicar', '2026-01-01')
    expect(f.encerraCandidaturasEm).toMatch(/já passou/)
    expect(camposFaltantes({ ...base, resumo: 'r', canais: ['portal'], encerraCandidaturasEm: '2026-02-01' }, 'publicar', '2026-01-01')).toEqual({})
    expect(camposFaltantes({ ...base, modalidade: 'presencial', resumo: 'r', canais: ['portal'], encerraCandidaturasEm: '2026-02-01' }, 'publicar', '2026-01-01').cidade).toBeTruthy()
  })
})

describe('etapas', () => {
  it('padrão é válido; regras de entrada e saída', () => {
    expect(validarEtapas(ETAPAS_PADRAO)).toBeNull()
    expect(validarEtapas([{ nome: 'A', tipo: 'triagem' }, { nome: 'B', tipo: 'contratado' }])).toMatch(/primeira/)
    expect(validarEtapas([{ nome: 'A', tipo: 'nova' }, { nome: 'B', tipo: 'triagem' }])).toMatch(/última/)
    expect(validarEtapas([{ nome: 'A', tipo: 'nova' }, { nome: 'a', tipo: 'generica' }, { nome: 'C', tipo: 'contratado' }])).toMatch(/mesmo nome/)
  })
})

describe('fluxo de aprovação', () => {
  it('escolhe fluxo por condição, com fallback no padrão', () => {
    expect(escolherFluxo(FLUXOS_PADRAO, { prioridade: 'normal' }).chave).toBe('padrao')
    expect(escolherFluxo(FLUXOS_PADRAO, { prioridade: 'critica' }).chave).toBe('critica')
    const f = [...FLUXOS_PADRAO, { chave: 'caro', nome: 'c', passos: [], condicoes: { salarioMaxAcima: 20000 } }]
    expect(escolherFluxo(f, { salarioMax: 25000 }).chave).toBe('caro')
    expect(escolherFluxo(f, { salarioMax: 1000 }).chave).toBe('padrao')
  })
  it('só o aprovador designado (ou admin) decide, na ordem', () => {
    const u = { colaboradorId: 'p', papel: 'rh', funcoes: ['aprovador_financeiro'] }
    expect(podeDecidirPasso({ aprovadorTipo: 'papel', aprovadorRef: 'rh' }, u)).toBe(true)
    expect(podeDecidirPasso({ aprovadorTipo: 'papel', aprovadorRef: 'diretoria' }, u)).toBe(false)
    expect(podeDecidirPasso({ aprovadorTipo: 'funcao', aprovadorRef: 'aprovador_financeiro' }, u)).toBe(true)
    expect(podeDecidirPasso({ aprovadorTipo: 'pessoa', aprovadorRef: 'outro' }, u)).toBe(false)
    expect(podeDecidirPasso({ aprovadorTipo: 'pessoa', aprovadorRef: 'outro' }, { ...u, papel: 'admin' })).toBe(true)
    expect(passoAtual([{ ordem: 2, status: 'pendente' }, { ordem: 1, status: 'aprovada' }, { ordem: 3, status: 'pendente' }])?.ordem).toBe(2)
  })
})

describe('prazos e utilidades', () => {
  const v = { status: 'publicada', prazoPreenchimento: '2026-03-10', qtdPosicoes: 1, posicoesPreenchidas: 0 }
  it('situação do prazo', () => {
    expect(situacaoPrazo(v, '2026-03-11')).toBe('vencida')
    expect(situacaoPrazo(v, '2026-03-05')).toBe('proxima')
    expect(situacaoPrazo(v, '2026-01-01')).toBe('ok')
    expect(situacaoPrazo({ ...v, posicoesPreenchidas: 1 }, '2026-03-11')).toBeNull()
    expect(situacaoPrazo({ ...v, status: 'rascunho' }, '2026-03-11')).toBeNull()
  })
  it('sem movimentação, datas, slug e CSV seguro', () => {
    expect(semMovimentacao({ status: 'publicada' }, '2026-03-01', '2026-03-20')).toBe(true)
    expect(semMovimentacao({ status: 'publicada' }, '2026-03-10', '2026-03-20')).toBe(false)
    expect(somarDias('2026-02-27', 3)).toBe('2026-03-02')
    expect(slugificar('Analista Jurídico Sênior — São Paulo!')).toBe('analista-juridico-senior-sao-paulo')
    expect(celulaCsv('=1+1')).toBe("'=1+1")
    expect(celulaCsv('a;b')).toBe('"a;b"')
  })
})

describe('indicadores de recrutamento', () => {
  const vaga: VagaIndicador = { id: 'v', status: 'encerrada', qtdPosicoes: 2, posicoesPreenchidas: 2, publicadaEm: '2026-01-01T00:00:00Z', primeiraCandidaturaEm: '2026-01-03T00:00:00Z', prazoPreenchimento: '2026-02-01', encerradaEm: '2026-01-30T00:00:00Z' }
  const contr = [{ vagaId: 'v', em: '2026-01-20T00:00:00Z' }, { vagaId: 'v', em: '2026-01-11T00:00:00Z' }, { vagaId: 'x', em: '2026-01-02T00:00:00Z' }]
  it('tempo de preenchimento usa a contratação que fecha a última posição', () => {
    expect(dataFechamento(vaga, contr)).toBe('2026-01-20T00:00:00Z')
    expect(tempoPreenchimentoDias(vaga, contr)).toBe(19)
    expect(tempoPreenchimentoDias({ ...vaga, qtdPosicoes: 3 }, contr)).toBeNull()
    expect(tempoPreenchimentoDias({ ...vaga, publicadaEm: null }, contr)).toBeNull()
  })
  it('tempo até a primeira candidatura', () => {
    expect(tempoAtePrimeiraCandidaturaDias(vaga)).toBe(2)
    expect(tempoAtePrimeiraCandidaturaDias({ ...vaga, primeiraCandidaturaEm: null })).toBeNull()
  })
  it('tempo por etapa ignora etapa em curso', () => {
    const movs = [
      { candidaturaId: 'c1', em: '2026-01-01T00:00:00Z', paraEtapaId: 'e1' },
      { candidaturaId: 'c1', em: '2026-01-03T00:00:00Z', paraEtapaId: 'e2' },
      { candidaturaId: 'c1', em: '2026-01-08T00:00:00Z', paraEtapaId: null },
      { candidaturaId: 'c2', em: '2026-01-01T00:00:00Z', paraEtapaId: 'e1' },
      { candidaturaId: 'c2', em: '2026-01-05T00:00:00Z', paraEtapaId: 'e2' },
    ]
    const r = tempoPorEtapa(movs, (id) => ({ e1: 'Triagem', e2: 'Entrevista' })[id] ?? null)
    expect(r.find((x) => x.etapa === 'Triagem')).toEqual({ etapa: 'Triagem', dias: 3, n: 2 })
    expect(r.find((x) => x.etapa === 'Entrevista')).toEqual({ etapa: 'Entrevista', dias: 5, n: 1 })
    expect(tempoPorEtapa([], () => 'x')).toEqual([])
  })
  it('funil e conversão', () => {
    const f = funilPorTipo([{ tiposAlcancados: ['nova', 'triagem'] }, { tiposAlcancados: ['nova'] }, { tiposAlcancados: ['nova', 'triagem', 'contratado'] }, { tiposAlcancados: ['nova'] }])
    expect(f.map((e) => e.alcancaram)).toEqual([4, 2, 1])
    expect(f[1].conversaoDaAnterior).toBe(50)
    expect(funilPorTipo([])).toEqual([])
    expect(taxaConversao(4, 1)).toBe(25)
    expect(taxaConversao(0, 0)).toBeNull()
  })
  it('vaga no prazo', () => {
    expect(vagaNoPrazo(vaga, contr, '2026-03-01')).toBe(true)
    expect(vagaNoPrazo({ ...vaga, qtdPosicoes: 3, status: 'publicada' }, contr, '2026-03-01')).toBe(false)
    expect(vagaNoPrazo({ ...vaga, qtdPosicoes: 3, status: 'publicada' }, contr, '2026-01-15')).toBe(true)
    expect(vagaNoPrazo({ ...vaga, prazoPreenchimento: null }, contr, '2026-03-01')).toBeNull()
  })
})
