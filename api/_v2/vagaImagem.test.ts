import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, PUT, DEL } from './teste/harness'
import { criarVaga, PDF_B64 } from './teste/ats-fixtures'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 120_000)

// PNG mínimo válido (assinatura + dados)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)])
const arquivoPng = { nome: 'capa.png', base64: PNG.toString('base64') }

describe('imagem de capa da vaga', () => {
  it('RH envia a imagem; o portal só a serve com a vaga publicada; trocar e remover funcionam', async () => {
    const pub = await criarVaga(m, { status: 'publicada' })
    const rasc = await criarVaga(m, { status: 'rascunho' })

    // envio
    const up = await PUT(m, `vagas/${pub.id}/imagem`, m.c.rh1, { arquivo: arquivoPng })
    expect(up.status).toBe(200)
    // detalhe interno informa que tem imagem
    expect((await GET(m, `vagas/${pub.id}`, m.c.rh1)).json.vaga.temImagem).toBe(true)
    // download interno (autenticado) é inline
    const interna = await GET(m, `vagas/${pub.id}/imagem`, m.c.rh1)
    expect(interna.status).toBe(200)
    expect(interna.binario?.inline).toBe(true)
    expect(interna.binario?.mime).toBe('image/png')
    // sem sessão: 401
    expect((await GET(m, `vagas/${pub.id}/imagem`)).status).toBe(401)
    // portal: lista e detalhe trazem a URL; a imagem é pública para vaga publicada
    const lista = await GET(m, 'publico/vagas')
    expect(lista.json.itens.find((v: any) => v.slug === pub.slug).imagemUrl).toBe(`/api/v2/publico/vagas/${pub.slug}/imagem`)
    const img = await GET(m, `publico/vagas/${pub.slug}/imagem`)
    expect(img.status).toBe(200)
    expect(img.binario?.mime).toBe('image/png')

    // vaga em rascunho: imagem nunca vaza no portal
    await PUT(m, `vagas/${rasc.id}/imagem`, m.c.rh1, { arquivo: arquivoPng })
    expect((await GET(m, `publico/vagas/${rasc.slug}/imagem`)).status).toBe(404)

    // trocar apaga a anterior (sem arquivos órfãos)
    await PUT(m, `vagas/${pub.id}/imagem`, m.c.rh1, { arquivo: arquivoPng })
    expect((await m.pg.query("select count(*)::int as n from arq_arquivos where dono_tipo = 'vaga_imagem' and dono_id = $1", [pub.id])).rows[0].n).toBe(1)

    // remover
    expect((await DEL(m, `vagas/${pub.id}/imagem`, m.c.rh1)).status).toBe(200)
    expect((await GET(m, `publico/vagas/${pub.slug}/imagem`)).status).toBe(404)
    expect((await m.pg.query("select count(*)::int as n from arq_arquivos where dono_tipo = 'vaga_imagem' and dono_id = $1", [pub.id])).rows[0].n).toBe(0)
  })

  it('recusa formatos que não são imagem e quem não tem permissão', async () => {
    const v = await criarVaga(m, { status: 'publicada' })
    const pdf = await PUT(m, `vagas/${v.id}/imagem`, m.c.rh1, { arquivo: { nome: 'x.pdf', base64: PDF_B64 } })
    expect(pdf.status).toBe(400)
    expect((await PUT(m, `vagas/${v.id}/imagem`, m.c.col1, { arquivo: arquivoPng })).status).toBe(403)
  })
})
