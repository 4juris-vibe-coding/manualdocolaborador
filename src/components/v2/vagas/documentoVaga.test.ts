import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DocumentoVaga, documentoDaVagaInterna, documentoDaVagaPublica, pendenciasDocumento } from './DocumentoVaga'

const ORIGEM = 'https://portal.exemplo'
const base = { slug: 'sdr', titulo: 'SDR Pleno', modalidade: 'hibrido', regimeContratacao: 'pj', cidade: 'Fortaleza', estado: 'CE', salarioMin: 2500, salarioMax: 4000, moeda: 'BRL', tipoRemuneracao: 'mensal' }
const html = (d: ReturnType<typeof documentoDaVagaInterna>) => renderToStaticMarkup(createElement(DocumentoVaga, { d }))

describe('PDF da vaga', () => {
  it('vaga publicada: traz link de candidatura e nenhum aviso interno', () => {
    const d = documentoDaVagaInterna({ ...base, status: 'publicada', textoPublico: 'Sobre a vaga', requisitosObrigatorios: ['A'] }, 'Comercial', ORIGEM)
    expect(d.link).toBe(`${ORIGEM}/carreiras/sdr`)
    expect(d.aviso).toBeNull()
    expect(html(d)).toContain(`${ORIGEM}/carreiras/sdr`)
  })

  it('vaga não publicada: avisa que é documento interno e não traz link', () => {
    const d = documentoDaVagaInterna({ ...base, status: 'rascunho' }, null, ORIGEM)
    expect(d.link).toBeNull()
    expect(d.aviso).toMatch(/Documento interno/)
    expect(html(d)).not.toContain('/carreiras/')
  })

  it('faixa salarial só entra quando a vaga marcou divulgar', () => {
    expect(documentoDaVagaInterna({ ...base, status: 'publicada' }, null, ORIGEM).salario).toBeNull()
    const d = documentoDaVagaInterna({ ...base, status: 'publicada', divulgarSalario: true }, null, ORIGEM)
    expect(d.salario).toMatch(/2\.500,00.*4\.000,00.*mensal/)
  })

  it('omite seções vazias (sem placeholders) e lista o que falta só na prévia', () => {
    const d = documentoDaVagaInterna({ ...base, status: 'rascunho', textoPublico: 'Curta', sobreEmpresa: '', requisitosObrigatorios: [], beneficios: [], etapasProcesso: [] }, null, ORIGEM)
    const h = html(d)
    for (const s of ['Sobre a 4JURIS', 'Responsabilidades', 'Requisitos', 'Processo seletivo', 'Vantagens', 'Não informado', 'undefined', 'null']) expect(h).not.toContain(s)
    expect(h).toContain('Sobre a oportunidade')
    expect(pendenciasDocumento(d)).toEqual(expect.arrayContaining(['Responsabilidades', 'Requisitos', 'Etapas do processo seletivo', 'Área']))
  })

  it('versão pública usa só campos públicos e mantém acentuação', () => {
    const d = documentoDaVagaPublica({ slug: 'x', titulo: 'Coordenação de Operações', area: 'Gestão', modalidade: 'remoto', descricao: 'Ação e atenção', requisitosObrigatorios: [], requisitosDesejaveis: [], beneficios: [], etapasProcesso: ['Entrevista'], salario: null }, ORIGEM)
    const h = html(d)
    expect(h).toContain('Coordenação de Operações')
    expect(h).toContain('Ação e atenção')
    expect(h).toContain('Entrevista')
  })
})
