import { describe, it, expect, beforeAll } from 'vitest'
import { Buffer } from 'node:buffer'
import { mundoPadrao, GET, PUT, DEL } from './teste/harness'
import { PDF_B64 } from './teste/ats-fixtures'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)

// JPEG mínimo: só a assinatura importa para a validação de formato
const JPG = { nome: 'foto.jpg', base64: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]).toString('base64') }

describe('foto de perfil', () => {
  it('a própria pessoa troca e remove a sua; todos veem; outros não alteram', async () => {
    const r = await PUT(m, 'pessoas/col1/foto', m.c.col1, { arquivo: JPG })
    expect(r.status).toBe(200)
    expect(typeof r.json.versao).toBe('number')
    const versoes = await GET(m, 'pessoas/fotos', m.c.ger1)
    expect(versoes.json.versoes.col1).toBe(r.json.versao)
    const img = await GET(m, 'pessoas/col1/foto', m.c.ger1)
    expect(img.status).toBe(200)
    expect(img.binario?.mime).toBe('image/jpeg')
    // gestor não é RH: não troca a foto de ninguém
    expect((await PUT(m, 'pessoas/col1/foto', m.c.ger1, { arquivo: JPG })).status).toBe(403)
    expect((await DEL(m, 'pessoas/col1/foto', m.c.ger1)).status).toBe(403)
    expect((await GET(m, 'pessoas/fotos', undefined)).status).toBe(401)
    expect((await DEL(m, 'pessoas/col1/foto', m.c.col1)).status).toBe(200)
    expect((await GET(m, 'pessoas/col1/foto', m.c.ger1)).status).toBe(404)
  })

  it('RH altera a foto de qualquer pessoa; valida formato e pessoa', async () => {
    expect((await PUT(m, 'pessoas/col1/foto', m.c.rh1, { arquivo: JPG })).status).toBe(200)
    expect((await PUT(m, 'pessoas/col1/foto', m.c.rh1, { arquivo: { nome: 'x.jpg', base64: PDF_B64 } })).status).toBe(400)
    expect((await PUT(m, 'pessoas/naoexiste/foto', m.c.rh1, { arquivo: JPG })).status).toBe(404)
    expect((await DEL(m, 'pessoas/col1/foto', m.c.rh1)).status).toBe(200)
  })
})
