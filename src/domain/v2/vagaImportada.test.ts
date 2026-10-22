import { describe, it, expect } from 'vitest'
import { extrairVagaDoTexto, normalizarVagaImportada, valoresEmReais } from './vagaImportada'

const MODELO = [
  'Vaga',
  'SDR Pleno',
  'Sobre a vaga',
  'Modelo de trabalho: Híbrido',
  'Modelo de contratação: PJ',
  'Sobre a 4JURIS',
  'A 4juris é uma empresa de marketing jurídico que une estratégia, tecnologia e',
  'performance para impulsionar escritórios.',
  'Sobre a oportunidade',
  'Buscamos uma pessoa comunicativa para prospectar escritórios de',
  'advocacia em todo o Brasil.',
  'Responsabilidades',
  '• Prospectar leads por telefone e',
  'WhatsApp;',
  '• Qualificar oportunidades',
  'Requisitos',
  '• Experiência com vendas B2B',
  '•',
  'Boa comunicação',
  'Vantagens',
  '• Wellhub',
  '• Day off no aniversário',
  '2',
  'Localização',
  'Av. Paulista, 1000 – São Paulo/SP',
].join('\n')

describe('extrairVagaDoTexto (modelo 4JURIS)', () => {
  it('separa cada seção do modelo no campo do formulário', () => {
    expect(extrairVagaDoTexto(MODELO)).toMatchObject({
      titulo: 'SDR Pleno',
      senioridade: 'Pleno',
      modalidade: 'hibrido',
      regimeContratacao: 'pj',
      sobreEmpresa: 'A 4juris é uma empresa de marketing jurídico que une estratégia, tecnologia e performance para impulsionar escritórios.',
      textoPublico: 'Buscamos uma pessoa comunicativa para prospectar escritórios de advocacia em todo o Brasil.',
      responsabilidades: 'Prospectar leads por telefone e WhatsApp;\nQualificar oportunidades',
      requisitos: ['Experiência com vendas B2B', 'Boa comunicação'],
      vantagens: ['Wellhub', 'Day off no aniversário'], // o "2" (número da página) é descartado
      endereco: 'Av. Paulista, 1000 – São Paulo/SP',
      diferenciais: [], etapas: [], salarioMin: null, salarioMax: null,
    })
  })

  it('aceita títulos em maiúsculas, com dois-pontos e o conteúdo na mesma linha', () => {
    const v = extrairVagaDoTexto([
      'VAGA: Closer Júnior', 'SOBRE A VAGA:', 'Modelo de trabalho – remoto', 'Contratação: CLT', 'Salário: R$ 3.500,00 a R$ 5.000,00',
      'Jornada: Segunda a sexta, 9h às 18h', 'Inscrições até: 15/11/2026',
      'RESPONSABILIDADES', 'Fechar contratos', 'Acompanhar o funil', 'REQUISITOS', 'Ensino médio completo', 'LOCALIZAÇÃO: Goiânia/GO',
    ].join('\n'))
    expect(v).toMatchObject({
      titulo: 'Closer Júnior', senioridade: 'Júnior', modalidade: 'remoto', regimeContratacao: 'clt',
      salarioMin: 3500, salarioMax: 5000, jornada: 'Segunda a sexta, 9h às 18h', encerraCandidaturasEm: '2026-11-15',
      responsabilidades: 'Fechar contratos\nAcompanhar o funil', requisitos: ['Ensino médio completo'], endereco: 'Goiânia/GO',
    })
  })

  it('sem a seção "Vaga", usa a primeira linha; sem nada do modelo, devolve vazio', () => {
    expect(extrairVagaDoTexto('Analista de Tráfego\nRequisitos\n- Google Ads').titulo).toBe('Analista de Tráfego')
    expect(extrairVagaDoTexto('Requisitos\n- Google Ads').requisitos).toEqual(['Google Ads'])
    const vazio = extrairVagaDoTexto('')
    expect(vazio.titulo).toBe('')
    expect(vazio.requisitos).toEqual([])
  })

  it('"Local: X" dentro de "Sobre a vaga" é campo, não abre outra seção', () => {
    const v = extrairVagaDoTexto('Vaga\nSDR\nSobre a vaga\nLocal: Brasília/DF\nModelo de trabalho: Presencial')
    expect(v).toMatchObject({ endereco: 'Brasília/DF', modalidade: 'presencial' })
  })
})

describe('valoresEmReais / normalizarVagaImportada', () => {
  it('lê valores em reais no formato brasileiro', () => {
    expect(valoresEmReais('de R$ 2.800 até R$3.500,50 ou R$ 4 mil')).toEqual([2800, 3500.5, 4000])
  })
  it('saneia enums, datas e faixa invertida', () => {
    expect(normalizarVagaImportada({ modalidade: 'x', regimeContratacao: 'pj', salarioMin: 5000, salarioMax: 3000, encerraCandidaturasEm: '2026-13-40' }))
      .toMatchObject({ modalidade: null, regimeContratacao: 'pj', salarioMin: 3000, salarioMax: 5000, encerraCandidaturasEm: null })
  })
})
