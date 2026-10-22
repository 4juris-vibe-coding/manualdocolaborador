import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, POST } from './teste/harness'
import { PDF_B64 } from './teste/ats-fixtures'
import { pdfComTexto } from './teste/pdfTexto'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 120_000)

const enviar = (linhas: string[]) => ({ arquivo: { nome: 'vaga.pdf', base64: pdfComTexto(linhas).toString('base64') } })
const VAGA = [
  'Vaga', 'SDR Pleno',
  'Sobre a vaga', 'Modelo de trabalho: Híbrido', 'Modelo de contratação: PJ',
  'Sobre a 4JURIS', 'A 4juris é uma empresa de marketing jurídico.',
  'Sobre a oportunidade', 'Buscamos um SDR para prospectar escritórios.',
  'Responsabilidades', '• Prospectar leads', '• Qualificar oportunidades',
  'Requisitos', '• Experiência com vendas',
  'Vantagens', '• Wellhub',
  'Localização', 'São Paulo/SP',
]

describe('importar vaga de PDF', () => {
  it('lê o PDF do modelo e devolve os campos, sem gravar a vaga', async () => {
    const r = await POST(m, 'vagas/importar', m.c.rh1, enviar(VAGA))
    expect(r.status).toBe(200)
    expect(r.json.campos).toMatchObject({
      titulo: 'SDR Pleno', modalidade: 'hibrido', regimeContratacao: 'pj',
      sobreEmpresa: 'A 4juris é uma empresa de marketing jurídico.', textoPublico: 'Buscamos um SDR para prospectar escritórios.',
      responsabilidades: 'Prospectar leads\nQualificar oportunidades', requisitos: ['Experiência com vendas'], vantagens: ['Wellhub'], endereco: 'São Paulo/SP',
    })
    expect((await m.pg.query('select count(*)::int as n from rec_vagas')).rows[0]).toEqual({ n: 0 })
  })

  it('só aceita PDF e só para quem cria vagas', async () => {
    const png = { arquivo: { nome: 'x.pdf', base64: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), Buffer.alloc(20)]).toString('base64') } }
    expect((await POST(m, 'vagas/importar', m.c.rh1, png)).status).toBe(400)
    expect((await POST(m, 'vagas/importar', m.c.col1, enviar(VAGA))).status).toBe(403)
  })

  it('PDF sem texto, quebrado ou sem dados de vaga vira 400', async () => {
    expect((await POST(m, 'vagas/importar', m.c.rh1, enviar([]))).status).toBe(400)
    expect((await POST(m, 'vagas/importar', m.c.rh1, { arquivo: { nome: 'vaga.pdf', base64: PDF_B64 } })).status).toBe(400)
    expect((await POST(m, 'vagas/importar', m.c.rh1, enviar(['Vantagens', '• Wellhub']))).status).toBe(400)
  })
})
