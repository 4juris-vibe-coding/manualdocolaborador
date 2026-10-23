import { describe, it, expect } from 'vitest'
import { extrairFichaDoTexto, normalizarFichaImportada, temConteudoDeCargo } from './cargoImportado'

const MODELO = [
  'DESCRIÇÃO DE CARGO',
  'Cargo: Advogado Pleno',
  'Código: ADV-PL',
  'Área: Jurídico',
  'Família: Jurídica',
  'Nível: Pleno',
  '1. Descrição sumária',
  'Atua na advocacia consultiva e contenciosa, conduzindo processos de',
  'média complexidade.',
  '2. Objetivo do cargo',
  'Proteger os interesses dos clientes com qualidade técnica.',
  '3. Principais responsabilidades',
  '• Elaborar peças processuais e',
  'pareceres;',
  '• Acompanhar audiências',
  '4. Principais entregas',
  '• Peças protocoladas no prazo',
  'Requisitos mínimos',
  '• OAB ativa',
  'Formação: Bacharelado em Direito',
  'Experiência: 3 anos em escritório de advocacia',
  'Competências técnicas',
  'Direito civil, Processo civil; Redação jurídica',
  'Competências comportamentais',
  '• Comunicação',
  '• Organização',
  'Conhecimentos necessários',
  '• PJe',
  'Certificações',
  'OAB',
  'Indicadores de desempenho',
  '• Prazos cumpridos (%)',
  'Faixa salarial',
  'R$ 8.000,00 a R$ 10.000,00',
  'Vigência: 01/03/2026',
].join('\n')

describe('extrairFichaDoTexto', () => {
  it('separa cada seção da descrição de cargo no campo da ficha', () => {
    expect(extrairFichaDoTexto(MODELO)).toEqual({
      nome: 'Advogado Pleno', codigo: 'ADV-PL', area: 'Jurídico', familia: 'Jurídica', nivel: 'Pleno',
      descricaoOficial: 'Atua na advocacia consultiva e contenciosa, conduzindo processos de média complexidade.',
      objetivo: 'Proteger os interesses dos clientes com qualidade técnica.',
      responsabilidades: 'Elaborar peças processuais e pareceres;\nAcompanhar audiências',
      entregas: 'Peças protocoladas no prazo',
      requisitosMinimos: 'OAB ativa',
      formacao: 'Bacharelado em Direito',
      experiencia: '3 anos em escritório de advocacia',
      competenciasTecnicas: ['Direito civil', 'Processo civil', 'Redação jurídica'],
      competenciasComportamentais: ['Comunicação', 'Organização'],
      conhecimentos: ['PJe'], certificacoes: ['OAB'], kpis: ['Prazos cumpridos (%)'],
      vigenciaInicio: '2026-03-01',
    })
  })

  it('sem a linha "Cargo", usa o primeiro texto que não é o título do documento', () => {
    expect(extrairFichaDoTexto('Ficha de cargo\nAnalista de RH\nObjetivo\nCuidar das pessoas.').nome).toBe('Analista de RH')
  })

  it('item de lista com ":" não abre seção nova', () => {
    const f = extrairFichaDoTexto('Responsabilidades\n• Área: atender clientes\n• Objetivo: bater metas')
    expect(f.responsabilidades).toBe('Área: atender clientes\nObjetivo: bater metas')
    expect(f.area).toBe('')
  })

  it('texto sem seções de cargo não tem conteúdo', () => {
    expect(temConteudoDeCargo(extrairFichaDoTexto('Nota fiscal\nValor total R$ 10,00'))).toBe(false)
  })
})

describe('normalizarFichaImportada', () => {
  it('descarta formatos inválidos e limita listas', () => {
    const n = normalizarFichaImportada({ objetivo: 5, vigenciaInicio: '2026-02-31x', kpis: ['• a', 'a', '', ...Array(80).fill(0).map((_, i) => `k${i}`)] })
    expect(n.objetivo).toBe('')
    expect(n.vigenciaInicio).toBeNull()
    expect(n.kpis[0]).toBe('a')
    expect(n.kpis).toHaveLength(60)
  })
})
